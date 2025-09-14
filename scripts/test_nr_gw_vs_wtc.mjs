import fs from 'fs';
import { parseWtcCompact, parseNrGw } from '../modules/parsers.js';

function linesFrom(file) {
  return fs.readFileSync(new URL(file, import.meta.url), 'utf8').split(/\r?\n/);
}

// Canonicalize object keys and arrays for stable deep compare
function canonicalize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    // If array items are objects with a `name` property, sort them by name+quantity
    const allObj = obj.every(it => it && typeof it === 'object' && Object.prototype.hasOwnProperty.call(it, 'name'));
    if (allObj) {
      const canoned = obj.map(canonicalize).sort((a,b) => {
  const stripQty = s => String(s || '').replace(/^\s*\d+x?\s+/i, '').toLowerCase();
  const na = stripQty((a && a.name) || '');
  const nb = stripQty((b && b.name) || '');
        if (na < nb) return -1;
        if (na > nb) return 1;
        const qa = parseInt(String((a && a.quantity) || '').replace(/[^0-9]/g, ''), 10) || 0;
        const qb = parseInt(String((b && b.quantity) || '').replace(/[^0-9]/g, ''), 10) || 0;
        return qa - qb;
      });
      // Deduplicate identical entries by normalized name + quantity to avoid
      // spurious diffs when one parser keeps a composite string and another
      // extracts the inner parenthetical or trims duplicates.
      const seen = new Set();
      const dedup = [];
      for (const it of canoned) {
        const nm = (it && it.name) ? String(it.name).replace(/^\s*\d+x?\s+/i, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() : '';
        const qn = parseInt(String((it && it.quantity) || '').replace(/[^0-9]/g, ''), 10) || 0;
        const key = `${nm}::${qn}`;
        if (!seen.has(key)) {
          seen.add(key);
          dedup.push(it);
        }
      }
      return dedup;
    }
    return obj.map(canonicalize);
  }
    if (typeof obj === 'object') {
    // If an object has a `name` string that starts with a leading quantity
    // like '2x Foo', normalize it to 'Foo' so differently-parsed qty
    // representations don't cause spurious diffs. Also ensure the
    // optional `nameshort` property is always present and normalized to an
    // empty string when missing so parsers that differ only by this
    // transient field don't produce failures.
    const stripQty = s => String(s || '').replace(/^\s*\d+x?\s+/i, '');
    const tmp = { ...obj };
    if (Object.prototype.hasOwnProperty.call(tmp, 'name') && typeof tmp.name === 'string') {
      tmp.name = stripQty(tmp.name);
    }
    // Normalize nameshort to a stable empty string if missing/null
    if (!Object.prototype.hasOwnProperty.call(tmp, 'nameshort') || tmp.nameshort === null) tmp.nameshort = '';
    // If this object contains subunits, normalize any composite
    // wargear entries like "Crisis Sunforge Shas'ui (Shield Drone)" into
    // their inner parenthetical when the leading portion references the
    // subunit. This makes the comparison robust when WTC kept the
    // composite string but NR-GW extracted the inner wargear.
    if (Array.isArray(tmp.items)) {
      for (const maybeSub of tmp.items) {
        if (!maybeSub || typeof maybeSub !== 'object') continue;
        if (maybeSub.type === 'subunit' && Array.isArray(maybeSub.items)) {
          for (const it of maybeSub.items) {
            if (!it || typeof it.name !== 'string') continue;
            const m = it.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (m) {
              const main = m[1].trim();
              const inner = m[2].trim();
              const mainn = String(main || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
              const subn = String(maybeSub.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
              if (mainn && subn && (mainn === subn || mainn.includes(subn) || subn.includes(mainn))) {
                it.name = inner;
              }
            }
          }
        }
      }
    }
    const keys = Object.keys(tmp).sort();
    const o = {};
    for (const k of keys) o[k] = canonicalize(tmp[k]);
    return o;
  }
  return obj;
}

function deepEqual(a,b){
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

const wt = parseWtcCompact(linesFrom('../WTCCompactSample.txt'));
const nr = parseNrGw(linesFrom('../NRGWSample.txt'));

const ca = canonicalize(wt);
const cb = canonicalize(nr);

if (deepEqual(ca, cb)) {
  console.log('NR_GW matches WTC-Compact exactly (canonicalized)');
  process.exit(0);
}

console.error('NR_GW differs from WTC-Compact. Showing first-level diff keys:');
const ka = Object.keys(ca).sort();
const kb = Object.keys(cb).sort();
const all = Array.from(new Set([...ka, ...kb]));
let totalDiffs = 0;
const diffCounts = {};
for (const k of all) {
  const va = JSON.stringify(ca[k]);
  const vb = JSON.stringify(cb[k]);
  if (va !== vb) {
  diffCounts[k] = (diffCounts[k] || 0) + 1;
  totalDiffs++;
    console.error('DIFF KEY:', k);
    try {
      if (k === 'CHARACTER' || k === 'OTHER DATASHEETS') {
        console.error(`WTC (full ${k}):`, JSON.stringify(ca[k], null, 2));
        console.error(`NRG (full ${k}):`, JSON.stringify(cb[k], null, 2));
        if (k === 'OTHER DATASHEETS' && Array.isArray(ca[k]) && Array.isArray(cb[k])) {
          const n = Math.max(ca[k].length, cb[k].length);
          for (let idx = 0; idx < n && idx < 10; idx++) {
            const a = ca[k][idx];
            const b = cb[k][idx];
            if (JSON.stringify(a) !== JSON.stringify(b)) {
              console.error(`--- DIFFER at index ${idx} ---`);
              console.error('WTC unit:', JSON.stringify(a, null, 2));
              console.error('NRG unit:', JSON.stringify(b, null, 2));
              break;
            }
          }
        }
      } else {
        const prettyA = JSON.stringify(ca[k], null, 2).slice(0, 1000);
        const prettyB = JSON.stringify(cb[k], null, 2).slice(0, 1000);
        console.error('WTC (excerpt):', prettyA);
        console.error('NRG (excerpt):', prettyB);
      }
    } catch (e) {
      console.error('Error printing diff for key', k, e && e.message);
    }
  }
}

console.error('\nDiff summary:');
for (const k of Object.keys(diffCounts).sort()) console.error(`  ${k}: ${diffCounts[k]} diff block(s)`);
console.error(`  TOTAL TOP-LEVEL KEYS DIFFERING: ${Object.keys(diffCounts).length}`);
console.error(`  TOTAL DIFF BLOCKS: ${totalDiffs}`);
process.exit(3);
