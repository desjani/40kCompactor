// New simplified renderers module. It keeps function signatures compatible
// with existing callers but no longer depends on a global abbreviation map.
// It uses the parser-provided `nameshort` for compact output when available
// and `skippable_wargear.json` to filter items.
import { makeAbbrevForName } from './abbreviations.js';
import factionColors from './faction_colors.js';
import { sortItemsByQuantityThenName } from './utils.js';

// ANSI palette and helpers available at module scope so multiple functions can use them
export const ansiPalette = [
    { hex: '#000000', code: 30 }, { hex: '#FF0000', code: 31 }, { hex: '#00FF00', code: 32 },
    { hex: '#FFFF00', code: 33 }, { hex: '#0000FF', code: 34 }, { hex: '#FF00FF', code: 35 },
    { hex: '#00FFFF', code: 36 }, { hex: '#FFFFFF', code: 37 }, { hex: '#808080', code: 90 } // grey -> bright black
];
// Map simple color names used in faction_colors.js to allowed hex values
export const colorNameToHex = {
    black: '#000000', red: '#FF0000', green: '#00FF00', yellow: '#FFFF00', blue: '#0000FF',
    magenta: '#FF00FF', cyan: '#00FFFF', white: '#FFFFFF', grey: '#808080'
};
const hexToRgb = (hex) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null; };
const findClosestAnsi = (hex) => { const rgb = hexToRgb(hex); if (!rgb) return 37; let best = 37; let bestD = Infinity; for (const c of ansiPalette) { const cr = hexToRgb(c.hex); const d = Math.pow(rgb.r - cr.r, 2) + Math.pow(rgb.g - cr.g, 2) + Math.pow(rgb.b - cr.b, 2); if (d < bestD) { bestD = d; best = c.code; } } return best; };

// Deep clone an object/array while stripping parent back-references and other
// private/internal fields that can cause cycles or noise in rendering.
function cloneSansParent(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneSansParent);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (k === '_parent') continue; // drop circular link
        // Preserve our own injected metadata and normal fields
        out[k] = cloneSansParent(v);
    }
    return out;
}

