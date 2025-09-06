// New simplified renderers module. It keeps function signatures compatible
// with existing callers but no longer depends on a global abbreviation map.
// It uses the parser-provided `nameshort` for compact output when available
// and `skippable_wargear.json` to filter items.
import { getMultilineHeaderState } from './ui.js';
import { makeAbbrevForName } from './abbreviations.js';

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
    return [...specials, ...wargearList];
}

function formatEnhancementPoints(raw) {
    if (!raw) return '';
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('(') && s.endsWith(')')) return s;
    if (s.startsWith('+')) return `(${s})`;
    return `(+${s})`;
}

function getDisplayName(item) {
    if (!item) return '';
    let name = item.name || '';
    if (item.type === 'special') {
        const raw = item.enhancementPoints || null;
        const pts = formatEnhancementPoints(raw);
        if (pts) return `${name} ${pts}`;
        const m = name.match(/^(.*)\s*\(([^)]+)\)\s*$/);
        if (m) return `${m[1].trim()} (${m[2].trim()})`;
    }
    return name;
}

function findAbbreviationForItem(itemName, wargearAbbrMap, dataSummary) {
    if (!wargearAbbrMap) return null;
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
            // strip prefix
            const stripped = n.toString().replace(/^Enhancement:\s*/i, '').trim();
            const baseName = stripped.replace(/\(.*?\)/g, '').trim();
            // attempt to find abbreviation via map first, otherwise use central helper
            let abbr = null;
            if (useAbbreviations) abbr = findAbbreviationForItem(stripped, wargearAbbrMap, dataSummary) || findAbbreviationForItem(baseName, wargearAbbrMap, dataSummary);
            if (!abbr && useAbbreviations) abbr = makeAbbrevForName(baseName || stripped);

            // prefer explicit enhancement.enhancementPoints stored on the item if present
            let pts = '';
            try {
                if (i && i.enhancementPoints) {
                    pts = formatEnhancementPoints(i.enhancementPoints);
                } else {
                    const parenMatch = /\(([^)]+)\)/.exec(stripped);
                    if (parenMatch) {
                        pts = formatEnhancementPoints(parenMatch[1].replace(/\s*pts\s*/i, '').trim());
                    }
                }
            } catch (e) {}

            const display = pts ? `E: ${abbr || baseName} ${pts}` : `E: ${abbr || baseName}`;
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

