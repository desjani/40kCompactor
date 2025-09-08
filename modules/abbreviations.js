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

export function buildAbbreviationIndex(parsedData) {
    // Build a flat map: lowercased full item name -> abbreviation string
    const flat = Object.create(null);

    // Keep a reverse map of used abbreviations -> canonical info so we can
    // detect collisions and expand later items per the requested rule.
    // Structure: used[abbr] = { name: canonicalName, keys: [k1,k2], priority }
    const used = Object.create(null);

    const getPriority = (it) => {
        if (!it || !it.type) return 1;
        if (it.type === 'wargear') return 3;
        if (it.type === 'special') return 2;
        return 1;
    };

    const makeUniqueCandidate = (base, canonicalName) => {
        const first = (canonicalName || '').replace(/\(.*?\)/g, '').replace(/[\-]/g, ' ').trim().split(/\s+/)[0] || '';
        let i = 1;
        while (true) {
            const extra = (first.length > 1) ? first.slice(1, 1 + i).toLowerCase() : String(i);
            const candidate = base + extra;
            if (!used[candidate]) return candidate;
            i++;
            if (i > 100) return base + String(Date.now()).slice(-4);
        }
    };

    if (!parsedData) return { __flat_abbr: flat };

    // Walk units recursively and collect wargear names
    const walk = (node) => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(n => walk(n));
            return;
        }
        if (node.items && Array.isArray(node.items)) {
            for (const it of node.items) {
                if (!it || !it.name) continue;
                const name = it.name.toString().trim();
                const key = name.toLowerCase();
                // Never generate an abbreviation for 'Warlord' - it's always displayed verbatim
                if (key === 'warlord') continue;
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
                        const priority = 2; // enhancements are special-ish
                        if (used[candidate]) {
                            // resolve collision deterministically: prefer higher-priority items
                            const existing = used[candidate];
                            if (priority > existing.priority) {
                                // promote this item to the base candidate, and give the existing a unique new candidate
                                const newExisting = makeUniqueCandidate(candidate, existing.name);
                                // update all flat entries that pointed to the old candidate
                                (existing.keys || []).forEach(k => { flat[k] = newExisting; });
                                used[newExisting] = { name: existing.name, keys: existing.keys, priority: existing.priority };
                                // now register this candidate for current item
                                flat[key] = candidate;
                                used[candidate] = { name, keys: [key], priority };
                            } else {
                                // keep existing, assign a unique candidate for this one
                                const uniq = makeUniqueCandidate(candidate, name);
                                flat[key] = uniq;
                                used[uniq] = { name, keys: [key], priority };
                            }
                        } else {
                            flat[key] = candidate;
                            used[candidate] = { name, keys: [key], priority };
                        }
                        if (stripped && stripped.toLowerCase() !== key) { flat[stripped.toLowerCase()] = flat[key]; used[flat[key]].keys.push(stripped.toLowerCase()); }
                        if (strippedNoParen && strippedNoParen.toLowerCase() !== key && strippedNoParen.toLowerCase() !== stripped.toLowerCase()) { flat[strippedNoParen.toLowerCase()] = flat[key]; used[flat[key]].keys.push(strippedNoParen.toLowerCase()); }
                    }
                }
                // If parser provided nameshort, prefer it
                if (it.nameshort && typeof it.nameshort === 'string' && it.nameshort.trim().length > 0) {
                    // honor explicit parser-provided short name, but still ensure uniqueness
                    let candidate = it.nameshort.trim();
                    const priority = getPriority(it);
                    if (used[candidate]) {
                        const existing = used[candidate];
                        if (priority > existing.priority) {
                            const newExisting = makeUniqueCandidate(candidate, existing.name);
                            (existing.keys || []).forEach(k => { flat[k] = newExisting; });
                            used[newExisting] = { name: existing.name, keys: existing.keys, priority: existing.priority };
                            flat[key] = candidate;
                            used[candidate] = { name, keys: [key], priority };
                        } else {
                            const uniq = makeUniqueCandidate(candidate, name);
                            flat[key] = uniq;
                            used[uniq] = { name, keys: [key], priority };
                        }
                    } else {
                        flat[key] = candidate;
                        used[candidate] = { name, keys: [key], priority };
                    }
                } else if (!flat[key]) {
                    // generate initials but avoid 'NULL' and avoid clobbering existing
                    const gen = makeBaseAbbreviation(name);
                    if (gen && gen.toUpperCase() !== 'NULL') {
                        let candidate = gen;
                        const priority = getPriority(it);
                        if (used[candidate]) {
                            const existing = used[candidate];
                            if (priority > existing.priority) {
                                const newExisting = makeUniqueCandidate(candidate, existing.name);
                                (existing.keys || []).forEach(k => { flat[k] = newExisting; });
                                used[newExisting] = { name: existing.name, keys: existing.keys, priority: existing.priority };
                                flat[key] = candidate;
                                used[candidate] = { name, keys: [key], priority };
                            } else {
                                const uniq = makeUniqueCandidate(candidate, name);
                                flat[key] = uniq;
                                used[uniq] = { name, keys: [key], priority };
                            }
                        } else {
                            flat[key] = candidate;
                            used[candidate] = { name, keys: [key], priority };
                        }
                    }
                }
                // Recurse into nested items
                if (it.items) walk(it.items);
            }
        }
    };

    // Top-level sections are arrays of units
    for (const k of Object.keys(parsedData || {})) {
        if (k === 'SUMMARY') continue;
        const section = parsedData[k];
        walk(section);
    }

    return { __flat_abbr: flat };
}