// Build a mapping of faction -> { unit, subunit, wargear, points } using only colors
// available in ansiPalette. Prefer explicit mapping from `modules/faction_colors.js`,
// fall back to a heuristic.
export function buildFactionColorMap(skippableMap) {
    const fallback = (map) => {
        const codes = [...new Set(ansiPalette.map(p => p.code))];
        const out = {};
        for (const k of Object.keys(map || {})) {
            const fk = k || '';
            const idx = Math.abs(Array.from(fk).reduce((a,c)=>a*31 + c.charCodeAt(0),0)) % codes.length;
            const unitCode = codes[idx];
            const pickDifferent = (forbidden) => codes.find(c => !forbidden.includes(c)) || codes[0];
            const subunitCode = pickDifferent([unitCode]);
            const wargearCode = pickDifferent([subunitCode]);
            const pointsCode = pickDifferent([wargearCode]);
            const codeToHex = (code) => {
                const e = ansiPalette.find(p => p.code === code);
                return e ? e.hex : '#FFFFFF';
            };
            out[fk] = { unit: codeToHex(unitCode), subunit: codeToHex(subunitCode), wargear: codeToHex(wargearCode), points: codeToHex(pointsCode) };
        }
        return out;
    };
    const explicit = factionColors || {};
    const fromSkippable = fallback(skippableMap || {});
    const merged = { ...fromSkippable, ...explicit };
    const normalized = {};
    // Normalization helper: remove diacritics, map fancy apostrophes to ASCII, strip
    // stray punctuation and lowercase. This makes lookups robust to parser
    // variations (e.g. curly apostrophe vs straight). Mirrors normalizeKey used
    // elsewhere in the codebase.
    const normalizeKey = (s) => {
        if (!s) return '';
        try {
            return s.toString().normalize('NFD')
                .replace(/\p{M}/gu, '')
                .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
                .replace(/[^\w\s'\-]/g, '')
                .toLowerCase().trim();
        } catch (e) {
            return s.toString().toLowerCase().trim();
        }
    };

    for (const [k, v] of Object.entries(merged)) {
        // Resolve any named colors to hex using colorNameToHex. If the value is already a hex, keep it.
        const resolved = {};
        ['unit','subunit','wargear','points','header'].forEach(prop => {
            if (!v || v[prop] === undefined) return;
            const raw = v[prop];
            if (typeof raw === 'string' && raw.startsWith('#')) resolved[prop] = raw;
            else if (typeof raw === 'string' && colorNameToHex[raw.toString().toLowerCase()]) resolved[prop] = colorNameToHex[raw.toString().toLowerCase()];
            else resolved[prop] = raw;
        });
    normalized[k] = resolved;
    try { normalized[k.toString().toLowerCase()] = resolved; } catch (e) {}
    try { normalized[normalizeKey(k)] = resolved; } catch (e) {}
    }
    return normalized;
}

// Sentinel returned from findSkippableForUnit to indicate hide-all behavior
export const HIDE_ALL = '__HIDE_ALL_WARGEARS__';

function aggregateWargear(unit) {
    const aggregated = new Map();
    const specials = [];

    function walk(node) {
        if (!node || !node.items) return;
        node.items.forEach(it => {
            if (it.type === 'wargear') {
                const key = it.name;
                const qty = parseInt((it.quantity || '1').toString().replace('x', ''), 10) || 1;
                const prev = aggregated.get(key) || { name: key, quantity: 0, type: 'wargear' };
                prev.quantity += qty;
                aggregated.set(key, prev);
            } else if (it.type === 'special') {
                specials.push(it);
            }
            if (it.items && Array.isArray(it.items) && it.items.length > 0) walk(it);
        });
    }

    walk(unit);
    const wargearList = Array.from(aggregated.values()).map(i => ({ ...i, quantity: `${i.quantity}x` }));
    const combined = [...specials, ...wargearList];
    // Sort aggregated wargear portion (leave specials at front but ensure wargear entries
    // are ordered by quantity desc then name). Specials should remain in the order
    // they were encountered.
    const specialOnly = combined.filter(c => c.type === 'special');
    const wargearOnly = combined.filter(c => c.type === 'wargear');
    sortItemsByQuantityThenName(wargearOnly);
    return [...specialOnly, ...wargearOnly];
}

function findAbbreviationForItem(itemName, wargearAbbrMap, dataSummary) {
    if (!wargearAbbrMap) return null;
    if (!itemName) return null;
    if (itemName.toString().trim().toLowerCase() === 'warlord') return null;
    const nameLower = (itemName || '').toLowerCase();
    const extractAbbr = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object') return val.abbr || val.ABBR || null;
        return null;
    };
    try {
        const flat = wargearAbbrMap.__flat_abbr;
        const factionIndex = wargearAbbrMap.__faction_index;
        if (flat && flat[nameLower] !== undefined) return extractAbbr(flat[nameLower]);
        const faction = (dataSummary && (dataSummary.DISPLAY_FACTION || dataSummary.FACTION_KEYWORD)) || null;
        if (faction && factionIndex) {
            const fk = faction.toString().toLowerCase();
            const fmap = factionIndex[fk] || factionIndex[faction] || factionIndex[faction.toLowerCase()] || null;
            if (fmap && fmap[nameLower] !== undefined) return extractAbbr(fmap[nameLower]);
        }
    } catch (e) {}
    if (wargearAbbrMap[nameLower]) return extractAbbr(wargearAbbrMap[nameLower]);
    const faction = (dataSummary && (dataSummary.DISPLAY_FACTION || dataSummary.FACTION_KEYWORD)) || null;
    if (faction) {
        const candidates = [faction, faction.toLowerCase(), faction.toUpperCase()].map(k => wargearAbbrMap[k]).filter(Boolean);
        for (const c of candidates) {
            if (typeof c === 'object') {
                if (c[nameLower]) return extractAbbr(c[nameLower]);
                for (const k of Object.keys(c)) if (k.toLowerCase() === nameLower) return extractAbbr(c[k]);
                if (Array.isArray(c)) for (const entry of c) if ((entry.item && entry.item.toLowerCase() === nameLower) || (entry.name && entry.name.toLowerCase() === nameLower)) return extractAbbr(entry.abbr || entry.ABBR || entry.value || entry);
            }
        }
    }
    const stack = [wargearAbbrMap];
    while (stack.length) {
        const node = stack.shift();
        if (!node) continue;
        if (Array.isArray(node)) { for (const entry of node) { if (entry && (entry.item || entry.name) && (entry.item || entry.name).toLowerCase() === nameLower) return extractAbbr(entry.abbr || entry.ABBR || entry.value || entry); } continue; }
        if (typeof node === 'object') for (const [k, v] of Object.entries(node)) { if (k.toLowerCase() === nameLower) return extractAbbr(v); if (typeof v === 'object') stack.push(v); }
    }
    return null;
}

function getInlineItemsString(items, useAbbreviations, wargearAbbrMap, dataSummary) {
    if (!items || items.length === 0) return '';
    // Use centralized abbreviation helper as fallback so abbreviations are deterministic
    // and identical across the app.
    const special = [];
    const wargear = [];
    // Process specials with requested formatting rules:
    // - If name === 'Warlord' -> do not abbreviate, keep as-is
    // - If name starts with 'Enhancement: ' -> abbreviate and format as 'E: ABBR (+NN)'
    //    where the parenthetical shows just (+NN) without ' pts'
    items.filter(i => i.type === 'special').forEach(i => {
        const n = i.name || '';
        if (n.toString().trim().toLowerCase() === 'warlord') {
            special.push('Warlord');
            return;
        }
        if (n.toString().startsWith && n.toString().startsWith('Enhancement:')) {
            // strip prefix and extract parenthetical points if present
            const stripped = n.toString().replace(/^Enhancement:\s*/i, '').trim();
            // find parenthetical like '(+20 pts)' or '(+20)'
            const parenMatch = /\(([^)]+)\)/.exec(stripped);
            let pts = '';
            if (parenMatch) {
                pts = parenMatch[1].replace(/\s*pts\s*/i, '').trim();
                pts = pts.startsWith('+') ? `(${pts})` : `(${pts})`;
            }
            const baseName = stripped.replace(/\(.*?\)/g, '').trim();
            // attempt to find abbreviation via map first, otherwise use central helper
            let abbr = null;
            if (useAbbreviations) abbr = findAbbreviationForItem(stripped, wargearAbbrMap, dataSummary) || findAbbreviationForItem(baseName, wargearAbbrMap, dataSummary);
            if (!abbr && useAbbreviations) abbr = makeAbbrevForName(baseName || stripped);
            const display = `E: ${abbr || baseName}${pts ? ' ' + pts : ''}`;
            special.push(display);
            return;
        }
        // default special handling
        special.push(n);
    });
    items.filter(i => i.type === 'wargear').forEach(i => {
        const qtyNum = parseInt((i.quantity || '1').toString().replace('x', ''), 10) || 1;
        const qtyPrefix = qtyNum > 1 ? `${i.quantity} ` : '';
        let abbr = null;
        if (useAbbreviations) abbr = findAbbreviationForItem(i.name, wargearAbbrMap, dataSummary);
        if (abbr === 'NULL') return;
    // If no abbreviation found, try nameshort, then fallback initials generator.
    if (!abbr && useAbbreviations && i.nameshort) abbr = i.nameshort;
    if (!abbr && useAbbreviations) abbr = makeAbbrevForName(i.name);
    const displayName = (useAbbreviations && abbr) ? abbr : i.name;
    wargear.push(`${qtyPrefix}${displayName}`);
    });
    const all = [...special, ...wargear].filter(Boolean);
    return all.length ? ` (${all.join(', ')})` : '';
}

