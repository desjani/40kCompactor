// Renderers for 11th Edition JSON structure.
import { makeAbbrevForName } from './abbreviations.js';
import factionColors from './faction_colors.js';
import { sortItemsByQuantityThenName, getModelsCount, getCanonicalFactionName } from './utils.js';

export function abbreviateWords(str) {
    if (!str) return '';
    const words = str.split(/\s+/);
    const lowercaseWords = ['the', 'of', 'in', 'on', 'at', 'for', 'a', 'an', 'to', 'by', 'with', 'and'];
    const abbr = words.map(w => {
        const cleaned = w.replace(/[^\w]/g, '');
        if (!cleaned) return '';
        const first = cleaned[0];
        if (lowercaseWords.includes(cleaned.toLowerCase())) {
            return first.toLowerCase();
        }
        return first.toUpperCase();
    }).join('');
    return abbr;
}

export function abbreviateDetachment(detStr) {
    if (!detStr) return '';
    const parts = detStr.split(/\s+and\s+/i);
    return parts.map(p => abbreviateWords(p.trim())).join(' & ');
}

export function abbreviateForceDisposition(dispStr) {
    if (!dispStr) return '';
    const parts = dispStr.split(',');
    return parts.map(p => abbreviateWords(p.trim())).join(', ');
}

export const ansiPalette = [
    { hex: '#000000', code: 30 }, { hex: '#FF0000', code: 31 }, { hex: '#00FF00', code: 32 },
    { hex: '#FFFF00', code: 33 }, { hex: '#0000FF', code: 34 }, { hex: '#FF00FF', code: 35 },
    { hex: '#00FFFF', code: 36 }, { hex: '#FFFFFF', code: 37 }, { hex: '#808080', code: 90 }
];

export const colorNameToHex = {
    black: '#000000', red: '#FF0000', green: '#00FF00', yellow: '#FFFF00', blue: '#0000FF',
    magenta: '#FF00FF', cyan: '#00FFFF', white: '#FFFFFF', grey: '#808080'
};

const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
};

const findClosestAnsi = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 37;
    let best = 37;
    let bestD = Infinity;
    for (const c of ansiPalette) {
        const cr = hexToRgb(c.hex);
        const d = Math.pow(rgb.r - cr.r, 2) + Math.pow(rgb.g - cr.g, 2) + Math.pow(rgb.b - cr.b, 2);
        if (d < bestD) {
            bestD = d;
            best = c.code;
        }
    }
    return best;
};

