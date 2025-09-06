// Dynamic abbreviation generator: build abbreviation map from parsed list data
// The goal: do not depend on any external JSON (wargear.json or abbreviation_rules.json).
// We'll derive reasonable abbreviations by: using explicit nameshort from parsed items if
// present, else generating a short token by taking initials of significant words.

// Generate a base abbreviation following project rules:
// - Trim parenthetical content and punctuation, split on words
// - Single word -> first two letters uppercase (e.g. "Plasma" -> "PL")
// - Multi-word -> for each word:
//     * if word === 'and' -> use '&'
//     * if word === 'of'  -> use 'o' (lowercase)
//     * otherwise take first letter uppercase
// Example: "Icon of Khorne" -> "IoK" ; "Skullsmasher and Mangler" -> "S&M"
function makeBaseAbbreviation(name) {
    if (!name) return null;
    const cleaned = name.replace(/\(.*?\)/g, '').replace(/[\-]/g, ' ').replace(/["'`.,;:?!]/g, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    const tokens = parts.map(p => {
        const low = p.toString().toLowerCase();
        if (low === 'and') return '&';
        if (low === 'of') return 'o';
        return p[0].toUpperCase();
    });
    return tokens.join('');
}

// Helper exported so renderers can reuse the exact same abbreviation logic when
// the dynamic map isn't available at runtime.
export function makeAbbrevForName(name) {
    return makeBaseAbbreviation(name);
}