function findSkippableForUnit(skippableWargearMap, dataSummary, unitName) {
    if (!skippableWargearMap) return [];
    if (!unitName) return [];
    // Prefer DISPLAY_FACTION or FACTION_KEYWORD on the provided summary object
    const faction = (dataSummary && (dataSummary.DISPLAY_FACTION || dataSummary.FACTION_KEYWORD || dataSummary.FACTION)) || '';
    // Normalize function: remove diacritics and lowercase for robust matching
    const normalizeKey = (s) => {
        if (!s) return '';
        try {
            return s.toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
        } catch (e) {
            return s.toString().toLowerCase().trim();
        }
    };
    const unitLower = normalizeKey(unitName);
    const unitAlt = unitLower.endsWith('s') ? unitLower.slice(0, -1) : unitLower + 's';


    // Return a special token if the caller requested hiding all wargear for a unit.
    const normalize = (list) => {
        // Boolean true means explicitly hide all wargear for the unit.
        // An empty array in the skippable map should be treated as "no items listed to skip",
        // not as a hide-all sentinel. This preserves existing explicit hide-all semantics
        // while avoiding accidental full-hiding when an empty array is present.
        if (list === true) return [HIDE_ALL];
        if (Array.isArray(list)) {
            if (list.length === 0) return []; // do NOT treat empty arrays as hide-all
            return list.map(s => (s || '').toString().toLowerCase());
        }
        return [];
    };

    // Helper: find a nested map for a faction key using normalized matching
    const findMapForFaction = (desiredFaction) => {
        if (!desiredFaction) return undefined;
        const want = normalizeKey(desiredFaction);
        // direct match
        if (Object.prototype.hasOwnProperty.call(skippableWargearMap, desiredFaction)) return skippableWargearMap[desiredFaction];
        // try normalized keys
        for (const [k, v] of Object.entries(skippableWargearMap)) {
            if (!k) continue;
            if (normalizeKey(k) === want) return v;
        }
        return undefined;
    };

    if (faction) {
        const tryKeys = [faction, (faction || '').toString()];
        for (const k of tryKeys) {
            const mapForFaction = findMapForFaction(k);
            if (!mapForFaction) continue;
            // Try many variants inside the faction map using normalized matching
            const tryUnitKeys = [unitName, unitLower, unitAlt];
            for (const uk of tryUnitKeys) {
                if (uk === undefined) continue;
                if (Object.prototype.hasOwnProperty.call(mapForFaction, uk)) return normalize(mapForFaction[uk]);
            }
            for (const [innerK, innerV] of Object.entries(mapForFaction)) {
                if (!innerK) continue;
                if (normalizeKey(innerK) === unitLower || normalizeKey(innerK) === unitAlt) return normalize(innerV);
            }
        }
        if (typeof faction === 'string' && faction.includes(' - ')) {
            const last = faction.split(' - ').pop();
            const mapForFaction = findMapForFaction(last);
            if (mapForFaction) {
                for (const [innerK, innerV] of Object.entries(mapForFaction)) {
                    if (!innerK) continue;
                    if (normalizeKey(innerK) === unitLower || normalizeKey(innerK) === unitAlt) return normalize(innerV);
                }
            }
        }
    }

    // Top-level direct matches using normalized key comparisons
    for (const [k, v] of Object.entries(skippableWargearMap)) {
        if (!k) continue;
        const nk = normalizeKey(k);
        if (nk === unitLower || nk === unitAlt) return normalize(v);
        // check nested maps
        if (typeof v === 'object') {
            // try direct property matches first
            if (Object.prototype.hasOwnProperty.call(v, unitName)) return normalize(v[unitName]);
            if (Object.prototype.hasOwnProperty.call(v, unitLower)) return normalize(v[unitLower]);
            if (Object.prototype.hasOwnProperty.call(v, unitAlt)) return normalize(v[unitAlt]);
            // try normalized inner keys
            for (const [innerK, innerV] of Object.entries(v)) {
                if (!innerK) continue;
                if (normalizeKey(innerK) === unitLower || normalizeKey(innerK) === unitAlt) return normalize(innerV);
            }
        }
    }

    return [];
}

