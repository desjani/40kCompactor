import { getIndent, normalizeForComparison, parseItemString, sortItemsByQuantityThenName } from '../utils.js';
import FAMILY_MAP from '../family_map.js';
import { standardizeSummary } from '../summary.js';

// For simplicity and to avoid cross-parser dependencies, reimplement a minimal
// GW-style body parser here (subset of parseGwAppV2) so NR-GW parser is fully
// independent. This intentionally duplicates logic to satisfy the user's
// requirement that parsers don't depend on each other.

function smartTitleCase(s) {
    if (!s) return '';
    const small = new Set(['of','and','the','in','to','with','for','on','a','an','by','from']);
    return String(s).split(/\s+/).map((w, idx) => {
        if (!w) return '';
        const lw = w.toLowerCase();
        if (idx > 0 && small.has(lw)) return lw;
        return lw[0].toUpperCase() + lw.slice(1);
    }).join(' ');
}

function addItemToTarget(target, itemString, unitContextName, factionKeyword, unitTopName = '', skipIfMatchesUnitName = false, itemType = 'wargear', parentQuantity = 1) {
    if (!target) return;
    target.items = target.items || [];
    const parsed = parseItemString(String(itemString || '').trim());
    const parsedQty = parsed.quantity ? String(parsed.quantity) : '1x';
    const parsedQtyN = parseInt(String(parsedQty || '1x').replace(/[^0-9]/g, ''), 10) || 1;
    const qty = `${parsedQtyN * (parentQuantity || 1)}x`;
    let name = parsed.name || '';
    // If the item is formatted like "<UnitName> (Wargear)" and the caller
    // did not request skip-if-matches, we can extract the parenthetical
    // immediately. When skipIfMatchesUnitName is true we leave the raw name
    // intact so the skip-logic can decide whether to materialize or skip
    // the parenthetical (avoids double-counting when an explicit item is
    // also present on the same line).
    if (!skipIfMatchesUnitName) {
        try {
            const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (parenMatch) {
                const main = parenMatch[1].trim();
                const inner = parenMatch[2].trim();
                const mainn = normalizeForComparison(main);
                const ctxn = normalizeForComparison(unitContextName || '');
                const topn = normalizeForComparison(unitTopName || '');
                if (mainn && (mainn === ctxn || mainn === topn || ctxn.startsWith(mainn + ' ') || topn.startsWith(mainn + ' ') || mainn.startsWith(ctxn + ' ') || mainn.startsWith(topn + ' '))) {
                    name = inner;
                }
            }
        } catch (e) {
            // ignore
        }
    }
    const key = normalizeForComparison(name);
    if (skipIfMatchesUnitName) {
        const ctx = String(unitContextName || '');
        const top = String(unitTopName || '');
    const nn = normalizeForComparison(name);
    const ctxn = normalizeForComparison(ctx);
    const topn = normalizeForComparison(top);
    const startsWithCtx = ctxn && nn.startsWith(ctxn + ' ');
    const startsWithTop = topn && nn.startsWith(topn + ' ');
    if (ctxn && (nn === ctxn || startsWithCtx) || (topn && (nn === topn || startsWithTop))) {
            // Special case: if the string is like "<UnitName> (Some Wargear)",
            // prefer to extract the parenthetical as the wargear name and add
            // that instead of silently skipping. This covers NR-GW style where
            // authors append "(Shield Drone)" to the subunit name.
            const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (parenMatch) {
                const main = parenMatch[1].trim();
                const inner = parenMatch[2].trim();
                const mainn = normalizeForComparison(main);
                if (mainn === ctxn || mainn === topn || mainn.startsWith(ctxn + ' ') || mainn.startsWith(topn + ' ')) {
                    // If a subunit-style parenthetical appears in a comma list
                    // (e.g. "Crisis Sunforge Shas'ui (Shield Drone)") the WTC-Compact
                    // parser historically kept the composite string as an
                    // explicit wargear entry. To match that canonical output,
                    // add the composite name here rather than only adding the
                    // inner parenthetical. We still avoid adding it if a
                    // deferred parenthetical for the same inner name was
                    // recorded on the target to prevent duplicates.
                    if (target && target._deferredParenthetical && normalizeForComparison(target._deferredParenthetical) === normalizeForComparison(inner)) {
                        return;
                    }
                    // Prefer to extract the inner parenthetical as the wargear
                    // (e.g. '... (Shield Drone)' -> 'Shield Drone') to match the
                    // WTC-Compact canonical output. Avoid adding if a deferred
                    // parenthetical or an explicit identical item already exists.
                    if (target && target._deferredParenthetical && normalizeForComparison(target._deferredParenthetical) === normalizeForComparison(inner)) {
                        return;
                    }
                    const alreadyPresentInner = (target.items || []).some(it => normalizeForComparison(it.name || '') === normalizeForComparison(inner));
                    if (alreadyPresentInner) return;
                    addItemToTarget(target, inner, unitContextName, factionKeyword, unitTopName, false, itemType, parsedQtyN);
                    return;
                }
            }
            return;
        }
    }
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
        const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
        const addQ = parseInt(String(qty || '1x').replace(/x/i, ''), 10) || 0;
        existing.quantity = `${exQ + addQ}x`;
    } else {
        const forcedType = (normalizeForComparison(name) === 'warlord') ? 'special' : itemType;
        target.items.push({ quantity: qty, name: name, items: [], type: forcedType, nameshort: '' });
    }
}