export function buildAbbreviationIndex(parsedData, skippableWargearMap) {
    // Build a flat map: lowercased full item name -> abbreviation string
    const flat = Object.create(null);

    // Keep a reverse map of used abbreviations -> canonical name so we can
    // detect collisions and expand later items per the requested rule.
    const used = Object.create(null);

    if (!parsedData) return { __flat_abbr: flat };

    // Local helper to find skippable items for a unit (adapted from renderers.js)
    const HIDE_ALL = '__HIDE_ALL_WARGEARS__';
    function findSkippableForUnitLocal(skippableMap, dataSummary, unitName) {
        if (!skippableMap) return [];
        if (!unitName) return [];
        const normalizeKey = (s) => {
            if (!s) return '';
            try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase().trim(); }
        };
        const unitLower = normalizeKey(unitName);
        const unitAlt = unitLower.endsWith('s') ? unitLower.slice(0, -1) : unitLower + 's';
        const normalize = (list) => {
            if (list === true) return [HIDE_ALL];
            if (Array.isArray(list)) { if (list.length === 0) return []; return list.map(s => (s || '').toString().toLowerCase()); }
            return [];
        };
        const findMapForFaction = (desiredFaction) => {
            if (!desiredFaction) return undefined;
            const want = normalizeKey(desiredFaction);
            if (Object.prototype.hasOwnProperty.call(skippableMap, desiredFaction)) return skippableMap[desiredFaction];
            for (const [k, v] of Object.entries(skippableMap)) { if (!k) continue; if (normalizeKey(k) === want) return v; }
            return undefined;
        };
        // If parsedData.SUMMARY is available, prefer DISPLAY_FACTION or FACTION_KEYWORD
        const faction = (data.SUMMARY && (data.SUMMARY.DISPLAY_FACTION || data.SUMMARY.FACTION_KEYWORD || data.SUMMARY.FACTION)) || '';
        if (faction) {
            const tryKeys = [faction, (faction || '').toString()];
            for (const k of tryKeys) {
                const mapForFaction = findMapForFaction(k);
                if (!mapForFaction) continue;
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
        for (const [k, v] of Object.entries(skippableMap)) {
            if (!k) continue;
            const nk = normalizeKey(k);
            if (nk === unitLower || nk === unitAlt) return normalize(v);
            if (typeof v === 'object') {
                if (Object.prototype.hasOwnProperty.call(v, unitName)) return normalize(v[unitName]);
                if (Object.prototype.hasOwnProperty.call(v, unitLower)) return normalize(v[unitLower]);
                if (Object.prototype.hasOwnProperty.call(v, unitAlt)) return normalize(v[unitAlt]);
                for (const [innerK, innerV] of Object.entries(v)) { if (!innerK) continue; if (normalizeKey(innerK) === unitLower || normalizeKey(innerK) === unitAlt) return normalize(innerV); }
            }
        }
        return [];
    }

    // Walk units recursively and collect wargear names
    const walk = (node, ownerName) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(n => walk(n, ownerName));
            return;
        }
        if (node.items && Array.isArray(node.items)) {
            for (const it of node.items) {
                if (!it || !it.name) continue;
                // Only consider items that will actually be shown in compact output
                // i.e., wargear and special items. Subunits are normally ignored, but
                // sometimes the parser classifies an inline wargear line as a 'subunit'
                // (for example: "3x Ectoplasma cannon"). In that case we detect
                // wargear-looking names via keywords and treat them as wargear for
                // abbreviation indexing.
                // Only consider explicit wargear and special items. Subunits are ignored.
                if (!(it.type === 'wargear' || it.type === 'special')) continue;
                // Respect skippable_wargear.json: if this item would be hidden for the owning unit,
                // do not include it in abbreviation collision checks. We pass the parsed SUMMARY via
                // closure (if available) when resolving skippable entries.
                if (skippableWargearMap && ownerName && typeof ownerName === 'string') {
                    try {
                        const sk = findSkippableForUnitLocal(skippableWargearMap, parsedData.SUMMARY, ownerName);
                        if (sk.includes(HIDE_ALL)) continue;
                        if (sk.length > 0 && sk.includes((it.name || '').toString().toLowerCase())) continue;
                    } catch (e) {
                        // ignore lookup errors and fall back to including the item
                    }
                }
                const name = it.name.toString().trim();
                const key = name.toLowerCase();
                // If this is an Enhancement special, reserve an abbreviation for the
                // stripped enhancement name (without the prefix). We also store the
                // abbreviation under the stripped and stripped-without-paren keys so
                // renderers can look it up in multiple forms.
                if (it.type === 'special' && name.toLowerCase().startsWith('enhancement:')) {
                    const stripped = name.replace(/^Enhancement:\s*/i, '').trim();
                    const strippedNoParen = stripped.replace(/\(.*?\)/g, '').trim();
                    // generate base abbreviation for the stripped name and register it
                    const gen = makeBaseAbbreviation(strippedNoParen || stripped);
                    if (gen && gen.toUpperCase() !== 'NULL') {
                        let candidate = gen;
                        // Treat an existing registration as a collision only if it maps to a different name.
                        if (used[candidate] && used[candidate] !== name) {
                            const first = (strippedNoParen || stripped).split(/\s+/)[0] || '';
                            let i = 1;
                            while (used[candidate] && used[candidate] !== name) {
                                const extra = (first.length > 1) ? first.slice(1, 1 + i).toLowerCase() : String(i);
                                candidate = gen + extra;
                                i++;
                            }
                        }
                        flat[key] = candidate;
                        if (stripped && stripped.toLowerCase() !== key) flat[stripped.toLowerCase()] = candidate;
                        if (strippedNoParen && strippedNoParen.toLowerCase() !== key && strippedNoParen.toLowerCase() !== stripped.toLowerCase()) flat[strippedNoParen.toLowerCase()] = candidate;
                        used[candidate] = name;
                    }
                }
                // If parser provided nameshort, prefer it
                if (it.nameshort && typeof it.nameshort === 'string' && it.nameshort.trim().length > 0) {
                    // honor explicit parser-provided short name, but still ensure uniqueness
                    let candidate = it.nameshort.trim();
                    if (used[candidate] && used[candidate] !== name) {
                        // conflict: expand this item's candidate using letters from first word
                        const first = name.replace(/\(.*?\)/g, '').replace(/[\-]/g, ' ').trim().split(/\s+/)[0] || '';
                        let i = 1;
                        while (used[candidate] && used[candidate] !== name) {
                            const extra = (first.length > 1) ? first.slice(1, 1 + i).toLowerCase() : String(i);
                            candidate = it.nameshort.trim() + extra;
                            i++;
                        }
                    }
                    flat[key] = candidate;
                    used[candidate] = name;
                } else if (!flat[key]) {
                    // generate initials but avoid 'NULL' and avoid clobbering existing
                    const gen = makeBaseAbbreviation(name);
                    if (gen && gen.toUpperCase() !== 'NULL') {
                        let candidate = gen;
                        // Only try to disambiguate if the existing registration maps to a different name
                        if (used[candidate] && used[candidate] !== name) {
                            // Append lowercase letters from the first word until unique
                            const first = name.replace(/\(.*?\)/g, '').replace(/[\-]/g, ' ').trim().split(/\s+/)[0] || '';
                            let i = 1;
                            while (used[candidate] && used[candidate] !== name) {
                                const extra = (first.length > 1) ? first.slice(1, 1 + i).toLowerCase() : String(i);
                                candidate = gen + extra;
                                i++;
                            }
                        }
                        flat[key] = candidate;
                        used[candidate] = name;
                    }
                }
                // Recurse into nested items
                if (it.items) walk(it.items, ownerName);
            }
        }
    };

    // Top-level sections are arrays of units
    for (const k of Object.keys(parsedData || {})) {
        if (k === 'SUMMARY') continue;
        const section = parsedData[k];
        if (Array.isArray(section)) {
            for (const unit of section) {
                const owner = unit && unit.name ? unit.name : undefined;
                walk(unit, owner);
            }
        } else {
            walk(section, undefined);
        }
    }

    return { __flat_abbr: flat };
}