export function generateOutput(data, useAbbreviations, wargearAbbrMap, hideSubunits, skippableWargearMap) {
    let html = '', plainText = '';
    const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (data.SUMMARY?.FACTION_KEYWORD || '');
    if (data.SUMMARY) {
        const parts = [];
        if (data.SUMMARY.LIST_TITLE) parts.push(data.SUMMARY.LIST_TITLE);
        if (displayFaction) parts.push(displayFaction);
        if (data.SUMMARY.DETACHMENT) parts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) parts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (parts.length) { const summaryText = parts.join(' | '); html += `<div style="padding-bottom:0.5rem;border-bottom:1px solid var(--color-border);"><p style="font-size:0.75rem;margin-bottom:0.25rem;color:var(--color-text-secondary);font-weight:600;">${summaryText}</p></div>`; plainText += summaryText + '\n\n'; }
    }
    html += `<div style="margin-top:0.5rem;">`;
    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        data[section].forEach(unit => {
            const qtyNum = parseInt((unit.quantity || '1').toString().replace('x', ''), 10) || 1;
            const qtyDisplay = qtyNum > 1 ? `${qtyNum} ` : '';
            if (useAbbreviations) {
                // Compact: only include top-level wargear/specials in inline parens.
                // Only apply skippable hiding when rendering with abbreviations
                const skippable = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name) : [];
                const topLevelItems = (unit.items || []).filter(i => i.type === 'wargear' || i.type === 'special');
                const visible = topLevelItems.filter(i => {
                    if (i.type === 'special') return true;
                    if (skippable.includes(HIDE_ALL)) return false;
                    return skippable.length === 0 || !skippable.includes(i.name.toLowerCase());
                });
                const itemsString = getInlineItemsString(visible, useAbbreviations, wargearAbbrMap, data.SUMMARY);
                const unitText = `${qtyDisplay}${unit.name}${itemsString} [${unit.points}]`;
                html += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p></div>`;
                plainText += `* ${unitText}\n`;
                return;
            }
            const unitText = `${qtyDisplay}${unit.name} [${unit.points}]`;
            html += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p>`;
            plainText += `* ${unitText}\n`;
            const itemsArr = unit.items || [];
            if (hideSubunits) {
                    let aggregated = aggregateWargear(unit);
                    const skippableTop = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name) : [];
                    aggregated = aggregated.filter(i => {
                        if (skippableTop.includes(HIDE_ALL)) return false;
                        return skippableTop.length === 0 || !skippableTop.includes(i.name.toLowerCase());
                    });
                    if (aggregated.length > 0) { html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`; aggregated.forEach(it => { const qtyDisplay = it.quantity ? `${it.quantity} ` : ''; html += `<p style="margin:0;">${qtyDisplay}${it.name}</p>`; plainText += `  - ${qtyDisplay}${it.name}\n`; }); html += `</div>`; }
            } else {
                const topLevelItems = itemsArr.filter(i => i.type === 'wargear' || i.type === 'special');
                const skippableTop = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name) : [];
                const filteredTop = topLevelItems.filter(it => { if (it.type === 'special') return true; if (skippableTop.includes(HIDE_ALL)) return false; return skippableTop.length === 0 || !skippableTop.includes(it.name.toLowerCase()); });
                if (filteredTop.length > 0) {
                    html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                    filteredTop.forEach(item => {
                        const itemNumericQty = parseInt((item.quantity || '1').toString().replace('x',''), 10) || 1;
                        const itemQtyDisplay = itemNumericQty > 1 ? `${item.quantity} ` : '';
                        const displayName = (item.type === 'special') ? getDisplayName(item) : item.name;
                        html += `<p style="margin:0;">${itemQtyDisplay}${displayName}</p>`;
                        plainText += `  - ${itemQtyDisplay}${displayName}\n`;
                    });
                    html += `</div>`;
                }
                const subunitItems = itemsArr.filter(i => i.type === 'subunit' || (i.items && i.items.length > 0)).sort((a,b)=> { const aq = parseInt((a.quantity||'1').toString().replace('x',''),10) || 1; const bq = parseInt((b.quantity||'1').toString().replace('x',''),10) || 1; return aq - bq; });
                if (subunitItems.length > 0) {
                    html += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                    subunitItems.forEach(sub => {
                        const itemNumericQty = parseInt((sub.quantity || '1').toString().replace('x',''), 10) || 1;
                        const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                        const subunitNameText = `${itemQtyDisplay}${sub.name}`;
                        // Determine visible inner wargear for this subunit
                        const subSkippable = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, sub.name) : [];
                        const fallbackSkippable = (subSkippable.length === 0) ? skippableTop : subSkippable;
                        const collated = aggregateWargear(sub).filter(ci => { if (fallbackSkippable.includes(HIDE_ALL)) return false; return fallbackSkippable.length === 0 || !fallbackSkippable.includes(ci.name.toLowerCase()); });
                        // If the subunit has no visible inner items and no specials, skip printing it
                        const hasVisibleSpecials = (sub.items || []).some(si => si.type === 'special' && (fallbackSkippable.length === 0 || !fallbackSkippable.includes(si.name.toLowerCase())));
                        if (collated.length === 0 && !hasVisibleSpecials) return;
                        html += `<p style="font-weight:500;color:var(--color-text-primary);margin:0;">${subunitNameText}</p>`;
                        plainText += `  * ${subunitNameText}\n`;
                        if (collated.length > 0) { collated.forEach(ci => { const ciQty = ci.quantity ? `${ci.quantity} ` : ''; html += `<p style="margin:0 0 0.125rem 1rem;">${ciQty}${ci.name}</p>`; plainText += `    - ${ciQty}${ci.name}\n`; }); }
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

export function generateDiscordText(data, plain, useAbbreviations = true, wargearAbbrMap, hideSubunits, skippableWargearMap) {
    // Produce plain or ANSI-colored Discord text. When in browser and colorMode
    // is 'custom', emit ANSI SGR sequences approximating the selected hex colors.
    const hasDOM = (typeof document !== 'undefined' && document.querySelector);
    let useColor = false;
    const defaultColors = { unit: '#FFFFFF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00', header: '#FFFF00' };
    const colors = { ...defaultColors };
    if (!plain && hasDOM) {
        const modeEl = document.querySelector('input[name="colorMode"]:checked');
        const mode = modeEl ? modeEl.value : 'none';
        useColor = mode && mode !== 'none';
        if (useColor && mode === 'custom') {
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

    const ansiPalette = [
        { hex: '#000000', code: 30 }, { hex: '#FF0000', code: 31 }, { hex: '#00FF00', code: 32 },
        { hex: '#FFFF00', code: 33 }, { hex: '#0000FF', code: 34 }, { hex: '#FF00FF', code: 35 },
        { hex: '#00FFFF', code: 36 }, { hex: '#FFFFFF', code: 37 }, { hex: '#808080', code: 90 }
    ];
    const hexToRgb = (hex) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null; };
    const findClosestAnsi = (hex) => { const rgb = hexToRgb(hex); if (!rgb) return 37; let best = 37; let bestD = Infinity; for (const c of ansiPalette) { const cr = hexToRgb(c.hex); const d = Math.pow(rgb.r - cr.r, 2) + Math.pow(rgb.g - cr.g, 2) + Math.pow(rgb.b - cr.b, 2); if (d < bestD) { bestD = d; best = c.code; } } return best; };
    const toAnsi = (txt, hex, bold = false) => { if (!useColor || !hex) return txt; const code = findClosestAnsi(hex); const boldPart = bold ? '1;' : ''; return `\u001b[${boldPart}${code}m${txt}\u001b[0m`; };

    let out = '';
    if (!plain) out += useColor ? '```ansi\n' : '```\n';
    if (data.SUMMARY) {
        const parts = [];
        if (data.SUMMARY.LIST_TITLE) parts.push(data.SUMMARY.LIST_TITLE);
        if (data.SUMMARY.FACTION_KEYWORD) parts.push(data.SUMMARY.DISPLAY_FACTION || data.SUMMARY.FACTION_KEYWORD.split(' - ').pop());
        if (data.SUMMARY.DETACHMENT) parts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) parts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (parts.length) { const header = parts.join(getMultilineHeaderState() ? '\n' : ' | '); out += useColor ? toAnsi(header, colors.header, true) + '\n\n' : header + '\n\n'; }
    }

    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        data[section].forEach(unit => {
            const qtyNum = parseInt((unit.quantity || '1').toString().replace('x',''), 10) || 1;
            const qtyDisplay = qtyNum > 1 ? `${qtyNum} ` : '';
            let itemsToRender = hideSubunits ? aggregateWargear(unit) : unit.items || [];
            // Only apply skippable hiding when abbreviations (compact mode) are used
            const skippable = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name) : [];
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

            out += `* ${unitText}${itemsText} ${pointsText}\n`;

            if (!hideSubunits && Array.isArray(unit.items)) {
                const subs = unit.items.filter(i => i.type === 'subunit' || (i.items && i.items.length > 0));
                const skippableTop = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, unit.name) : [];
                subs.forEach(sub => {
                    const subQty = parseInt((sub.quantity||'1').toString().replace('x',''),10) || 1;
                    const subQtyDisplay = subQty > 1 ? `${subQty} ` : '';
                    const subRaw = `${subQtyDisplay}${sub.name}`;
                    const subName = useColor ? toAnsi(subRaw, colors.subunit, false) : subRaw;
                    // Determine skippable set for this subunit; fallback to parent unit if subunit list is empty
                    const subSkippable = useAbbreviations ? findSkippableForUnit(skippableWargearMap, data.SUMMARY, sub.name) : [];
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
                    out += `  + ${subName}${subItemsText}\n`;
                });
            }
        });
    }

    if (!plain) out += '```';
    return out;
}