function parseAndAddEnhancement(content, target, factionKeyword) {
    if (!content || !target) return;
    target.items = target.items || [];
    const raw = content.trim();
    const mPts = raw.match(/\(([^)]+)\)$/);
    const pts = mPts ? ` (${mPts[1]})` : '';
    const base = raw.replace(/\s*\([^)]+\)$/, '').trim();
    const normBase = normalizeForComparison(base);
    const already = (target.items || []).some(it => it && it.type === 'special' && normalizeForComparison((it.name || '').replace(/^Enhancement:\s*/i, '')) === normBase);
    if (already) return;
    const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
    const nameshort = `E: ${abbr}${pts}`.trim();
    const item = { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
    target.items.push(item);
}

// Minimal GW body parser (subset) used by NR-GW
function parseGwLikeBody(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i;
    // Capture optional inline items after the points, e.g. "(... pts): item, item"
    const unitLineRegex = /^(.*?)\s*\(([\d,\.\s]+)\s*(?:pts|points)\)\s*(?::\s*(.*))?$/i;
    const bulletRegex = /^\s*(?:•|\-|\+|◦)\s*(.*)$/;

    let currentSection = null;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (sectionHeaderRegex.test(trimmed.toUpperCase())) {
            currentSection = /^CHARACTERS?/i.test(trimmed) ? 'CHARACTER' : 'OTHER DATASHEETS';
            continue;
        }
        const m = trimmed.match(unitLineRegex);
        if (m) {
            const nameRaw = m[1].trim();
            const pts = parseInt(String(m[2]).replace(/[\,\.\s]/g, ''), 10) || 0;
            let quantity = '1x';
            let unitName = nameRaw;
            const leadingQty = nameRaw.match(/^([0-9]+x?)\s+(.*)$/i);
            if (leadingQty) { quantity = leadingQty[1].toLowerCase(); unitName = leadingQty[2].trim(); }
            const unit = { quantity, name: unitName, points: pts, items: [], isComplex: false, nameshort: '' };
            const sectionKey = currentSection === 'CHARACTER' ? 'CHARACTER' : 'OTHER DATASHEETS';
            result[sectionKey] = result[sectionKey] || [];
            result[sectionKey].push(unit);

            // If inline items were present on the same line (after colon), parse and add them
            const inlineText = m[3] || '';
                if (inlineText) {
                    inlineText.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(unit, it, unit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true));
                }

            const blockLines = [];
            let j = i + 1;
            while (j < lines.length) {
                const l = lines[j] || '';
                if (!l.trim()) break;
                if (sectionHeaderRegex.test(l.trim().toUpperCase())) break;
                if (unitLineRegex.test(l.trim())) break;
                // Allow bullet lines at column 0 (no leading whitespace). Some
                // NR-GW exports place bullets at column 0; treat those as
                // part of the unit block instead of terminating it.
                if (!/^\s+/.test(l) && !bulletRegex.test(l)) break;
                blockLines.push(l);
                j++;
            }

            const blockIsComplex = (() => {
                for (let bi = 0; bi < blockLines.length; bi++) {
                    const line = blockLines[bi];
                    const b = line.match(bulletRegex);
                    if (!b) continue;
                    const indent = getIndent(line);
                    for (let k = bi + 1; k < blockLines.length; k++) {
                        const child = blockLines[k];
                        if (!child.trim()) break;
                        const childIndent = getIndent(child);
                        if (childIndent <= indent) break;
                        if (bulletRegex.test(child)) return true;
                    }
                }
                return false;
            })();

            let currentSubunit = null;
            let currentSubIndent = 0;
            for (let bi = 0; bi < blockLines.length; bi++) {
                const line = blockLines[bi];
                const t = line.trim();
                const b = line.match(bulletRegex);
                const indent = getIndent(line);
                if (b) {
                    const content = b[1].trim();
                    const enhancementLike = content.match(/^(.*?)\s*\(\+?\s*\d+\s*(?:pts?|points)\)\s*$/i);
                    if (/^Enhancement:/i.test(content)) {
                        parseAndAddEnhancement(content.replace(/^Enhancement:\s*/i, '').trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    } else if (enhancementLike) {
                        parseAndAddEnhancement(content.trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    }
                    if (blockIsComplex) {
                        if (currentSubunit && typeof currentSubIndent === 'number' && indent > currentSubIndent) {
                                const parts = content.split(',').map(s => s.trim()).filter(Boolean);
                                // Pre-scan to detect parenthetical parts that reference
                                // the subunit name; if both an explicit inner and the
                                // parenthetical appear, only add the inner once.
                                for (let p of parts) {
                                    const pm = p.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
                                    if (pm) {
                                        const main = pm[1].trim();
                                        const inner = pm[2].trim();
                                        if (normalizeForComparison(main) === normalizeForComparison(currentSubunit.name)) {
                                            // If another part already mentions the inner name,
                                            // skip this parenthetical to avoid doubling.
                                            const explicitExists = parts.some(x => normalizeForComparison(x) === normalizeForComparison(inner));
                                            const alreadyPresent = (currentSubunit.items || []).some(it => normalizeForComparison(it.name || '') === normalizeForComparison(inner));
                                            if (explicitExists || alreadyPresent) {
                                                // skip adding this parenthetical
                                                continue;
                                            }
                                            // Otherwise, add the inner parenthetical as the item
                                            const parsed = parseItemString(p);
                                            const parsedQtyN = parseInt(String(parsed.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 1;
                                            addItemToTarget(currentSubunit, inner, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, false, 'wargear', parsedQtyN);
                                            continue;
                                        }
                                    }
                                    addItemToTarget(currentSubunit, p, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true);
                                }
                            continue;
                        }
                        currentSubunit = null;
                        const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
                        const subQty = subMatch ? subMatch[1] : '1x';
                        let subName = subMatch ? subMatch[2].trim() : content;
                        // If subName contains a parenthetical and the leading portion
                        // matches the unit/top context, treat the parenthetical as
                        // wargear and attach it to the subunit (with the subunit qty).
                        try {
                            const pm = subName.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
                            if (pm) {
                                const main = pm[1].trim();
                                const inner = pm[2].trim();
                                const mainn = normalizeForComparison(main);
                                const unitn = normalizeForComparison(unit.name || '');
                                const topn = normalizeForComparison(unitTopName || unit.name || '');
                                if (mainn && (mainn === unitn || unitn.startsWith(mainn) || mainn.startsWith(unitn) || topn.startsWith(mainn) || mainn.startsWith(topn))) {
                                    subName = main;
                                    const subunitTemp = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                                    // defer adding the parenthetical until later to avoid
                                    // duplicating an explicitly-listed Shield Drone etc.
                                    subunitTemp._deferredParenthetical = inner;
                                    subunitTemp._deferredParentheticalQty = parseInt(String(subQty || '1x').replace(/[^0-9]/g, ''), 10) || 1;
                                    unit.items = unit.items || [];
                                    unit.items.push(subunitTemp);
                                    currentSubunit = subunitTemp;
                                    currentSubIndent = indent;
                                    continue;
                                }
                            }
                        } catch (e) {}
                        const subunit = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                        unit.items = unit.items || [];
                        unit.items.push(subunit);
                        currentSubunit = subunit;
                        currentSubIndent = indent;
                        continue;
                    }
                    addItemToTarget(unit, content, unit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
                    continue;
                }
                if (currentSubunit && indent > currentSubIndent) {
                    addItemToTarget(currentSubunit, t, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true);
                    continue;
                }
                addItemToTarget(unit, t, unit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
            }

            i = j - 1;
            continue;
        }
    }

    function ensurePropsLocal(obj, parentName) {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj.name !== 'string') obj.name = '';
        if (typeof obj.quantity !== 'string') obj.quantity = obj.quantity ? String(obj.quantity) : '1x';
        if (typeof obj.type !== 'string') obj.type = obj.type || 'wargear';
        if (typeof obj.nameshort !== 'string') obj.nameshort = obj.nameshort || '';
        if (!Array.isArray(obj.items)) obj.items = [];
        if (/^Enhancement:/i.test(obj.name)) {
            const content = obj.name.replace(/^Enhancement:\s*/i, '').trim();
            obj.type = 'special';
            obj.nameshort = obj.nameshort || (() => {
                const m = content.match(/\(([^)]+)\)$/);
                const pts = m ? ` (${m[1]})` : '';
                const base = content.replace(/\s*\([^)]+\)$/, '').trim();
                const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
                return `E: ${abbr}${pts}`.trim();
            })();
            obj.name = `Enhancement: ${smartTitleCase(content.replace(/\s*\([^)]+\)$/, '').trim())}`;
        } else {
            obj.name = parentName ? obj.name : smartTitleCase(obj.name);
        }
        if (normalizeForComparison(obj.name) === 'warlord') obj.type = 'special';
        obj.items = (obj.items || []).map(it => {
            if (!it) return null;
        if (typeof it === 'string') {
            const coerced = { quantity: '1x', name: it.trim(), items: [], type: /^Enhancement:/i.test(it) ? 'special' : 'wargear', nameshort: '' };
            ensurePropsLocal(coerced, obj.name);
            // Preserve original casing for nested item names to match WTC-Compact output
            return coerced;
            }
            ensurePropsLocal(it, obj.name);
            // Do not title-case nested item names here; top-level unit names
            // are handled above via parentName logic.
            return it;
        }).filter(Boolean);
    }

    for (const sectionKey of ['CHARACTER', 'OTHER DATASHEETS']) {
        if (!Array.isArray(result[sectionKey])) continue;
        for (const unit of result[sectionKey]) {
            ensurePropsLocal(unit);
            const subunits = (unit.items || []).filter(it => it && it.type === 'subunit');
                if (subunits.length > 0) {
                    const allSameName = subunits.every(s => normalizeForComparison(s.name || '') === normalizeForComparison(unit.name || ''));
                    if (allSameName) {
                        const agg = new Map();
                        let total = 0;
                        for (const su of subunits) {
                            const q = parseInt(String(su.quantity || '1x').replace(/x/i, ''), 10) || 1;
                            total += q;
                            for (const inner of (su.items || [])) {
                                const temp = { items: [] };
                                addItemToTarget(temp, `${inner.quantity || '1x'} ${inner.name}`, unit.name, result.SUMMARY.FACTION_KEYWORD || '', inner.type || 'wargear', 1);
                                for (const it of temp.items) {
                                    const key = normalizeForComparison(it.name || '');
                                    if (agg.has(key)) {
                                        const ex = agg.get(key);
                                        const exq = parseInt(String(ex.quantity || '1x').replace(/x/i, ''), 10) || 0;
                                        const addq = parseInt(String(it.quantity || '1x').replace(/x/i, ''), 10) || 0;
                                        ex.quantity = `${exq + addq}x`;
                                    } else {
                                        agg.set(key, it);
                                    }
                                }
                            }
                        }
                        unit.items = Array.from(agg.values());
                        if (total > 0) unit.quantity = `${total}x`;
                        // Keep isComplex false to match WTC-Compact parser's representation
                        unit.isComplex = false;
                    } else {
                        const total = subunits.reduce((acc, it) => acc + (parseInt(String(it.quantity || '1x').replace(/x/i, ''), 10) || 0), 0);
                        if (total > 0) unit.quantity = `${total}x`;
                        // Even when subunits have different names, represent the unit
                        // as not-complex to match the WTC-Compact parser output (pre-existing
                        // golden reference).
                        unit.isComplex = false;
                    }
            } else {
                unit.isComplex = false;
            }
            // If a unit contains exactly one subunit entry, but that subunit
            // itself only contains wargear items, flatten it into the parent
            // so it matches WTC-Compact's inline-item representation (many NR-GW
            // exports place the subunit as a separate bullet while WTC-Compact
            // places the wargear inline on the unit line).
            if (Array.isArray(unit.items) && unit.items.length === 1 && unit.items[0] && unit.items[0].type === 'subunit') {
                const su = unit.items[0];
                if (Array.isArray(su.items) && su.items.length > 0) {
                    unit.items = su.items.slice();
                    unit.isComplex = false;
                }
            }
            // NR-GW format already provides fully calculated item quantities.
            // Do not adjust item quantities based on subunit size.
            // Ensure deterministic ordering of top-level items and subunit items
            if (Array.isArray(unit.items) && unit.items.length > 0) sortItemsByQuantityThenName(unit.items);
            const subsAfter = (unit.items || []).filter(it => it && it.type === 'subunit');
            for (const su of subsAfter) if (Array.isArray(su.items) && su.items.length > 0) sortItemsByQuantityThenName(su.items);
        }
    }

    standardizeSummary(result);
    return result;
}

export function parseNrGw(lines) {
    if (!Array.isArray(lines)) return parseGwLikeBody(lines);
    const headerLines = [];
    let i = 0;
    for (; i < lines.length; i++) {
        const raw = String(lines[i] || '');
        const t = raw.trim();
        if (!t) { headerLines.push(t); continue; }
        if (t.startsWith('+') || t.startsWith('&')) { headerLines.push(t); continue; }
        break;
    }
    const headerEnhancements = [];
    const parsedSummary = {};
    for (const hl of headerLines) {
        if (!hl) continue;
        if (hl.startsWith('&')) {
            const v = hl.replace(/^&\s*/, '');
            const m = v.match(/^(.*?)\s*\(on\s+(?:(Char\d+):\s*)?(.*)\)$/i);
            if (m) {
                headerEnhancements.push({ enh: m[1].trim(), target: (m[3] || '').trim(), charId: m[2] || null });
            }
            continue;
        }
        const line = hl.replace(/^\+\s*/, '');
        const m = line.match(/^([^:]+):\s*(.*)$/);
        if (m) {
            const key = m[1].trim().toUpperCase();
            const val = m[2].trim();
            if (key === 'ENHANCEMENT') {
                const m2 = val.match(/^(.*?)\s*\(on\s+(?:(Char\d+):\s*)?(.*)\)$/i);
                if (m2) headerEnhancements.push({ enh: m2[1].trim(), target: (m2[3] || '').trim(), charId: m2[2] || null });
                else headerEnhancements.push({ enh: val, target: null, charId: null });
            } else if (key === 'FACTION KEYWORD') {
                const parts = val.split(' - ');
                parsedSummary.faction = parts[parts.length - 1].trim();
            } else if (key === 'DETACHMENT') {
                parsedSummary.detachment = val.replace(/\u00A0/g, ' ');
            } else if (key === 'TOTAL ARMY POINTS') {
                parsedSummary.points = val;
            }
        }
    }

    // Preprocess body like earlier implementation
    const rawBody = lines.slice(i);
    const bodyLines = [];
    for (const L of rawBody) {
        if (!L) { bodyLines.push(L); continue; }
        let line = String(L);
        line = line.replace(/^\s*Char\d+:\s*/i, '');
        const m = line.match(/^(.*\))\s*:\s*(.+)$/);
        if (m) {
            bodyLines.push(m[1]);
            bodyLines.push('  • ' + m[2]);
        } else {
            bodyLines.push(line);
        }
    }

    const bodyResult = parseGwLikeBody(bodyLines);
    bodyResult.SUMMARY = bodyResult.SUMMARY || {};
    if (parsedSummary.faction) bodyResult.SUMMARY.FACTION_KEYWORD = parsedSummary.faction;
    if (parsedSummary.detachment) bodyResult.SUMMARY.DETACHMENT = parsedSummary.detachment;
    if (parsedSummary.points) bodyResult.SUMMARY.TOTAL_ARMY_POINTS = parsedSummary.points;

    const allUnits = [...(bodyResult.CHARACTER || []), ...(bodyResult['OTHER DATASHEETS'] || [])];
    // Helper to determine if an enhancement already exists anywhere in parsed body
    const enhancementExistsAnywhere = (enhName) => {
        const normTarget = normalizeForComparison(String(enhName || ''));
        for (const u of allUnits) {
            const items = (u && Array.isArray(u.items)) ? u.items : [];
            for (const it of items) {
                if (!it || !it.name) continue;
                const base = String(it.name || '').replace(/^Enhancement:\s*/i, '').replace(/\s*\([^)]*\)\s*$/,'').trim();
                if (normalizeForComparison(base) === normTarget) return true;
            }
        }
        return false;
    };
    for (const he of headerEnhancements) {
        if (!he || !he.enh) continue;
        // If body already contains this enhancement anywhere, skip header injection to avoid duplication
        if (enhancementExistsAnywhere(he.enh)) continue;
        let found = null;
        const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        // Prefer absolute character index (CharN) when present. If out-of-range,
        // fall back to fuzzy `target` matching.
        if (he.charId) {
            const idx = parseInt(String(he.charId).replace(/[^0-9]/g, ''), 10);
            if (!Number.isNaN(idx) && idx > 0) {
                if (Array.isArray(bodyResult.CHARACTER) && bodyResult.CHARACTER[idx - 1]) {
                    found = bodyResult.CHARACTER[idx - 1];
                }
            }
        }
        if (!found && he.target) {
            found = allUnits.find(u => normalize(u.name).includes(normalize(he.target)) || normalize(`${u.quantity} ${u.name}`).includes(normalize(he.target)));
        }
        if (!found && allUnits.length === 1) found = allUnits[0];
        if (found) parseAndAddEnhancement(he.enh, found, bodyResult.SUMMARY.FACTION_KEYWORD || '');
    }

    // Preserve top-level units as-is (do not merge duplicates). Previously we
    // collapsed repeated units with the same name/points; that loses per-entry
    // distinctions (e.g., three separate Riptide Battlesuit entries). Keep the
    // array order and entries intact.

    try {
        for (const sectionKey of ['CHARACTER', 'OTHER DATASHEETS']) {
            const arr = bodyResult[sectionKey];
            if (!Array.isArray(arr)) continue;
            for (const unit of arr) {
                if (unit && typeof unit === 'object') {
                    if (Object.prototype.hasOwnProperty.call(unit, 'type')) delete unit.type;
                }
            }
        }
        // Materialize any deferred parenthetical wargear that was captured
        // when subunits had a parenthetical like "UnitName (Shield Drone)".
        // We defer adding the parenthetical until after child items are
        // processed so we don't duplicate an explicitly-listed item.
        for (const sectionKey of ['CHARACTER', 'OTHER DATASHEETS']) {
            const arr = bodyResult[sectionKey];
            if (!Array.isArray(arr)) continue;
            for (const unit of arr) {
                if (!unit || !Array.isArray(unit.items)) continue;
                for (const su of unit.items.filter(it => it && it.type === 'subunit')) {
                    if (su && su._deferredParenthetical) {
                            // Trim deferred parenthetical wargear: when a subunit name
                            // contained a parenthetical like "UnitName (Thing)", treat
                            // the parenthetical as a duplicate and do not materialize
                            // it as a separate wargear entry. This avoids adding or
                            // duplicating items that are effectively the same as the
                            // unit/subunit name in NR-GW exports.
                            try {
                                delete su._deferredParenthetical;
                                delete su._deferredParentheticalQty;
                            } catch (e) { /* ignore */ }
                        }
                }
            }
        }
    } catch (e) { /* ignore */ }

    standardizeSummary(bodyResult);
    return bodyResult;
}
