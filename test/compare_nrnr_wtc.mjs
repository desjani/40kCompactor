import fs from 'fs';
import path from 'path';
import { parseNrNr, parseWtcCompact } from '../modules/parsers.js';

function readSample(name) {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    return txt.split(/\r?\n/);
}

function normalize(obj) {
    // Remove helper-only fields and sort arrays consistently for comparison
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalize);
    const out = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) {
        if (k.startsWith('_')) continue;
        const v = obj[k];
        if (k === 'CHARACTER' || k === 'OTHER DATASHEETS') {
                    out[k] = (v||[]).map(u => {
                        const u2 = { ...u };
                            // Aggregate items by normalized name; unfold subunit inner items so nesting doesn't matter
                            const itemMap = Object.create(null);
                            const normname = s => String(s || '').toLowerCase().replace(/^enhancement:\s*/i,'').replace(/[^a-z0-9 ]/g,'').trim();
                            for (const it of (u.items||[])) {
                                if (it && Array.isArray(it.items) && it.items.length > 0) {
                                    // it's a subunit: include its inner items
                                    for (const inner of it.items) {
                                        const iname = normname(inner && inner.name);
                                        if (!iname) continue;
                                        const q = parseInt(String(inner.quantity||'1x').replace(/[^0-9]/g,''),10) || 0;
                                        if (!itemMap[iname]) itemMap[iname] = { name: inner.name, quantity: 0, type: inner.type || 'wargear' };
                                        itemMap[iname].quantity += q;
                                    }
                                } else {
                                    const iname = normname(it && it.name);
                                    if (!iname) continue;
                                    const q = parseInt(String(it.quantity||'1x').replace(/[^0-9]/g,''),10) || 0;
                                    if (!itemMap[iname]) itemMap[iname] = { name: it.name, quantity: 0, type: it.type || 'wargear' };
                                    itemMap[iname].quantity += q;
                                }
                            }
                            u2.items = Object.values(itemMap).map(x => ({ quantity: `${x.quantity}x`, name: x.name, type: x.type, items: [] }));
                            // stable sort
                            u2.items.sort((A,B)=> (A.name||'').localeCompare(B.name||''));
                            return u2;
                    }).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
            continue;
        }
        out[k] = normalize(v);
    }
    return out;
}

