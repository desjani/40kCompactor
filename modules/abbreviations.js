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

export function buildAbbreviationIndex(parsedData, customAbbrs = {}) {
    // Build a flat map: lowercased full item name -> abbreviation string
    const flat = Object.create(null);

    // Keep a reverse map of used abbreviations -> canonical info so we can
    // detect collisions and expand later items per the requested rule.
    // Structure: used[abbr] = { name: canonicalName, keys: [k1,k2], priority }
    const used = Object.create(null);

    // 1. Load Custom Abbreviations (Priority 999)
    if (customAbbrs) {
        for (const [name, abbr] of Object.entries(customAbbrs)) {
            if (!name || !abbr) continue;
            const lowerName = name.toLowerCase();
            flat[lowerName] = abbr;
            
            // If multiple custom rules map to the same abbr, the last one wins in 'used' map,
            // but 'flat' map will hold all of them.
            // We treat custom rules as "locked".
            if (!used[abbr]) {
                used[abbr] = { name: name, keys: [lowerName], priority: 999 };
            } else {
                // If collision with another custom rule, just append key
                if (used[abbr].priority === 999) {
                    used[abbr].keys.push(lowerName);
                } else {
                    // Should not happen if we process custom first, but just in case
                    used[abbr] = { name: name, keys: [lowerName], priority: 999 };
                }
            }
        }
    }

    const getPriority = (it) => {
        if (!it || !it.type) return 1;
        if (it.type === 'unit') return 5;
        if (it.type === 'subunit') return 4;
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

    // Produce an abbreviation taking first letter uppercase + `step` more letters lowercase per significant word.
    const makeAbbrevWithStep = (name, step = 0) => {
        if (!name) return '';
        const cleaned = name.replace(/\(.*?\)/g, '').replace(/[\-]/g, ' ').replace(/["'`.,;:?!]/g, '').trim();
        const parts = cleaned.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '';
        if (parts.length === 1) {
            const w = parts[0];
            const head = w.slice(0, 1).toUpperCase();
            const extra = w.slice(1, 1 + Math.max(1, step)).toLowerCase();
            return (head + extra) || w.slice(0, 2).toUpperCase();
        }
        const tokens = parts.map(p => {
            const low = p.toString().toLowerCase();
            if (low === 'and') return '&';
            if (low === 'of') return 'o';
            const head = p.slice(0, 1).toUpperCase();
            const extra = p.slice(1, 1 + Math.max(0, step)).toLowerCase();
            return head + extra;
        });
        return tokens.join('');
    };

    // Track collision groups by base abbreviation.
    // Each member keeps its own step for iterative expansion (one letter per word per cycle).
    const collisionGroups = Object.create(null); // base -> { members: Array<{ name, keys, priority, abbr, step }> }

    const reassignFlatKeys = (keys, newAbbr) => {
        (keys || []).forEach(k => { flat[k] = newAbbr; });
    };

    // Resolve a collision group by iteratively expanding only conflicting members
    // one letter per word per iteration until all become unique and don't clash with external 'used'.
    const resolveGroup = (base) => {
        const grp = collisionGroups[base];
        if (!grp) return;

        // Initialize steps/abbrs if missing
        for (const m of grp.members) {
            if (typeof m.step !== 'number') m.step = 0;
        }

        const maxIterations = 100; // safety guard
        let iter = 0;
        while (iter++ < maxIterations) {
            // Compute current abbreviations for members
            const abbrMap = new Map(); // abbr -> members[]
            for (const m of grp.members) {
                const ab = makeAbbrevWithStep(m.name, m.step);
                m.nextAbbr = ab;
                if (!abbrMap.has(ab)) abbrMap.set(ab, []);
                abbrMap.get(ab).push(m);
            }

            // Determine which members are in conflict (internal or external)
            let anyConflict = false;
            for (const m of grp.members) {
                const ab = m.nextAbbr;
                const internalConflict = (abbrMap.get(ab) || []).length > 1;
                const external = used[ab];
                // If external exists and is high priority (custom), we must conflict
                const externalIsCustom = external && external.priority === 999;
                const externalConflict = !!(external && (!external.keys || !m.keys || external.keys.some(k => !(m.keys||[]).includes(k))));
                // Note: if external is one of our group's previous assignments for the same member, this shouldn't count as conflict
                const externalIsSelf = external && external.name === m.name;
                const conflict = internalConflict || (externalConflict && !externalIsSelf) || (externalIsCustom && !externalIsSelf);
                m._conflict = conflict;
                if (conflict) anyConflict = true;
            }

            if (!anyConflict) {
                // Commit: update used and flat for all members
                for (const m of grp.members) {
                    const ab = m.nextAbbr;
                    if (m.abbr && m.abbr !== ab && used[m.abbr]) delete used[m.abbr];
                    reassignFlatKeys(m.keys, ab);
                    used[ab] = { name: m.name, keys: m.keys, priority: m.priority };
                    m.abbr = ab;
                }
                // Clean temp fields
                grp.members.forEach(m => { delete m.nextAbbr; delete m._conflict; });
                return;
            }

            // Increment step for conflicting members only (per spec)
            for (const m of grp.members) {
                if (m._conflict && m.priority !== 999) m.step = (m.step || 0) + 1;
            }
        }

        // Fallback: if still conflicted after max iterations, append numerals to force uniqueness
        const abbrCount = Object.create(null);
        for (const m of grp.members) {
            let ab = makeAbbrevWithStep(m.name, m.step || 0);
            if (abbrCount[ab]) {
                abbrCount[ab] += 1;
                ab = ab + String(abbrCount[ab]);
            } else {
                abbrCount[ab] = 1;
            }
            if (m.abbr && m.abbr !== ab && used[m.abbr]) delete used[m.abbr];
            reassignFlatKeys(m.keys, ab);
            used[ab] = { name: m.name, keys: m.keys, priority: m.priority };
            m.abbr = ab;
        }
        grp.members.forEach(m => { delete m.nextAbbr; delete m._conflict; });
    };

    const registerInGroup = (name, key, priority, base) => {
        let grp = collisionGroups[base];
        if (!grp) {
            const existing = used[base];
            if (!existing) return null; // should not happen
            grp = collisionGroups[base] = { members: [
                { name: existing.name, keys: existing.keys || [], priority: existing.priority || 1, abbr: base, step: 0 },
                { name, keys: [key], priority, abbr: base, step: 0 }
            ] };
            // Remove the simplistic base entry; will be re-assigned after resolution
            delete used[base];
            resolveGroup(base);
            // return abbr for the new member
            const last = grp.members[1];
            return last.abbr;
        }
    // Add to existing group; reset steps so the entire set resolves fairly from the same baseline
    grp.members.forEach(m => { m.step = 0; });
    grp.members.push({ name, keys: [key], priority, abbr: '', step: 0 });
        resolveGroup(base);
        const me = grp.members[grp.members.length - 1];
        return me.abbr;
    };

    if (!parsedData) return { __flat_abbr: flat };

    const processItem = (name, type) => {
        if (!name) return;
        const key = name.toString().trim().toLowerCase();
        if (key === 'warlord') return;
        if (flat[key]) return;

        const base = makeBaseAbbreviation(name);
        if (base && base.toUpperCase() !== 'NULL') {
            const priority = getPriority({ type });
            if (used[base]) {
                const assigned = registerInGroup(name, key, priority, base);
                if (assigned) flat[key] = assigned;
            } else if (collisionGroups[base]) {
                const assigned = registerInGroup(name, key, priority, base);
                if (assigned) flat[key] = assigned;
            } else {
                flat[key] = base;
                used[base] = { name, keys: [key], priority };
            }
        }
    };

    if (Array.isArray(parsedData.units)) {
        for (const unit of parsedData.units) {
            if (Array.isArray(unit.wargear)) {
                for (const wg of unit.wargear) {
                    processItem(wg.name, 'wargear');
                }
            }
            if (Array.isArray(unit.enhancements)) {
                for (const enh of unit.enhancements) {
                    processItem(enh.name, 'special');
                }
            }
            if (Array.isArray(unit.subunits)) {
                for (const sub of unit.subunits) {
                    processItem(sub.name, 'subunit');
                    if (Array.isArray(sub.wargear)) {
                        for (const wg of sub.wargear) {
                            processItem(wg.name, 'wargear');
                        }
                    }
                }
            }
        }
    }

    return { __flat_abbr: flat };
}