function canonicalUnitSignature(unit, _hideSubunits) {
    // Exact-match policy: only merge when the entire unit JSON (structure and wargear)
    // is identical. Normalize to remove private fields and normalize quantities.
    const normalize = (value) => {
        if (value === null || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(normalize);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '_parent') continue; // drop circular link
            if (k.startsWith('__')) continue; // drop internal aggregation metadata
            if (k === 'quantity') {
                const q = parseInt((v ?? '1').toString().replace('x',''),10);
                out[k] = isNaN(q) ? v : q;
                continue;
            }
            out[k] = normalize(v);
        }
        return out;
    };
    try {
        return JSON.stringify(normalize(unit));
    } catch (e) {
        // Fallback to name+points if stringify fails (should be rare)
        const name = (unit && unit.name) ? unit.name.toString() : '';
        const points = (unit && unit.points) || 0;
        return JSON.stringify({ name, points });
    }
}

function maybeCombineUnits(sectionUnits, hideSubunits, enable) {
    if (!enable) return sectionUnits;
    const groups = new Map();
    for (const u of sectionUnits) {
    const sig = canonicalUnitSignature(u, hideSubunits);
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(u);
    }
    const combined = [];
    for (const [sig, group] of groups.entries()) {
        if (group.length === 1) {
            const single = cloneSansParent(group[0]);
            single.__groupCount = 1;
            single.__unitSize = parseInt((single.quantity||'1').toString().replace('x',''),10) || 1;
            combined.push(single);
            continue;
        }
        // Combine: preserve per-unit size and store group count for rendering
        const template = cloneSansParent(group[0]);
        const unitSize = parseInt((template.quantity||'1').toString().replace('x',''),10) || 1;
        template.__groupCount = group.length;
        template.__unitSize = unitSize;
        // Keep original quantity (per-unit size), do not multiply
        combined.push(template);
    }
    return combined;
}

