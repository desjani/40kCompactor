import { normalizeForComparison, parseItemString, sortItemsByQuantityThenName } from '../utils.js';

import FAMILY_MAP from '../family_map.js';
import { standardizeSummary } from '../summary.js';

function addItemToTarget(target, itemString, unitContextName, factionKeyword, unitTopName = '', skipIfMatchesUnitName = false, itemType = 'wargear') {
    if (!target) return;
    target.items = target.items || [];
    const raw = String(itemString || '').trim();
    // Aggressive debug: log when processing the combined bullet that includes support/beacon/marker
    if (/battlesuit support system|homing beacon|marker drone/i.test(raw)) {
        try { PARSE_DEBUG.push(`processing raw=${raw} for target=${target && target.name}`); } catch (e) {}
    }
    // split comma-joined wargear into multiple entries and dedupe normalized names
    let parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    try {
        const seen = new Set();
        parts = parts.filter(p => {
            const n = normalizeForComparison(normalizeNameCasing(normalizeDroneName(p)));
            if (seen.has(n)) return false;
            seen.add(n);
            return true;
        });
    } catch (e) {}
    // Trace part splitting for Stealth Battlesuits so we can see which pieces are processed
    try {
        if (/stealth shas'vre|stealth battlesuits/i.test((target && target.name || '') + (unitTopName || '') + raw)) {
            PARSE_DEBUG.push(`splitParts target=${target && target.name} top=${unitTopName} parts=${JSON.stringify(parts)}`);
        }
    } catch (e) {}
    if (parts.length > 1) {
        parts.forEach(p => addItemToTarget(target, p, unitContextName, factionKeyword, unitTopName, skipIfMatchesUnitName, itemType));
        return;
    }
    const parsed = parseItemString(raw);
    // Detect whether the parsed item string contained an explicit quantity
    const hasExplicitQty = (parsed.quantity !== undefined && parsed.quantity !== null);
    let qty = hasExplicitQty ? String(parsed.quantity) : '1x';
    let name = parsed.name || '';
    // Normalize common drone/support name variants and apply consistent casing
    try { name = normalizeNameCasing(normalizeDroneName(name)); } catch (e) {}
    // More detailed debug traces for subunit wargear to diagnose missing items
    const debugInteresting = /battlesuit support system|homing beacon|marker drone/i;
    // Debugging: record when key subunit wargear is processed (helpful during tests)
    try {
        const ln = name.toLowerCase();
        if (ln.includes('battlesuit support system') || ln.includes('homing beacon') || ln.includes('marker drone')) {
            try { PARSE_DEBUG.push(`addItemToTarget target=${target && target.name} raw=${raw}`); } catch (e) {}
        }
    } catch (e) {}
    // Normalize names like '4x Fusion blaster' that sometimes appear as name rather than quantity
    const extraQtyMatch = name.match(/^(\d+)x\s+(.*)$/i);
    if (extraQtyMatch) {
        const ex = parseInt(extraQtyMatch[1], 10) || 1;
        const baseQ = parseInt(String(qty || '1x').replace(/x/i, ''), 10) || 1;
        // Multiply quantities: e.g., "1x 4x Fusion blaster" => 4x
        qty = `${Math.max(1, baseQ * ex)}x`;
        name = extraQtyMatch[2];
    }
    try { PARSE_DEBUG.push(`PARSE_QTY name=${name} parsedQtyRaw=${String(parsed.quantity||'')} qtyToken=${qty}`); } catch(e) {}
    // Use the parsed quantity as the effective per-(sub)unit quantity.
    // If the target is a subunit with its own quantity (e.g., '2x'), multiply
    // the item's effective quantity so the stored item totals match the
    // compact parser's per-subunit totals.
    let parsedQty = (n => isNaN(n) ? 1 : n)(parseInt(String(qty || '1x').replace(/x/i, ''), 10));
    let effectiveQty = parsedQty;
    try {
        if (target && target.type === 'subunit') {
            const parentQty = parseInt(String(target.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 1;
            try { PARSE_DEBUG.push(`CALC_EFFECTIVE target=${target && target.name} parentQty=${parentQty} parsedQty=${parsedQty} hasExplicit=${hasExplicitQty}`); } catch(e) {}
            // If the item had an explicit quantity in the source (hasExplicitQty),
            // use that number as the per-subunit total. Otherwise (no explicit
            // quantity), assume the item is present once per model in the
            // subunit so the per-subunit total equals the subunit quantity.
            effectiveQty = hasExplicitQty ? parsedQty : parentQty;
            try { PARSE_DEBUG.push(`EFFECTIVE_QTY target=${target && target.name} effectiveQty=${effectiveQty}`); } catch(e) {}
        }
    } catch (e) {}
    // Keep quantity in the `quantity` field and the raw name normalized.
    // Do NOT include an Nxx prefix in the display name. Quantity is stored
    // in the `quantity` property (e.g., "9x") and the item name should be
    // the plain wargear name (e.g., "Bolt Pistol").
    const displayName = name;
    const key = normalizeForComparison(name);
    if (skipIfMatchesUnitName) {
        const ctx = String(unitContextName || '');
        const top = String(unitTopName || '');
        if (normalizeForComparison(ctx) === normalizeForComparison(name) || (top && normalizeForComparison(top) === normalizeForComparison(name))) {
            if (debugInteresting.test(name)) try { PARSE_DEBUG.push(`SKIP matched unitname name=${name} ctx=${ctx} top=${top}`); } catch(e) {}
            return;
        }
    }
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
        const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
    const newQ = exQ + effectiveQty;
    existing.quantity = `${newQ}x`;
    try { PARSE_DEBUG.push(`UPDATED existing name=${name} existing=${exQ} added=${effectiveQty} new=${newQ} target=${target && target.name}`); } catch(e) {}
    } else {
        const forcedType = (normalizeForComparison(name) === 'warlord') ? 'special' : itemType;
        target.items.push({ quantity: `${effectiveQty}x`, name: displayName, items: [], type: forcedType, nameshort: '' });
    try { PARSE_DEBUG.push(`PUSHED new name=${name} quantity=${effectiveQty} target=${target && target.name}`); } catch(e) {}
    }
}

function normalizeDroneName(name) {
    if (!name) return name;
    // normalize variants like "shasui shield drone" or "shield drone" to "Shield Drone"
    const n = name.toLowerCase();
    if (n.includes('shield') && n.includes('drone')) return 'Shield Drone';
    if (n.includes('marker') && n.includes('drone')) return 'Marker Drone';
    if (n.includes('marker') && n.includes('beacon')) return 'Homing Beacon';
    return name;
}

function normalizeNameCasing(name) {
    if (!name) return name;
    // Simple title-case for multi-word item names, keep existing capitalization for special cases
    return name.split(/\s+/).map(w => {
        if (!w) return w;
        // keep words that already have uppercase letters as-is (e.g., T'au)
        if (/[A-Z]/.test(w.slice(1))) return w;
        return w[0].toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
}

function prefixQtyIfNeeded(n, item) {
    if (!item) return `${n}x`;
    const trimmed = String(item).trim();
    // If item already has a leading quantity like '4x Foo', multiply it by n
    const m = trimmed.match(/^(\d+)x\s+(.*)$/i);
    if (m) {
        const ex = parseInt(m[1], 10) || 1;
        const rest = m[2] || '';
        return `${Math.max(1, n * ex)}x ${rest}`;
    }
    return `${n}x ${trimmed}`;
}

function parseAndAddEnhancement(content, target) {
    if (!content || !target) return;
    target.items = target.items || [];
    const raw = content.trim();
    const mPts = raw.match(/\(([^)]+)\)$/);
    const pts = mPts ? ` (${mPts[1]})` : '';
    const base = raw.replace(/\s*\([^)]+\)$/, '').trim();
    const normBase = normalizeForComparison(base);
    // Consider the unit already having the enhancement if any existing item
    // (special or normal) matches the base enhancement name when we strip
    // trailing parenthetical points and any leading 'Enhancement:' label.
    const already = (target.items || []).some(it => {
        if (!it || !it.name) return false;
        const nm = String(it.name || '').replace(/^Enhancement:\s*/i, '').replace(/\s*\([^)]+\)$/, '').trim();
        return normalizeForComparison(nm) === normBase;
    });
    if (already) return;
    const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
    const nameshort = `E: ${abbr}${pts}`.trim();
    const item = { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
    target.items.push(item);
}

export function parseWtc(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    if (!Array.isArray(lines)) return result;

    // Read header block (lines starting with '+'). Ignore any '&' header
    // lines entirely — enhancements must come from body 'Enhancement:' lines
    // per user instruction.
    const headerLines = [];
    let i = 0;
    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const t = raw.trim();
        if (!t) continue;
        if (t.startsWith('+')) { headerLines.push(t); continue; }
        // explicitly ignore '&' header lines
        if (t.startsWith('&')) { continue; }
        break;
    }

    for (const hl of headerLines) {
        const line = hl.replace(/^\+\s*/, '');
        const m = line.match(/^([^:]+):\s*(.*)$/);
        if (m) {
            const key = m[1].trim().toUpperCase();
            const val = m[2].trim();
            if (key === 'FACTION KEYWORD') {
                const parts = val.split(' - ');
                result.SUMMARY.FACTION_KEYWORD = parts[parts.length - 1].trim();
            } else if (key === 'DETACHMENT') {
                result.SUMMARY.DETACHMENT = val.replace(/\u00A0/g, ' ');
            } else if (key === 'TOTAL ARMY POINTS') {
                result.SUMMARY.TOTAL_ARMY_POINTS = val;
            }
        }
    }

    // Build display faction
    result.SUMMARY.LIST_TITLE = '';
    if (result.SUMMARY && result.SUMMARY.FACTION_KEYWORD) {
        const fk = result.SUMMARY.FACTION_KEYWORD;
        const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === (fk || '').toString().toLowerCase());
        const family = familyKey ? FAMILY_MAP[familyKey] : null;
        if (family) result.SUMMARY.DISPLAY_FACTION = `${family} - ${fk}`;
        else result.SUMMARY.DISPLAY_FACTION = fk + (result.SUMMARY.DETACHMENT ? ` - ${result.SUMMARY.DETACHMENT}` : '');
        try { result.SUMMARY.FACTION_KEY = fk.toString().toLowerCase(); } catch (e) {}
    }

    const unitLineRegex = /^(?:(Char\d+):\s*)?(?:(\d+)x?\s+)?(.*?)\s*\((\d+)\s*(?:pts|points)\)(?::\s*(.*))?$/i;
    const bulletRegex = /^\s*(?:\u2022|\*|-|\u25e6)\s*(.*)$/;

    let currentUnit = null;
    let lastCharUnit = null;

    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (/^Enhancement:\s*/i.test(trimmed)) {
            const content = trimmed.replace(/^Enhancement:\s*/i, '').trim();
            if (lastCharUnit) parseAndAddEnhancement(content, lastCharUnit);
            continue;
        }
        const um = trimmed.match(unitLineRegex);
        if (um) {
            const charId = um[1];
            const qty = um[2] ? `${um[2]}x` : '1x';
            const name = (um[3] || '').trim();
            const pts = parseInt(um[4], 10) || 0;
            const inline = um[5];
            const unit = { quantity: qty, name, points: pts, items: [], isComplex: false, nameshort: '', charId: charId || null };
            if (charId) {
                result.CHARACTER.push(unit);
                lastCharUnit = unit;
            } else {
                result['OTHER DATASHEETS'] = result['OTHER DATASHEETS'] || [];
                result['OTHER DATASHEETS'].push(unit);
            }
            currentUnit = unit;
            if (inline) inline.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(unit, it, unit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true));
            continue;
        }
        const b = raw.match(bulletRegex);
        if (b) {
            const content = b[1].trim();
            const withMatch = content.match(/^(\d+)\s+with\s+(.*)$/i);
            if (withMatch && currentUnit) {
                const n = parseInt(withMatch[1], 10) || 1;
                const rest = withMatch[2];
                const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
        try { PARSE_DEBUG.push(`WITHMATCH unit=${currentUnit.name} target=${target && target.name} n=${n} rest=${rest}`); } catch(e) {}
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                    const itemRaw = it;
                    const itemNorm = normalizeNameCasing(normalizeDroneName(itemRaw));
                    if (target && target.type === 'subunit') {
            try { PARSE_DEBUG.push(`WITH->SUB target=${target.name} item=${itemNorm} n=${n}`); } catch(e) {}
                        // 'with' count here indicates a count of models within the
                        // subunit that carry this item (e.g., '2 with Foo'). Pass the
                        // explicit quantity so the subunit stores that N as the
                        // item's quantity (not multiplied by the subunit size).
                        addItemToTarget(target, `${n}x ${itemNorm}`, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                    } else {
            try { PARSE_DEBUG.push(`WITH->UNIT unit=${currentUnit.name} item=${itemNorm} n=${n}`); } catch(e) {}
                        addItemToTarget(target, prefixQtyIfNeeded(n, itemNorm), target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                    }
                });
                continue;
            }
            const subColonMatch = content.match(/^(\d+x?)\s+(.*?):\s*(.*)$/i);
            if (subColonMatch && currentUnit) {
                const sq = subColonMatch[1];
                const sname = subColonMatch[2].trim();
                const rest = subColonMatch[3] || '';
                const sub = { quantity: sq, name: sname, items: [], type: 'subunit', _parent: currentUnit };
                currentUnit.items = currentUnit.items || [];
                currentUnit.items.push(sub);
                if (rest) {
                    const withInline = rest.match(/^(\d+)\s+with\s+(.*)$/i);
                    if (withInline) {
                        // For subunit inline 'with' clauses like '2 with A, B', the
                        // numeric prefix refers to the subunit count. That means each
                        // model in the subunit gets the listed items; do NOT prefix
                        // the items themselves with the subunit count. Add them as
                        // per-model items (quantity 1) and let higher-level expansion
                        // handle multiplication.
                        const list = withInline[2];
                        list.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                            const item = normalizeDroneName(it);
                            addItemToTarget(sub, item, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                        });
                    } else {
                        rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                            const item = normalizeDroneName(it);
                            addItemToTarget(sub, item, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                        });
                    }
                }
                continue;
            }
            const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
            if (subMatch && currentUnit) {
                // Heuristic: numeric bullets like '2x Shield Drone' under a
                // CHARACTER are usually item counts (attached to that model)
                // rather than a named subunit. Only create a 'subunit' when
                // the currentUnit is not a CHARACTER (i.e., charId is falsy).
                if (currentUnit.charId) {
                    // add as an item to the current unit
                    const qty = subMatch[1];
                    const name = subMatch[2].trim();
                    addItemToTarget(currentUnit, `${qty} ${name}`, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                    continue;
                } else {
                    const sub = { quantity: subMatch[1], name: subMatch[2].trim(), items: [], type: 'subunit', _parent: currentUnit };
                    currentUnit.items = currentUnit.items || [];
                    currentUnit.items.push(sub);
                    continue;
                }
            }
            if (currentUnit) {
                // Split comma-separated bullets and process each part individually.
                let parts = content.split(',').map(s => s.trim()).filter(Boolean);
                // If a comma part is of the form "<subunit name> (<support>)" and the
                // prefix matches the most-recent subunit, drop the parenthetical so we
                // don't create an extra item for the support (the subunit already
                // implies it).
                try {
                    const lastSub = (currentUnit.items && currentUnit.items.length>0) ? currentUnit.items[currentUnit.items.length-1] : null;
                    if (lastSub && lastSub.name) {
                        parts = parts.map(p => {
                            const m = p.match(/^(.*)\s*\(([^)]+)\)\s*$/);
                            if (m) {
                                const prefix = m[1].trim();
                                if (normalizeForComparison(prefix) === normalizeForComparison(lastSub.name)) {
                                    return prefix; // strip the parenthetical
                                }
                            }
                            return p;
                        });
                    }
                } catch (e) {}
                try {
                    const seen = new Set();
                    parts = parts.filter(p => {
                        const n = normalizeForComparison(normalizeNameCasing(normalizeDroneName(p)));
                        if (seen.has(n)) return false;
                        seen.add(n);
                        return true;
                    });
                } catch (e) {}
                // If the most recently added child of the current unit is a subunit,
                // prefer attaching loose bullets to that subunit (e.g., Shield Drone belongs to Stealth Shas'vre).
                let target = currentUnit;
                if (currentUnit.items && currentUnit.items.length > 0) {
                    const last = currentUnit.items[currentUnit.items.length - 1];
                    if (last && last.type === 'subunit') target = last;
                }
                parts.forEach(part => {
                        const item = normalizeNameCasing(normalizeDroneName(part));
                        addItemToTarget(target, item, target.name || currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                });
                continue;
            }
            continue;
        }
        const indentedWith = trimmed.match(/^(\d+)\s+with\s+(.*)$/i);
        if (indentedWith && currentUnit) {
            const n = parseInt(indentedWith[1], 10) || 1;
            const rest = indentedWith[2];
            const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                const itemRaw = it;
                const itemNorm = normalizeNameCasing(normalizeDroneName(itemRaw));
                if (target && target.type === 'subunit') {
                    // For indented 'N with ...' lines that apply to a subunit,
                    // the N is the number of models in that subunit that have
                    // the item. Pass it through as the explicit quantity.
                    addItemToTarget(target, `${n}x ${itemNorm}`, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                } else {
                    addItemToTarget(target, prefixQtyIfNeeded(n, itemNorm), target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                }
            });
            continue;
        }
        const fallbackColon = trimmed.match(/^(.*?):\s*(.*)$/);
        if (fallbackColon && currentUnit) {
            const rest = fallbackColon[2] || '';
            rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                const item = normalizeDroneName(it);
                addItemToTarget(currentUnit, item, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
            });
            continue;
        }
    }

    const allUnits = [...(result.CHARACTER || []), ...(result['OTHER DATASHEETS'] || [])];

    // Note: '&' header enhancements are intentionally ignored. Enhancements
    // must be detected from in-body 'Enhancement:' lines only.

    

    // Ensure deterministic ordering: sort top-level items and subunit items
    for (const u of allUnits) {
        if (u && Array.isArray(u.items) && u.items.length > 0) sortItemsByQuantityThenName(u.items);
        const subs = (u && Array.isArray(u.items)) ? u.items.filter(it => it && it.type === 'subunit') : [];
        for (const su of subs) if (su && Array.isArray(su.items) && su.items.length > 0) sortItemsByQuantityThenName(su.items);
    }

    standardizeSummary(result);
    // attach parse debug buffer for inspection in tests
    try { result.SUMMARY._parseDebug = (PARSE_DEBUG || []).slice(0, 200); } catch (e) {}
    return result;
}

// In-memory debug buffer used while running tests to trace parsing decisions
const PARSE_DEBUG = [];