function diff(a,b, pathPrefix='') {
    if (a === b) return [];
    if (typeof a !== typeof b) return [`TYPE ${pathPrefix}: ${typeof a} !== ${typeof b}`];
    if (typeof a !== 'object' || a === null || b === null) return [`VALUE ${pathPrefix}: ${String(a)} !== ${String(b)}`];
    // If both sides look like a unit (have name and items), compare key fields and items as unordered multisets
    if (a && b && typeof a === 'object' && typeof b === 'object' && 'name' in a && 'items' in a && 'name' in b && 'items' in b) {
        const res = [];
        const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        // name should match (normalized)
        if (norm(a.name) !== norm(b.name)) res.push(`VALUE ${pathPrefix}.name: ${a.name} !== ${b.name}`);
        // compare points if present
        if ('points' in a || 'points' in b) {
            const pa = parseInt(String(a.points || 0), 10) || 0;
            const pb = parseInt(String(b.points || 0), 10) || 0;
            if (pa !== pb) res.push(`VALUE ${pathPrefix}.points: ${String(a.points)} !== ${String(b.points)}`);
        }
        // compare quantities (numeric)
        const qa = parseInt(String(a.quantity || '1x').replace(/[^0-9]/g,''),10) || 0;
        const qb = parseInt(String(b.quantity || '1x').replace(/[^0-9]/g,''),10) || 0;
        if (qa !== qb) res.push(`VALUE ${pathPrefix}.quantity: ${String(a.quantity)} !== ${String(b.quantity)}`);
        // build item count maps, normalize names and strip Enhancement: prefix
        const itemKey = s => String(s || '').replace(/^Enhancement:\s*/i,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
        const mapA = Object.create(null);
        for (const it of (a.items||[])) {
            const k = itemKey(it && it.name);
            const q = parseInt(String(it && it.quantity || '1x').replace(/[^0-9]/g,''),10) || 0;
            if (!k) continue;
            mapA[k] = (mapA[k]||0) + q;
        }
        const mapB = Object.create(null);
        for (const it of (b.items||[])) {
            const k = itemKey(it && it.name);
            const q = parseInt(String(it && it.quantity || '1x').replace(/[^0-9]/g,''),10) || 0;
            if (!k) continue;
            mapB[k] = (mapB[k]||0) + q;
        }
        const allKeys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
        for (const k of allKeys) {
            const aCount = mapA[k] || 0;
            const bCount = mapB[k] || 0;
            if (aCount !== bCount) {
                res.push(`VALUE ${pathPrefix}.items.${k}: ${aCount} !== ${bCount}`);
            }
        }
        return res;
    }
    // Special-case: compare CHARACTER and OTHER DATASHEETS as unordered collections matched by unit name
    if (Array.isArray(a) && Array.isArray(b) && /\.CHARACTER$|\.OTHER DATASHEETS$/.test(pathPrefix)) {
        const res = [];
        const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        // Build groups by normalized unit name
        const groupsA = Object.create(null);
        const groupsB = Object.create(null);
        for (const u of a) {
            const k = norm(u && u.name) || '__';
            groupsA[k] = groupsA[k] || [];
            groupsA[k].push(u);
        }
        for (const u of b) {
            const k = norm(u && u.name) || '__';
            groupsB[k] = groupsB[k] || [];
            groupsB[k].push(u);
        }
        const allKeys = new Set([...Object.keys(groupsA), ...Object.keys(groupsB)]);
        for (const key of allKeys) {
            const arrA = groupsA[key] || [];
            const arrB = groupsB[key] || [];
            // expand units by numeric quantity so grouped '3x' can match three separate '1x' units
            const expand = (arr) => {
                const out = [];
                for (const u of arr) {
                    const n = parseInt(String(u && u.quantity || '1x').replace(/[^0-9]/g,''),10) || 1;
                    for (let k = 0; k < Math.max(1, n); k++) {
                        const copy = JSON.parse(JSON.stringify(u));
                        copy.quantity = '1x';
                        out.push(copy);
                    }
                }
                return out;
            };
            const flatA = expand(arrA);
            const flatB = expand(arrB);
            // Use an optimal minimal-cost bipartite matching (Hungarian algorithm) so
            // units with identical normalized names pair to minimize total diff cost.
            // Build cost matrix where cost[i][j] = diffLen(flatA[i], flatB[j])
            const diffLen = (x,y) => diff(x,y, `${pathPrefix}.${key}`).length;
            const NA = flatA.length;
            const NB = flatB.length;
            if (NA === 0 && NB === 0) continue;

            // If one side is empty, mark all as missing directly
            if (NA === 0) {
                for (let j = 0; j < NB; j++) res.push(`MISSING B ${pathPrefix}.${key}[${j}] (no matching unit fingerprint)`);
                continue;
            }
            if (NB === 0) {
                for (let i = 0; i < NA; i++) res.push(`MISSING A ${pathPrefix}.${key}[${i}] (no matching unit fingerprint)`);
                continue;
            }

            // Build cost matrix
            const cost = Array.from({length: NA}, () => new Array(NB).fill(0));
            for (let i = 0; i < NA; i++) {
                for (let j = 0; j < NB; j++) {
                    cost[i][j] = diffLen(flatA[i], flatB[j]);
                }
            }

            // Hungarian algorithm implementation for rectangular matrices
            // We'll implement a simple O(n^3) algorithm adapted for NA x NB by padding the smaller
            // dimension with dummy nodes that incur a high cost so they will be left unmatched.
            const n = Math.max(NA, NB);
            const INF = 1e6;
            // square matrix of size n
            const C = Array.from({length: n}, (_, i) => new Array(n).fill(INF));
            for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) C[i][j] = cost[i][j];

            // Hungarian algorithm (assignment problem) - using implementation adapted from common JS snippets
            const u = new Array(n+1).fill(0);
            const v = new Array(n+1).fill(0);
            const p = new Array(n+1).fill(0);
            const way = new Array(n+1).fill(0);
            for (let i = 1; i <= n; i++) {
                p[0] = i;
                let j0 = 0;
                const minv = new Array(n+1).fill(INF);
                const used = new Array(n+1).fill(false);
                do {
                    used[j0] = true;
                    const i0 = p[j0];
                    let delta = INF;
                    let j1 = 0;
                    for (let j = 1; j <= n; j++) if (!used[j]) {
                        const cur = C[i0-1][j-1] - u[i0] - v[j];
                        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
                    }
                    for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else { minv[j] -= delta; }
                    j0 = j1;
                } while (p[j0] !== 0);
                do {
                    const j1 = way[j0];
                    p[j0] = p[j1];
                    j0 = j1;
                } while (j0 !== 0);
            }
            const matchA = new Array(NA).fill(-1); // index in B matched to A[i]
            const matchB = new Array(NB).fill(-1); // index in A matched to B[j]
            for (let j = 1; j <= n; j++) {
                if (p[j] <= NA && j <= NB) {
                    const ai = p[j]-1;
                    const bj = j-1;
                    if (ai < NA && bj < NB && C[ai][bj] < INF/2) {
                        matchA[ai] = bj;
                        matchB[bj] = ai;
                    }
                }
            }

            // Emit diffs for matched pairs, and report unmatched leftovers
            for (let i = 0; i < NA; i++) {
                const pa = `${pathPrefix}.${key}[${i}]`;
                const bj = matchA[i];
                if (bj === -1) {
                    res.push(`MISSING A ${pa} (no matching unit fingerprint)`);
                } else {
                    const pairDiffs = diff(flatA[i], flatB[bj], `${pathPrefix}.${key}[${i}]`);
                    for (const d of pairDiffs) res.push(d.replace(`${pathPrefix}.${key}`, `${pathPrefix}.${key}[${i}]`));
                }
            }
            for (let j = 0; j < NB; j++) {
                if (matchB[j] === -1) res.push(`MISSING B ${pathPrefix}.${key}[${j}] (no matching unit fingerprint)`);
            }
        }
        return res;
    }

    // Special-case: when comparing arrays of items under a unit (path ending with '.items'),
    // treat them as unordered collections matched by item.name so item ordering doesn't cause diffs.
    if (Array.isArray(a) && Array.isArray(b) && pathPrefix.endsWith('.items')) {
        const res = [];
        const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const bUsed = new Array(b.length).fill(false);
        for (let i = 0; i < a.length; i++) {
            const ia = a[i];
            const nameA = norm(ia && ia.name);
            let matchedIndex = -1;
            for (let j = 0; j < b.length; j++) {
                if (bUsed[j]) continue;
                const ib = b[j];
                const nameB = norm(ib && ib.name);
                if (nameA && nameA === nameB) { matchedIndex = j; break; }
            }
            const pa = `${pathPrefix}[${i}]`;
            if (matchedIndex === -1) {
                res.push(`MISSING A ${pa} (no matching item by name)`);
            } else {
                bUsed[matchedIndex] = true;
                res.push(...diff(ia, b[matchedIndex], `${pathPrefix}.${nameA || i}`));
            }
        }
        for (let j = 0; j < b.length; j++) {
            if (!bUsed[j]) res.push(`MISSING B ${pathPrefix}[${j}] (no matching item by name)`);
        }
        return res;
    }

    const keys = new Set([...Object.keys(a||{}), ...Object.keys(b||{})]);
    const res = [];
    for (const k of keys) {
        if (k.startsWith('_')) continue;
        const pa = pathPrefix ? `${pathPrefix}.${k}` : k;
        if (!(k in a)) { res.push(`MISSING A ${pa}`); continue; }
        if (!(k in b)) { res.push(`MISSING B ${pa}`); continue; }
        res.push(...diff(a[k], b[k], pa));
    }
    return res;
}

const nrnrLines = readSample('NRNRsample.txt');
const wtcLines = readSample('WTCCompactSample.txt');
if (!nrnrLines) { console.error('NRNRsample.txt not found'); process.exit(2); }
if (!wtcLines) { console.error('WTCCompactSample.txt not found'); process.exit(2); }

const nrnr = parseNrNr(nrnrLines);
const wtc = parseWtcCompact(wtcLines);

const nn = normalize(nrnr);
const ww = normalize(wtc);

const diffs = diff(nn, ww, 'ROOT');
if (diffs.length === 0) {
    console.log('No differences found: NRNR and WTC outputs match under the normalization rules.');
    process.exit(0);
}
console.log('Differences found:');
for (const d of diffs) console.log(' -', d);
process.exit(1);