export function generateOutput(data, useAbbreviations, wargearAbbrMap, hideSubunits, skippableWargearMap, applyHeaderColor = true, combineIdenticalUnits = false, noBullets = false, hidePoints = false) {
    let html = '', plainText = '';
    const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (data.SUMMARY?.FACTION_KEYWORD || '');
    if (data.SUMMARY) {
        const parts = [];
        if (data.SUMMARY.LIST_TITLE) parts.push(data.SUMMARY.LIST_TITLE);
        if (displayFaction) parts.push(displayFaction);
        if (data.SUMMARY.DETACHMENT) parts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) parts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (parts.length) {
            const summaryText = parts.join(' | ');
            // Determine header color only when caller requests it (avoid coloring Full Text)
            let styleColor = 'color:var(--color-text-secondary);';
            if (applyHeaderColor) {
                // Try to resolve header color from faction mapping when available
                let headerColor = null;
                try {
                    const fm = buildFactionColorMap(skippableWargearMap || {});
                    const fk = (data.SUMMARY && (data.SUMMARY.FACTION_KEY || data.SUMMARY.FACTION_KEYWORD || data.SUMMARY.DISPLAY_FACTION)) || null;
                    const normalizeKeyLookup = (s) => {
                        if (!s) return null;
                        try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
                    };
                    const fmEntry = fk ? (fm[fk] || fm[fk.toString().toLowerCase()] || fm[normalizeKeyLookup(fk)]) : null;
                    if (fmEntry && fmEntry.header) headerColor = fmEntry.header;
                } catch (e) { /* ignore */ }
                styleColor = headerColor ? `color:${headerColor};` : 'color:var(--color-text-secondary);';
            }
            html += `<div style="padding-bottom:0.5rem;border-bottom:1px solid var(--color-border);"><p style="font-size:0.75rem;margin-bottom:0.25rem;${styleColor}font-weight:600;">${summaryText}</p></div>`;
            plainText += summaryText + '\n\n';
        }
    }
    html += `<div style="margin-top:0.5rem;">`;
    const UNIT_BULLET = noBullets ? '' : '• ';
    const SUB_BULLET = noBullets ? '  ' : '◦ ';
    const itemBullet = noBullets ? '  ' : '  - ';
    const subUnitBullet = noBullets ? '  ' : '  * ';
    const subItemBullet = noBullets ? '    ' : '    - ';

    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        // Only combine in compact output (useAbbreviations === true)
            const effectiveHideSubunits = useAbbreviations ? hideSubunits : false;
            const units = useAbbreviations ? maybeCombineUnits(data[section], effectiveHideSubunits, combineIdenticalUnits) : data[section];
        units.forEach(unit => {
            const qtyNum = parseInt((unit.quantity || '1').toString().replace('x', ''), 10) || 1;
            let qtyDisplay = '';
            if (useAbbreviations && combineIdenticalUnits && (unit.__groupCount || 0) > 1) {
                const unitSize = unit.__unitSize || qtyNum;
                qtyDisplay = `${unit.__groupCount}x${unitSize} `;
            } else {
                qtyDisplay = qtyNum > 1 ? `${qtyNum} ` : '';
            }
            if (useAbbreviations) {
                // Compact: only include top-level wargear/specials in inline parens.
                // Always apply skippable hiding if a skippable map is provided.
                const skippable = findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name);
                const topLevelItems = (unit.items || []).filter(i => i.type === 'wargear' || i.type === 'special');
                const visible = topLevelItems.filter(i => {
                    if (i.type === 'special') return true;
                    if (skippable.includes(HIDE_ALL)) return false;
                    return skippable.length === 0 || !skippable.includes(i.name.toLowerCase());
                });
                const itemsString = getInlineItemsString(visible, useAbbreviations, wargearAbbrMap, data.SUMMARY);
                const pointsString = hidePoints ? '' : ` [${unit.points}]`;
                const unitText = `${qtyDisplay}${unit.name}${itemsString}${pointsString}`;
                html += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p></div>`;
                plainText += `${UNIT_BULLET}${unitText}\n`;
                return;
            }
            const pointsString = hidePoints ? '' : ` [${unit.points}]`;
            const unitText = `${qtyDisplay}${unit.name}${pointsString}`;
            html += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p>`;
            plainText += `${UNIT_BULLET}${unitText}\n`;
            const itemsArr = unit.items || [];
                if (effectiveHideSubunits) {
                    let aggregated = aggregateWargear(unit);
                    // For full text (non-compact), we do NOT apply skippable filtering — show all aggregated wargear
                    if (aggregated.length > 0) { html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`; aggregated.forEach(it => { const iq = parseInt((it.quantity || '1').toString().replace('x',''), 10) || 1; const qtyDisplay = iq > 1 ? `${it.quantity} ` : ''; html += `<p style="margin:0;">${qtyDisplay}${it.name}</p>`; plainText += `  - ${qtyDisplay}${it.name}\n`; }); html += `</div>`; }
            } else {
                const topLevelItems = itemsArr.filter(i => i.type === 'wargear' || i.type === 'special');
                // For full text view do NOT apply skippable hiding; show all top-level items
                const filteredTop = topLevelItems;
                if (filteredTop.length > 0) { html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`; filteredTop.forEach(item => { const itemNumericQty = parseInt((item.quantity || '1').toString().replace('x',''), 10) || 1; const itemQtyDisplay = itemNumericQty > 1 ? `${item.quantity} ` : '';
                    // For Full Text view, show Enhancement points clearly and with a space before the points
                    let displayItemName = item.name;
                    if (item.type === 'special' && (item.name || '').toString().startsWith && (item.name || '').toString().startsWith('Enhancement:')) {
                        // Parser may strip the parenthetical points from item.name. Prefer extracting
                        // the points from item.nameshort (which parsers set to include the points),
                        // falling back to any parenthetical still present in the name.
                        const stripped = item.name.toString().replace(/^Enhancement:\s*/i, '').trim();
                        let pts = '';
                        if (item.nameshort) {
                            const m = (item.nameshort || '').toString().match(/\(([^)]+)\)/);
                            if (m) {
                                pts = m[1].replace(/\s*pts\s*/i, '').trim();
                                pts = pts.startsWith('+') ? `(${pts})` : `(${pts})`;
                            }
                        }
                        if (!pts) {
                            const parenMatch = /\(([^)]+)\)/.exec(stripped);
                            if (parenMatch) {
                                pts = parenMatch[1].replace(/\s*pts\s*/i, '').trim();
                                pts = pts.startsWith('+') ? `(${pts})` : `(${pts})`;
                            }
                        }
                        const baseName = stripped.replace(/\(.*?\)/g, '').trim();
                        displayItemName = `${baseName}${pts ? ' ' + pts : ''}`;
                    }
                    html += `<p style="margin:0;">${itemQtyDisplay}${displayItemName}</p>`;
                    plainText += `  - ${itemQtyDisplay}${displayItemName}\n`; }); html += `</div>`; }
                const subunitItems = itemsArr.filter(i => i.type === 'subunit' || (i.items && i.items.length > 0)).sort((a,b)=> { const aq = parseInt((a.quantity||'1').toString().replace('x',''),10) || 1; const bq = parseInt((b.quantity||'1').toString().replace('x',''),10) || 1; return aq - bq; });
                if (subunitItems.length > 0) {
                    html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                    subunitItems.forEach(sub => {
                        const itemNumericQty = parseInt((sub.quantity || '1').toString().replace('x',''), 10) || 1;
                        const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                        const subunitNameText = `${itemQtyDisplay}${sub.name}`;
                        // For full text view, do not apply skippable filtering to inner items
                        const collated = aggregateWargear(sub);
                        // If the subunit has no inner items and no specials, skip printing it
                        const hasVisibleSpecials = (sub.items || []).some(si => si.type === 'special');
                        if (collated.length === 0 && !hasVisibleSpecials) return;
                        html += `<p style="font-weight:500;color:var(--color-text-primary);margin:0;">${subunitNameText}</p>`;
                        plainText += `  * ${subunitNameText}\n`;
                        if (collated.length > 0) { collated.forEach(ci => { const ciQtyNum = parseInt((ci.quantity || '1').toString().replace('x',''), 10) || 1; const ciQty = ciQtyNum > 1 ? `${ci.quantity} ` : ''; html += `<p style="margin:0 0 0.125rem 1rem;">${ciQty}${ci.name}</p>`; plainText += `    - ${ciQty}${ci.name}\n`; }); }
                    });
                    html += `</div>`;
                }
            }
            html += `</div>`;
    });
    }
    html += `</div>`;
    return { html, plainText };
}

