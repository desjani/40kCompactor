import FAMILY_MAP from './family_map.js';

// Standardize and normalize the SUMMARY object produced by parsers so renderers
// can rely on a consistent set of fields regardless of source format.
export function standardizeSummary(result) {
    if (!result) return result;
    result.SUMMARY = result.SUMMARY || {};
    const s = result.SUMMARY;
    // Ensure keys exist
    s.LIST_TITLE = s.LIST_TITLE || '';
    if (s.FACTION_KEYWORD) s.FACTION_KEYWORD = String(s.FACTION_KEYWORD).trim();
    if (s.DETACHMENT) s.DETACHMENT = String(s.DETACHMENT).replace(/\u00A0/g, ' ').trim();
    if (s.TOTAL_ARMY_POINTS) s.TOTAL_ARMY_POINTS = String(s.TOTAL_ARMY_POINTS).trim();

    // Build or fix DISPLAY_FACTION using FAMILY_MAP when possible. Normalize keys
    // (remove diacritics, map curly apostrophes to straight) so matches like
    // "T’au Empire" -> "T'au Empire" succeed against FAMILY_MAP entries.
    const normalizeKey = (sval) => {
        if (!sval) return '';
        try {
            return sval.toString().normalize('NFD')
                .replace(/\p{M}/gu, '')
                .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
                .replace(/[^\w\s'\-]/g, '')
                .toLowerCase().trim();
        } catch (e) {
            return sval.toString().toLowerCase().trim();
        }
    };

    const fk = s.FACTION_KEYWORD || null;
    if (fk) {
        // Prefer family-based display when FAMILY_MAP contains a matching key
        const want = normalizeKey(fk);
        let familyKey = undefined;
        for (const k of Object.keys(FAMILY_MAP)) {
            if (normalizeKey(k) === want) { familyKey = k; break; }
        }
        if (familyKey) {
            // Normalize apostrophes in faction name for consistent display
            const cleanedFaction = fk.toString().replace(/[\u2018\u2019\u201B\u2032]/g, "'").trim();
            s.DISPLAY_FACTION = `${FAMILY_MAP[familyKey]} - ${cleanedFaction}`;
        } else {
            // Fallback: keep previous behavior (faction [+ detachment])
            s.DISPLAY_FACTION = s.DISPLAY_FACTION || (fk + (s.DETACHMENT ? ` - ${s.DETACHMENT}` : ''));
        }
    } else if (s.DETACHMENT) {
        s.DISPLAY_FACTION = s.DISPLAY_FACTION || s.DETACHMENT;
    } else {
        s.DISPLAY_FACTION = s.DISPLAY_FACTION || '';
    }

    // Ensure a canonical FACTION_KEY exists (lowercased faction identifier)
    if (!s.FACTION_KEY) {
        if (s.FACTION_KEYWORD) {
            try { s.FACTION_KEY = s.FACTION_KEYWORD.toString().toLowerCase(); } catch (e) { s.FACTION_KEY = String(s.FACTION_KEYWORD).toLowerCase(); }
        } else if (s.DISPLAY_FACTION) {
            const base = (s.DISPLAY_FACTION || '').split(' - ')[0];
            try { s.FACTION_KEY = base.toString().toLowerCase(); } catch (e) { s.FACTION_KEY = String(base).toLowerCase(); }
        }
    }

    return result;
}