export function buildFactionColorMap(skippableMap) {
    const fallback = (map) => {
        const codes = [...new Set(ansiPalette.map(p => p.code))];
        const out = {};
        for (const k of Object.keys(map || {})) {
            const fk = k || '';
            const idx = Math.abs(Array.from(fk).reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % codes.length;
            const unitCode = codes[idx];
            const pickDifferent = (forbidden) => codes.find(c => !forbidden.includes(c)) || codes[0];
            const subunitCode = pickDifferent([unitCode]);
            const wargearCode = pickDifferent([subunitCode]);
            const pointsCode = pickDifferent([wargearCode]);
            const attachedCode = pickDifferent([pointsCode]);
            const codeToHex = (code) => {
                const e = ansiPalette.find(p => p.code === code);
                return e ? e.hex : '#FFFFFF';
            };
            out[fk] = { unit: codeToHex(unitCode), subunit: codeToHex(subunitCode), wargear: codeToHex(wargearCode), points: codeToHex(pointsCode), attached: codeToHex(attachedCode) };
        }
        return out;
    };
    const explicit = factionColors || {};
    const fromSkippable = fallback(skippableMap || {});
    const merged = { ...fromSkippable, ...explicit };
    const normalized = {};
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
        const resolved = {};
        ['unit', 'subunit', 'wargear', 'points', 'header', 'attached'].forEach(prop => {
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

export const HIDE_ALL = '__HIDE_ALL_WARGEARS__';

function aggregateWargear(unit, excludeSubunits = false) {
    const aggregated = new Map();

    // 1. Add unit's own wargear
    if (Array.isArray(unit.wargear)) {
        unit.wargear.forEach(wg => {
            const key = wg.name;
            const qty = parseInt(wg.quantity || 1, 10);
            const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
            aggregated.set(key, { quantity: prev.quantity + qty, skippable: prev.skippable || !!wg.skippable });
        });
    }

    // 2. Add subunits' wargear
    if (!excludeSubunits && Array.isArray(unit.subunits)) {
        unit.subunits.forEach(sub => {
            if (Array.isArray(sub.wargear)) {
                sub.wargear.forEach(wg => {
                    const key = wg.name;
                    const qty = parseInt(wg.quantity || 1, 10);
                    const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
                    aggregated.set(key, { quantity: prev.quantity + qty, skippable: prev.skippable || !!wg.skippable });
                });
            }
        });
    }

    const wargearList = Array.from(aggregated.entries()).map(([name, info]) => ({
        name,
        quantity: `${info.quantity}x`,
        skippable: info.skippable,
        type: 'wargear'
    }));
    sortItemsByQuantityThenName(wargearList);
    return wargearList;
}

function findAbbreviationForItem(itemName, wargearAbbrMap, dataSummary) {
    if (!wargearAbbrMap || !itemName) return null;
    const nameLower = itemName.toLowerCase();
    const extractAbbr = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object') return val.abbr || val.ABBR || null;
        return null;
    };
    try {
        const flat = wargearAbbrMap.__flat_abbr;
        if (flat && flat[nameLower] !== undefined) return extractAbbr(flat[nameLower]);
    } catch (e) {}
    return null;
}

function getInlineItemsString(unit, useAbbreviations, wargearAbbrMap, dataSummary, skippableWargearMap, showMandatoryWargear = false, hideSubunits = false, wargearShowMode = undefined, hideBrackets = false) {
    const specials = [];
    const wargear = [];

    const showMode = wargearShowMode || (showMandatoryWargear ? 'show-all' : 'hide-mandatory');

    // Process enhancements
    if (Array.isArray(unit.enhancements)) {
        unit.enhancements.forEach(enh => {
            let abbr = null;
            if (useAbbreviations) {
                abbr = findAbbreviationForItem(enh.name, wargearAbbrMap, dataSummary);
                if (!abbr) abbr = makeAbbrevForName(enh.name);
            }
            const pts = enh.points ? (hideBrackets ? ` +${enh.points}` : ` (+${enh.points})`) : '';
            specials.push(`E: ${abbr || enh.name}${pts}`);
        });
    }

    // Process wargear
    const itemsToRender = aggregateWargear(unit, !hideSubunits);
    const visible = itemsToRender.filter(i => {
        if (showMode === 'show-all') return true;
        if (showMode === 'hide-all') return false;
        return !i.skippable;
    });

    visible.forEach(i => {
        const qtyNum = parseInt((i.quantity || '1').toString().replace('x', ''), 10) || 1;
        const qtyPrefix = qtyNum > 1 ? `${i.quantity} ` : '';
        let abbr = null;
        if (useAbbreviations) {
            abbr = findAbbreviationForItem(i.name, wargearAbbrMap, dataSummary);
            if (!abbr) abbr = makeAbbrevForName(i.name);
        }
        wargear.push(`${qtyPrefix}${abbr || i.name}`);
    });

    const all = [...specials, ...wargear].filter(Boolean);
    return all.length ? (hideBrackets ? ` ${all.join(', ')}` : ` (${all.join(', ')})`) : '';
}

function findSkippableForUnit(skippableWargearMap, dataSummary, unitName) {
    if (!skippableWargearMap || !unitName) return [];
    const faction = dataSummary?.faction || dataSummary?.DISPLAY_FACTION || dataSummary?.FACTION_KEYWORD || '';
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

    const normalize = (list) => {
        if (list === true) return [HIDE_ALL];
        if (Array.isArray(list)) {
            return list.map(s => (s || '').toString().toLowerCase());
        }
        return [];
    };

    const findMapForFaction = (desiredFaction) => {
        if (!desiredFaction) return undefined;
        const want = normalizeKey(desiredFaction);
        if (Object.prototype.hasOwnProperty.call(skippableWargearMap, desiredFaction)) return skippableWargearMap[desiredFaction];
        for (const [k, v] of Object.entries(skippableWargearMap)) {
            if (normalizeKey(k) === want) return v;
        }
        return undefined;
    };

    const mapForFaction = findMapForFaction(faction);
    if (mapForFaction) {
        const tryUnitKeys = [unitName, unitLower, unitAlt];
        for (const uk of tryUnitKeys) {
            if (Object.prototype.hasOwnProperty.call(mapForFaction, uk)) return normalize(mapForFaction[uk]);
        }
        for (const [innerK, innerV] of Object.entries(mapForFaction)) {
            if (normalizeKey(innerK) === unitLower || normalizeKey(innerK) === unitAlt) return normalize(innerV);
        }
    }

    return [];
}

function canonicalUnitSignature(unit, hideSubunits) {
    const normalize = (value) => {
        if (value === null || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(normalize);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === '_parent' || k.startsWith('__')) continue;
            if (k === 'name' && value.isAttached) continue;
            if (k === 'quantity') {
                const q = parseInt((v ?? '1').toString().replace('x', ''), 10);
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
        return JSON.stringify({ name: unit?.name, points: unit?.points });
    }
}

export function maybeCombineUnits(sectionUnits, hideSubunits, enable) {
    if (!enable || !Array.isArray(sectionUnits)) return sectionUnits;
    const groups = new Map();
    for (const u of sectionUnits) {
        const sig = canonicalUnitSignature(u, hideSubunits);
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(u);
    }
    const combined = [];
    for (const [sig, group] of groups.entries()) {
        if (group.length === 1) {
            const single = { ...group[0] };
            single.__groupCount = 1;
            single.__unitSize = getModelsCount(single);
            if (single.isAttached && Array.isArray(single.attachedParts)) {
                single.attachedParts = single.attachedParts.map(part => {
                    const p = { ...part };
                    p.__groupCount = 1;
                    p.__unitSize = getModelsCount(p);
                    return p;
                });
            }
            combined.push(single);
            continue;
        }
        const template = { ...group[0] };
        const unitSize = getModelsCount(template);
        template.__groupCount = group.length;
        template.__unitSize = unitSize;
        if (template.isAttached && Array.isArray(template.attachedParts)) {
            template.attachedParts = template.attachedParts.map(part => {
                const p = { ...part };
                p.__groupCount = group.length;
                p.__unitSize = getModelsCount(p);
                return p;
            });
        }
        combined.push(template);
    }
    return combined;
}

export function getRoleTag(part, index, hideBrackets = false) {
    if (!part) return '';
    const roleLower = (part.role || '').toLowerCase();
    const attachedLower = (part.attachedAs || '').toLowerCase();
    const suffix = index !== undefined ? index : '';
    
    const isLeader = (str) => /leader|meneur|l[ií]der|anfuehrer|anführer|capo|comandante/i.test(str);
    const isBodyguard = (str) => /bodyguard|gardes?\s+du\s+corps|escolta|leibwaechter|leibwächter|guardia\s+del\s+corpo/i.test(str);
    const isSupport = (str) => /support/i.test(str);

    if (isLeader(roleLower) || isLeader(attachedLower)) return hideBrackets ? `L${suffix}` : `[L${suffix}]`;
    if (isSupport(roleLower) || isSupport(attachedLower)) return hideBrackets ? `S${suffix}` : `[S${suffix}]`;
    if (isBodyguard(roleLower) || isBodyguard(attachedLower)) return hideBrackets ? `B${suffix}` : `[B${suffix}]`;
    return '';
}

export function getWarlordTag(unit, hideBrackets = false) {
    return unit && unit.isWarlord ? (hideBrackets ? 'W' : '[W]') : '';
}

export function generateOutput(data, useAbbreviations, wargearAbbrMap, hideSubunits, skippableWargearMap, applyHeaderColor = true, combineIdenticalUnits = false, noBullets = false, hidePoints = false, abbreviateHeader = false, showMandatoryWargear = false, wargearShowMode = undefined, abbreviateUnitNames = false, hideBrackets = false) {
    let html = '', plainText = '';
    const showMode = wargearShowMode || (showMandatoryWargear ? 'show-all' : 'hide-mandatory');
    const summary = data.metadata || {};
    const displayFaction = summary.faction || '';

    const headerParts = [];
    const listName = summary.title || summary.armyName || '';
    if (listName) headerParts.push(listName);
    if (summary.faction) headerParts.push(summary.faction);
    
    let dets = '';
    if (Array.isArray(summary.detachments) && summary.detachments.length > 0) {
        if (abbreviateHeader) {
            dets = summary.detachments.map(d => abbreviateWords(d)).join(' & ');
        } else {
            dets = summary.detachments.join(' and ');
        }
    } else if (summary.detachment) {
        if (abbreviateHeader) {
            dets = abbreviateDetachment(summary.detachment);
        } else {
            dets = summary.detachment;
        }
    }
    if (dets) headerParts.push(dets);
    
    let disps = '';
    if (Array.isArray(summary.forceDispositions) && summary.forceDispositions.length > 0) {
        if (abbreviateHeader) {
            disps = summary.forceDispositions.map(d => abbreviateWords(d)).join(', ');
        } else {
            disps = summary.forceDispositions.join(', ');
        }
    } else if (summary.forceDisposition) {
        if (abbreviateHeader) {
            disps = abbreviateForceDisposition(summary.forceDisposition);
        } else {
            disps = summary.forceDisposition;
        }
    }
    if (disps) headerParts.push(disps);

    const totalPts = summary.pointsTotal || summary.totalPoints || 0;
    if (totalPts) {
        const limit = summary.pointsLimit || 0;
        const limitStr = limit ? ` / ${limit}pts` : 'pts';
        headerParts.push(`${totalPts}${limitStr}`);
    }

    if (headerParts.length) {
        const summaryText = headerParts.join(' | ');
        let styleColor = 'color:var(--color-text-secondary);';
        if (applyHeaderColor) {
            let headerColor = null;
            try {
                const fm = buildFactionColorMap(skippableWargearMap || {});
                const rawFaction = summary.faction || null;
                const fk = getCanonicalFactionName(rawFaction);
                const normalizeKeyLookup = (s) => {
                    if (!s) return null;
                    try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
                };
                const fmEntry = fk ? (fm[fk] || fm[fk.toString().toLowerCase()] || fm[normalizeKeyLookup(fk)]) : null;
                if (fmEntry && fmEntry.header) headerColor = fmEntry.header;
            } catch (e) {}
            styleColor = headerColor ? `color:${headerColor};` : 'color:var(--color-text-secondary);';
        }
        html += `<div style="padding-bottom:0.5rem;border-bottom:1px solid var(--color-border);"><p style="font-size:0.75rem;margin-bottom:0.25rem;${styleColor}font-weight:600;">${summaryText}</p></div>`;
        plainText += summaryText + '\n\n';
    }

    html += `<div style="margin-top:0.5rem;">`;
    const UNIT_BULLET = noBullets ? '' : '• ';
    const SUB_BULLET = noBullets ? '  ' : '◦ ';
    const itemBullet = noBullets ? '  ' : '  - ';
    const subUnitBullet = noBullets ? '  ' : '  * ';
    const subItemBullet = noBullets ? '    ' : '    - ';

    const rawUnits = Array.isArray(data.units) ? data.units : [];
    const units = maybeCombineUnits(rawUnits, hideSubunits, combineIdenticalUnits);

    const renderUnit = (unit, prefix = '') => {
        let outHtml = '', outPlain = '';
        const G = (unit.__groupCount !== undefined) ? unit.__groupCount : 1;
        const M = (unit.__unitSize !== undefined) ? unit.__unitSize : getModelsCount(unit);
        let qtyDisplay = '';
        if (G > 1) {
            qtyDisplay = M > 1 ? `${G}x${M} ` : `${G}x `;
        } else {
            qtyDisplay = M > 1 ? `${M} ` : '';
        }

        const categorySuffix = '';

        if (useAbbreviations) {
            const itemsString = getInlineItemsString(unit, useAbbreviations, wargearAbbrMap, summary, skippableWargearMap, showMandatoryWargear, hideSubunits, showMode, hideBrackets);
            const pointsString = hidePoints ? '' : (hideBrackets ? ` ${unit.points}` : ` [${unit.points}]`);
            const finalUnitName = abbreviateUnitNames ? (findAbbreviationForItem(unit.name, wargearAbbrMap, summary) || makeAbbrevForName(unit.name)) : unit.name;
            const unitText = `${prefix}${qtyDisplay}${finalUnitName}${categorySuffix}${itemsString}${pointsString}`;
            outHtml += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p>`;
            outPlain += `${UNIT_BULLET}${unitText}\n`;

            if (!hideSubunits && Array.isArray(unit.subunits) && unit.subunits.length > 0) {
                outHtml += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                unit.subunits.forEach(sub => {
                    const subQty = parseInt((sub.quantity || '1').toString().replace('x', ''), 10) || 1;
                    const subQtyDisplay = subQty > 1 ? `${subQty} ` : '';
                    
                    const filteredItems = (sub.wargear || []).filter(wg => {
                        if (showMode === 'show-all') return true;
                        if (showMode === 'hide-all') return false;
                        return !wg.skippable;
                    });
                    
                    let subItemsText = '';
                    if (filteredItems.length > 0) {
                        const subItemsArr = filteredItems.map(wg => {
                            const wgQty = parseInt(wg.quantity || 1, 10);
                            const qtyStr = wgQty > 1 ? `${wgQty}x ` : '';
                            let abbr = null;
                            abbr = findAbbreviationForItem(wg.name, wargearAbbrMap, summary);
                            if (!abbr) abbr = makeAbbrevForName(wg.name);
                            return `${qtyStr}${abbr || wg.name}`;
                        });
                        subItemsText = hideBrackets ? ` ${subItemsArr.join(', ')}` : ` (${subItemsArr.join(', ')})`;
                    }
                    
                    const finalSubName = abbreviateUnitNames ? (findAbbreviationForItem(sub.name, wargearAbbrMap, summary) || makeAbbrevForName(sub.name)) : sub.name;
                    outHtml += `<p style="font-weight:500;color:var(--color-text-primary);margin:0;">${subQtyDisplay}${finalSubName}${subItemsText}</p>`;
                    outPlain += `  * ${subQtyDisplay}${finalSubName}${subItemsText}\n`;
                });
                outHtml += `</div>`;
            }
            outHtml += `</div>`;
            return { html: outHtml, plainText: outPlain };
        }

        const pointsString = hidePoints ? '' : (hideBrackets ? ` ${unit.points}` : ` [${unit.points}]`);
        const finalUnitName = (useAbbreviations && abbreviateUnitNames) ? (findAbbreviationForItem(unit.name, wargearAbbrMap, summary) || makeAbbrevForName(unit.name)) : unit.name;
        const unitText = `${prefix}${qtyDisplay}${finalUnitName}${categorySuffix}${pointsString}`;
        outHtml += `<div><p style="color:var(--color-text-primary);font-weight:600;font-size:0.875rem;margin-bottom:0.25rem;">${unitText}</p>`;
        outPlain += `${UNIT_BULLET}${unitText}\n`;

        if (hideSubunits) {
            const aggregated = aggregateWargear(unit);
            const visibleAggregated = aggregated.filter(it => {
                if (showMode === 'show-all') return true;
                if (showMode === 'hide-all') return false;
                return !it.skippable;
            });
            if (visibleAggregated.length > 0) {
                outHtml += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                visibleAggregated.forEach(it => {
                    outHtml += `<p style="margin:0;">${it.quantity} ${it.name}</p>`;
                    outPlain += `  - ${it.quantity} ${it.name}\n`;
                });
                outHtml += `</div>`;
            }
        } else {
            // Render enhancements
            if (Array.isArray(unit.enhancements) && unit.enhancements.length > 0) {
                outHtml += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                unit.enhancements.forEach(enh => {
                    const ptsStr = enh.points ? ` (+${enh.points})` : '';
                    outHtml += `<p style="margin:0;">Enhancement: ${enh.name}${ptsStr}</p>`;
                    outPlain += `  - Enhancement: ${enh.name}${ptsStr}\n`;
                });
                outHtml += `</div>`;
            }

            // Render top-level wargear
            if (Array.isArray(unit.wargear) && unit.wargear.length > 0) {
                const visibleWargear = unit.wargear.filter(wg => {
                    if (showMode === 'show-all') return true;
                    if (showMode === 'hide-all') return false;
                    return !wg.skippable;
                });
                if (visibleWargear.length > 0) {
                    outHtml += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                    visibleWargear.forEach(wg => {
                        const wgQty = parseInt(wg.quantity || 1, 10);
                        const qtyStr = wgQty > 1 ? `${wgQty}x ` : '';
                        outHtml += `<p style="margin:0;">${qtyStr}${wg.name}</p>`;
                        outPlain += `  - ${qtyStr}${wg.name}\n`;
                    });
                    outHtml += `</div>`;
                }
            }

            // Render subunits
            if (Array.isArray(unit.subunits) && unit.subunits.length > 0) {
                outHtml += `<div style="padding-left:1rem;font-size:0.75rem;color:var(--color-text-secondary);font-weight:400;">`;
                unit.subunits.forEach(sub => {
                    const subQty = parseInt(sub.quantity || 1, 10);
                    const qtyStr = subQty > 1 ? `${subQty}x ` : '';
                    
                    const visibleWargear = (sub.wargear || []).filter(wg => {
                        if (showMode === 'show-all') return true;
                        if (showMode === 'hide-all') return false;
                        return !wg.skippable;
                    });
                    
                    const finalSubName = (useAbbreviations && abbreviateUnitNames) ? (findAbbreviationForItem(sub.name, wargearAbbrMap, summary) || makeAbbrevForName(sub.name)) : sub.name;
                    outHtml += `<p style="font-weight:500;color:var(--color-text-primary);margin:0;">${qtyStr}${finalSubName}</p>`;
                    outPlain += `  * ${qtyStr}${finalSubName}\n`;

                    visibleWargear.forEach(wg => {
                        const wgQty = parseInt(wg.quantity || 1, 10);
                        const wqtyStr = wgQty > 1 ? `${wgQty}x ` : '';
                        outHtml += `<p style="margin:0 0 0.125rem 1rem;">${wqtyStr}${wg.name}</p>`;
                        outPlain += `    - ${wqtyStr}${wg.name}\n`;
                    });
                });
                outHtml += `</div>`;
            }
        }
        outHtml += `</div>`;
        return { html: outHtml, plainText: outPlain };
    };

    let attachedIndex = 0;
    units.forEach(unit => {
        if (unit.isAttached) {
            attachedIndex++;
            unit.attachedParts.forEach(part => {
                const tag = getRoleTag(part, attachedIndex, hideBrackets);
                const wTag = getWarlordTag(part, hideBrackets);
                const tags = [tag, wTag].filter(Boolean).join('');
                const prefix = tags ? `${tags} ` : '';
                const rendered = renderUnit(part, prefix);
                html += rendered.html;
                plainText += rendered.plainText;
            });
        } else {
            const wTag = getWarlordTag(unit, hideBrackets);
            const prefix = wTag ? `${wTag} ` : '';
            const rendered = renderUnit(unit, prefix);
            html += rendered.html;
            plainText += rendered.plainText;
        }
    });



    html += `</div>`;
    return { html, plainText };
}

export function generateDiscordText(data, plain, useAbbreviations = true, wargearAbbrMap, hideSubunits, skippableWargearMap, combineIdenticalUnits = false, options, noBullets = false, hidePoints = false) {
    const hasDOM = (typeof document !== 'undefined' && document.querySelector);
    let useColor = false;
    const defaultColors = { unit: '#FFFFFF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00', header: '#FFFF00', attached: '#FFFF00' };
    const colors = { ...defaultColors };
    const summary = data.metadata || {};
    const hideBrackets = !!(options && options.hideBrackets);

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
                if (src.attached) colors.attached = src.attached;
            } else if (hasDOM) {
                const u = document.getElementById('unitColor');
                const s = document.getElementById('subunitColor');
                const w = document.getElementById('wargearColor');
                const p = document.getElementById('pointsColor');
                const h = document.getElementById('headerColor');
                const a = document.getElementById('attachedColor');
                if (u && u.value) colors.unit = u.value;
                if (s && s.value) colors.subunit = s.value;
                if (w && w.value) colors.wargear = w.value;
                if (p && p.value) colors.points = p.value;
                if (h && h.value) colors.header = h.value;
                if (a && a.value) colors.attached = a.value;
            }
        }
        if (useColor && mode === 'faction') {
            const factionMap = buildFactionColorMap(skippableWargearMap || {});
            const rawFaction = summary.faction || null;
            const factionKey = getCanonicalFactionName(rawFaction);
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
                if (fm.attached) colors.attached = fm.attached;
            }
        }
    }

    const toAnsi = (txt, hex, bold = false) => {
        if (!useColor || !hex) return txt;
        if (typeof hex === 'number' || (typeof hex === 'string' && /^\d+$/.test(hex))) {
             const boldPart = bold ? '1;' : '';
             return `\u001b[${boldPart}${hex}m${txt}\u001b[0m`;
        }
        const forcePalette = !!(options && options.forcePalette);
        if (hasDOM && !forcePalette) {
            const rgb = hexToRgb(hex);
            if (!rgb) return txt;
            const boldPart = bold ? '1;' : '';
            return `\u001b[${boldPart}38;2;${rgb.r};${rgb.g};${rgb.b}m${txt}\u001b[0m`;
        }
        const code = findClosestAnsi(hex);
        const boldPart = bold ? '1;' : '';
        return `\u001b[${boldPart}${code}m${txt}\u001b[0m`;
    };

    const UNIT_BULLET = noBullets ? '' : (plain ? '• ' : '* ');
    const SUB_BULLET = noBullets ? '  ' : (plain ? '  ◦ ' : '  + ');

    const abbreviateHeader = !!(options && options.abbreviateHeader);
    const showMandatoryWargear = !!(options && options.showMandatoryWargear);
    const showMode = (options && options.wargearShowMode) || (showMandatoryWargear ? 'show-all' : 'hide-mandatory');
    let out = '';
    if (!plain) out += useColor ? '```ansi\n' : '```\n';

    const headerParts = [];
    const listName = summary.title || summary.armyName || '';
    if (listName) headerParts.push(listName);
    if (summary.faction) headerParts.push(summary.faction);
    
    let dets = '';
    if (Array.isArray(summary.detachments) && summary.detachments.length > 0) {
        if (abbreviateHeader) {
            dets = summary.detachments.map(d => abbreviateWords(d)).join(' & ');
        } else {
            dets = summary.detachments.join(' and ');
        }
    } else if (summary.detachment) {
        if (abbreviateHeader) {
            dets = abbreviateDetachment(summary.detachment);
        } else {
            dets = summary.detachment;
        }
    }
    if (dets) headerParts.push(dets);
    
    let disps = '';
    if (Array.isArray(summary.forceDispositions) && summary.forceDispositions.length > 0) {
        if (abbreviateHeader) {
            disps = summary.forceDispositions.map(d => abbreviateWords(d)).join(', ');
        } else {
            disps = summary.forceDispositions.join(', ');
        }
    } else if (summary.forceDisposition) {
        if (abbreviateHeader) {
            disps = abbreviateForceDisposition(summary.forceDisposition);
        } else {
            disps = summary.forceDisposition;
        }
    }
    if (disps) headerParts.push(disps);

    const totalPts = summary.pointsTotal || summary.totalPoints || 0;
    if (totalPts) {
        const limit = summary.pointsLimit || 0;
        const limitStr = limit ? ` / ${limit}pts` : 'pts';
        headerParts.push(`${totalPts}${limitStr}`);
    }

    if (headerParts.length) {
        const multiline = (options && options.multilineHeader !== undefined) ? options.multilineHeader : false;
        const header = headerParts.join(multiline ? '\n' : ' | ');
        out += useColor ? toAnsi(header, colors.header, true) + '\n\n' : header + '\n\n';
    }

    const rawUnits = Array.isArray(data.units) ? data.units : [];
    const units = maybeCombineUnits(rawUnits, hideSubunits, combineIdenticalUnits);

    const renderDiscordUnit = (unit, prefixText = '') => {
        const G = (unit.__groupCount !== undefined) ? unit.__groupCount : 1;
        const M = (unit.__unitSize !== undefined) ? unit.__unitSize : getModelsCount(unit);
        let qtyDisplay = '';
        if (G > 1) {
            qtyDisplay = M > 1 ? `${G}x${M} ` : `${G}x `;
        } else {
            qtyDisplay = M > 1 ? `${M} ` : '';
        }

        const categorySuffix = '';

        const itemsString = getInlineItemsString(unit, useAbbreviations, wargearAbbrMap, summary, skippableWargearMap, showMandatoryWargear, hideSubunits, showMode, hideBrackets);

        const abbreviateUnitNames = !!(options && options.abbreviateUnitNames);
        const finalUnitName = (useAbbreviations && abbreviateUnitNames) ? (findAbbreviationForItem(unit.name, wargearAbbrMap, summary) || makeAbbrevForName(unit.name)) : unit.name;

        const unitNameText = useColor ? toAnsi(finalUnitName, colors.unit, true) : finalUnitName;
        const unitText = `${prefixText}${qtyDisplay}${unitNameText}${categorySuffix}`;
        const itemsText = (useColor && itemsString) ? toAnsi(itemsString, colors.wargear, false) : itemsString;
        const pointsRaw = hideBrackets ? `${unit.points}` : `[${unit.points}]`;
        const pointsText = useColor ? toAnsi(pointsRaw, colors.points, true) : pointsRaw;

        let line = `${UNIT_BULLET}${unitText}${itemsText}`;
        if (!hidePoints) {
            line += ` ${pointsText}`;
        }
        out += `${line}\n`;

        if (!hideSubunits && Array.isArray(unit.subunits)) {
            unit.subunits.forEach(sub => {
                const subQty = parseInt((sub.quantity || '1').toString().replace('x', ''), 10) || 1;
                const subQtyDisplay = subQty > 1 ? `${subQty} ` : '';
                const finalSubName = (useAbbreviations && abbreviateUnitNames) ? (findAbbreviationForItem(sub.name, wargearAbbrMap, summary) || makeAbbrevForName(sub.name)) : sub.name;
                const subRaw = `${subQtyDisplay}${finalSubName}`;
                const subName = useColor ? toAnsi(subRaw, colors.subunit, false) : subRaw;

                const filteredItems = (sub.wargear || []).filter(wg => {
                    if (showMode === 'show-all') return true;
                    if (showMode === 'hide-all') return false;
                    return !wg.skippable;
                });

                if (filteredItems.length === 0) {
                    out += `${SUB_BULLET}${subName}\n`;
                    return;
                }

                // Format subunit wargear
                const subItemsArr = filteredItems.map(wg => {
                    const wgQty = parseInt(wg.quantity || 1, 10);
                    const qtyStr = wgQty > 1 ? `${wgQty}x ` : '';
                    let abbr = null;
                    if (useAbbreviations) {
                        abbr = findAbbreviationForItem(wg.name, wargearAbbrMap, summary);
                        if (!abbr) abbr = makeAbbrevForName(wg.name);
                    }
                    return `${qtyStr}${abbr || wg.name}`;
                });
                const subItems = hideBrackets ? ` ${subItemsArr.join(', ')}` : ` (${subItemsArr.join(', ')})`;
                const subItemsText = (useColor && subItems) ? toAnsi(subItems, colors.wargear, false) : subItems;
                out += `${SUB_BULLET}${subName}${subItemsText}\n`;
            });
        }
    };

    let attachedIndex = 0;
    units.forEach(unit => {
        if (unit.isAttached) {
            attachedIndex++;
            unit.attachedParts.forEach(part => {
                const tag = getRoleTag(part, attachedIndex, hideBrackets);
                const wTag = getWarlordTag(part, hideBrackets);
                const tagText = useColor ? toAnsi(tag, colors.attached, true) : tag;
                const wTagText = useColor && wTag ? toAnsi(wTag, colors.attached, true) : wTag;
                const parts = [tagText, wTagText].filter(Boolean);
                const prefixText = parts.length ? `${parts.join('')} ` : '';
                renderDiscordUnit(part, prefixText);
            });
        } else {
            const wTag = getWarlordTag(unit, hideBrackets);
            const wTagText = useColor && wTag ? toAnsi(wTag, colors.attached, true) : wTag;
            const prefixText = wTag ? `${wTagText} ` : '';
            renderDiscordUnit(unit, prefixText);
        }
    });

    if (!plain) out += '```';
    return out;
}

export function resolveFactionColors(data, skippableWargearMap) {
    const factionMap = buildFactionColorMap(skippableWargearMap || {});
    const summary = data.metadata || {};
    const rawFaction = summary.faction || null;
    const factionKey = getCanonicalFactionName(rawFaction);
    if (!factionKey) return null;
    const normalizeKeyLookup = (s) => {
        if (!s) return null;
        try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
    };
    const nfk = normalizeKeyLookup(factionKey);
    const fm = factionMap[factionKey] || factionMap[factionKey.toString().toLowerCase()] || (nfk && factionMap[nfk]);
    return fm || null;
}