export function generateDiscordText(data, plain, useAbbreviations = true, wargearAbbrMap, hideSubunits, skippableWargearMap, combineIdenticalUnits = false, options, noBullets = false, hidePoints = false) {
    // Produce plain or ANSI-colored Discord text. When in browser and colorMode
    // is 'custom', emit ANSI SGR sequences approximating the selected hex colors.
    const hasDOM = (typeof document !== 'undefined' && document.querySelector);
    let useColor = false;
    const defaultColors = { unit: '#FFFFFF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00', header: '#FFFF00' };
    const colors = { ...defaultColors };
    // Allow callers (e.g., mobile) to pass color mode and colors directly.
    // Fallback to DOM extraction when not provided.
    if (!plain) {
        const mode = (options && options.colorMode) || (hasDOM ? ((document.querySelector('input[name="colorMode"]:checked') || {}).value || 'none') : 'none');
        useColor = mode && mode !== 'none';
        if (useColor && mode === 'custom') {
            if (options && options.colors) {
                const src = options.colors || {};
                if (src.unit) colors.unit = src.unit;
                if (src.subunit) colors.subunit = src.subunit;
                if (src.wargear) colors.wargear = src.wargear;
                if (src.points) colors.points = src.points;
                if (src.header) colors.header = src.header;
            } else if (hasDOM) {
                const u = document.getElementById('unitColor');
                const s = document.getElementById('subunitColor');
                const w = document.getElementById('wargearColor');
                const p = document.getElementById('pointsColor');
                const h = document.getElementById('headerColor');
                if (u && u.value) colors.unit = u.value;
                if (s && s.value) colors.subunit = s.value;
                if (w && w.value) colors.wargear = w.value;
                if (p && p.value) colors.points = p.value;
                if (h && h.value) colors.header = h.value;
            }
        }
        // New 'faction' color mode: derive a faction -> color mapping from the
        // provided skippable_wargear map and color units based on the parsed faction.
        if (useColor && mode === 'faction') {
            // Build mapping only once from the skippable map passed to the renderer
            const factionMap = buildFactionColorMap(skippableWargearMap || {});
            // Prefer parser-provided FACTION_KEYWORD for deterministic mapping; fall back to DISPLAY_FACTION.
            const factionKey = (data.SUMMARY && (data.SUMMARY.FACTION_KEYWORD || data.SUMMARY.DISPLAY_FACTION)) || null;
            const normalizeKeyLookup = (s) => {
                if (!s) return null;
                try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
            };
            const nfk = factionKey ? normalizeKeyLookup(factionKey) : null;
            if (factionKey && (factionMap[factionKey] || factionMap[factionKey.toString().toLowerCase()] || (nfk && factionMap[nfk]))) {
                const fm = factionMap[factionKey] || factionMap[factionKey.toString().toLowerCase()] || factionMap[nfk];
                if (fm.unit) colors.unit = fm.unit;
                if (fm.subunit) colors.subunit = fm.subunit;
                if (fm.wargear) colors.wargear = fm.wargear;
                if (fm.points) colors.points = fm.points;
                if (fm.header) colors.header = fm.header;
            } else if (factionKey && factionMap[factionKey.toString().toLowerCase()]) {
                const fm = factionMap[factionKey.toString().toLowerCase()];
                if (fm.unit) colors.unit = fm.unit;
                if (fm.subunit) colors.subunit = fm.subunit;
                if (fm.wargear) colors.wargear = fm.wargear;
                if (fm.points) colors.points = fm.points;
                if (fm.header) colors.header = fm.header;
            }
        }
    }

    const toAnsi = (txt, hex, bold = false) => {
        if (!useColor || !hex) return txt;

        // Check if hex is actually an ANSI code (number or string number)
        if (typeof hex === 'number' || (typeof hex === 'string' && /^\d+$/.test(hex))) {
             const boldPart = bold ? '1;' : '';
             return `\u001b[${boldPart}${hex}m${txt}\u001b[0m`;
        }

        // For previews in-browser we can use truecolor, but allow callers to force palette for clipboard
        const hasDOMLocal = (typeof document !== 'undefined' && document.querySelector);
        const forcePalette = !!(options && options.forcePalette);
        if (hasDOMLocal && !forcePalette) {
            const rgb = hexToRgb(hex);
            if (!rgb) return txt;
            const boldPart = bold ? '1;' : '';
            return `\u001b[${boldPart}38;2;${rgb.r};${rgb.g};${rgb.b}m${txt}\u001b[0m`;
        }
        const code = findClosestAnsi(hex);
        const boldPart = bold ? '1;' : '';
        return `\u001b[${boldPart}${code}m${txt}\u001b[0m`;
    };

    // Choose bullet symbols for plain text vs. other outputs
    const UNIT_BULLET = noBullets ? '' : (plain ? '• ' : '* ');
    const SUB_BULLET = noBullets ? '  ' : (plain ? '  ◦ ' : '  + ');

    let out = '';
    // Fence only for Discord modes (non-plain). Use ```ansi when colored.
    if (!plain) out += useColor ? '```ansi\n' : '```\n';
    if (data.SUMMARY) {
        const parts = [];
        if (data.SUMMARY.LIST_TITLE) parts.push(data.SUMMARY.LIST_TITLE);
        if (data.SUMMARY.FACTION_KEYWORD) parts.push(data.SUMMARY.DISPLAY_FACTION || data.SUMMARY.FACTION_KEYWORD.split(' - ').pop());
        if (data.SUMMARY.DETACHMENT) parts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) parts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (parts.length) {
            const multiline = (options && options.multilineHeader !== undefined) ? options.multilineHeader : false;
            const header = parts.join(multiline ? '\n' : ' | ');
            out += useColor ? toAnsi(header, colors.header, true) + '\n\n' : header + '\n\n';
        }
    }

    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        const units = maybeCombineUnits(data[section], hideSubunits, combineIdenticalUnits);
        units.forEach(unit => {
            const qtyNum = parseInt((unit.quantity || '1').toString().replace('x',''), 10) || 1;
            let qtyDisplay = '';
            if (combineIdenticalUnits && (unit.__groupCount || 0) > 1) {
                const unitSize = unit.__unitSize || qtyNum;
                qtyDisplay = `${unit.__groupCount}x${unitSize} `;
            } else {
                qtyDisplay = qtyNum > 1 ? `${qtyNum} ` : '';
            }
            let itemsToRender = hideSubunits ? aggregateWargear(unit) : unit.items || [];
            // Always apply skippable hiding when a skippable map is provided
            const skippable = findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name);
            const visible = itemsToRender.filter(i => {
                if (i.type === 'special') return true;
                if (skippable.includes(HIDE_ALL)) return false;
                return skippable.length === 0 || !skippable.includes(i.name.toLowerCase());
            });
            const itemsString = getInlineItemsString(visible, useAbbreviations, wargearAbbrMap, data.SUMMARY);

            const unitRaw = `${qtyDisplay}${unit.name}`;
            const unitText = useColor ? toAnsi(unitRaw, colors.unit, true) : unitRaw;
            const itemsText = (useColor && itemsString) ? toAnsi(itemsString, colors.wargear, false) : itemsString;
            const pointsRaw = `[${unit.points}]`;
            const pointsText = useColor ? toAnsi(pointsRaw, colors.points, true) : pointsRaw;

            let line = `${UNIT_BULLET}${unitText}${itemsText}`;
            if (!hidePoints) {
                line += ` ${pointsText}`;
            }
            out += `${line}\n`;

            if (!hideSubunits && Array.isArray(unit.items)) {
                const subs = unit.items.filter(i => i.type === 'subunit' || (i.items && i.items.length > 0));
                const skippableTop = findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name);
                subs.forEach(sub => {
                    const subQty = parseInt((sub.quantity||'1').toString().replace('x',''),10) || 1;
                    const subQtyDisplay = subQty > 1 ? `${subQty} ` : '';
                    const subRaw = `${subQtyDisplay}${sub.name}`;
                    const subName = useColor ? toAnsi(subRaw, colors.subunit, false) : subRaw;
                    // Determine skippable set for this subunit; fallback to parent unit if subunit list is empty
                    const subSkippable = findSkippableForUnit(skippableWargearMap, data.SUMMARY, sub.name);
                    const fallbackSkippable = (subSkippable.length === 0) ? skippableTop : subSkippable;
                    const filteredItems = (sub.items || []).filter(i => {
                        if (i.type === 'special') return true;
                        if (fallbackSkippable.includes(HIDE_ALL)) return false;
                        return fallbackSkippable.length === 0 || !fallbackSkippable.includes(i.name.toLowerCase());
                    });
                    const hasVisibleSpecials = (sub.items || []).some(si => si.type === 'special' && (fallbackSkippable.length === 0 || !fallbackSkippable.includes(si.name.toLowerCase())));
                    if (filteredItems.length === 0 && !hasVisibleSpecials) return; // hide empty subunit
                    const subItems = getInlineItemsString(filteredItems, useAbbreviations, wargearAbbrMap, data.SUMMARY);
                    const subItemsText = (useColor && subItems) ? toAnsi(subItems, colors.wargear, false) : subItems;
                    out += `${SUB_BULLET}${subName}${subItemsText}\n`;
                });
            }
    });
    }

    // Close the fence only for Discord modes
    if (!plain) out += '```';
    return out;
}

// Expose a helper to resolve faction colors given a parsed data object and the skippable map
export function resolveFactionColors(data, skippableWargearMap) {
    const factionMap = buildFactionColorMap(skippableWargearMap || {});
    const factionKey = (data.SUMMARY && (data.SUMMARY.FACTION_KEYWORD || data.SUMMARY.DISPLAY_FACTION)) || null;
    if (!factionKey) return null;
    const normalizeKeyLookup = (s) => {
        if (!s) return null;
        try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
    };
    const nfk = normalizeKeyLookup(factionKey);
    const fm = factionMap[factionKey] || factionMap[factionKey && factionKey.toString().toLowerCase()] || (nfk && factionMap[nfk]);
    return fm || null;
}

// Note: do NOT attach buildFactionColorMap to globalThis here; callers should
// import it directly (main.js now imports it). The previous global fallback
// hid bundling issues and caused runtime ReferenceErrors in some environments.