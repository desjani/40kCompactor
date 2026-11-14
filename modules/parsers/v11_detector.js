/**
 * 11th Edition List Format Detector
 */

export function detectV11Format(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return 'UNKNOWN';

    // Check for New Recruit format header (starts with a block of pluses)
    const firstNonEmptyIndex = lines.findIndex(l => l.trim().length > 0);
    const hasNrHeader = firstNonEmptyIndex !== -1 && lines[firstNonEmptyIndex].trim().startsWith('+++');
    if (hasNrHeader) {
        let headerEndIndex = 0;
        for (let i = firstNonEmptyIndex + 1; i < lines.length; i++) {
            if (lines[i].trim().startsWith('+++')) {
                headerEndIndex = i;
                break;
            }
        }

        const bodyLines = lines.slice(headerEndIndex + 1).map(l => l.trim()).filter(Boolean);

        // Check for the Tournament export style (New Recruit's current name for
        // what this codebase used to call "WTC-Compact"; the standalone "WTC"
        // format this used to distinguish from ("NR_WTC") no longer exists as a
        // New Recruit export option and has been removed).
        const hasCompactColon = bodyLines.some(l =>
            /^[A-Za-z0-9:\s•◦\*-]+?\(\d+\s*(?:pts|points|pt)\):\s*\S+/i.test(l)
        );
        if (hasCompactColon) {
            return 'NR_TOURNAMENT';
        }

        return 'NR_GW';
    }

    // Newer New Recruit Tournament exports drop the "+++" header block entirely,
    // so they fall through to here. They're still unambiguously distinguishable
    // from every other format by the body syntax unique to NR Tournament: an
    // id-prefixed unit header ("Char1: 1x Angron (330 pts)"), the "Leading X[N]"
    // forward hint, or the "Attached to X" backlink used to merge attached units.
    const hasIdPrefixedUnit = lines.some(l =>
        /^(?:Char|Infa|Unit)\d*:\s*(?:\d+x?\s+)?.+\(\d+[\d,]*\s*(?:pts|points|pt)\)/i.test(l.trim())
    );
    const hasAttachedToBacklink = lines.some(l => /^\s*Attached to\s+\S.*$/i.test(l));
    const hasLeadingHint = lines.some(l => /^Leading\s+\S.*$/i.test(l.trim()));
    if (hasIdPrefixedUnit || hasAttachedToBacklink || hasLeadingHint) {
        return 'NR_TOURNAMENT';
    }

    // Check for a Warmind export. Its footer line ("Built with Warmind ·
    // https://warmind.online") is unambiguous; fall back to the "Total: X / Y
    // pts · A/B DP" summary line in case the footer gets trimmed off a paste.
    const hasWarmindFooter = lines.some(l => /warmind/i.test(l));
    const hasWarmindTotalLine = lines.some(l =>
        /^Total:\s*\d+[\d,]*\s*\/\s*\d+[\d,]*\s*pts\s*·\s*\d+\s*\/\s*\d+\s*DP/i.test(l.trim())
    );
    if (hasWarmindFooter || hasWarmindTotalLine) {
        return 'WARMIND_V11';
    }

    // Check for an Ironbuilt export. Its share-link footer
    // ("https://ironbuilt.app/?s=...") is unambiguous; fall back to its
    // "+=====" header banner plus "── SECTION ───" headers if that's trimmed.
    const hasIronbuiltLink = lines.some(l => /ironbuilt/i.test(l));
    const hasIronbuiltBanner = firstNonEmptyIndex !== -1 && /^\+={5,}\s*$/.test(lines[firstNonEmptyIndex].trim());
    const hasIronbuiltSection = lines.some(l => /^──\s+.+?\s+─{3,}\s*$/.test(l.trim()));
    if (hasIronbuiltLink || (hasIronbuiltBanner && hasIronbuiltSection)) {
        return 'IRONBUILT_V11';
    }

    // Check if any line in the file indicates a GW App export
    const hasGwAppMarker = lines.some(l =>
        /^Export.*(?:App.*Version|Version.*App)/i.test(l) || 
        /Version.*D(?:onné|ata|aten|ato)/i.test(l)
    );

    if (hasGwAppMarker) {
        return 'GW_APP_V11';
    }

    // Check if any line indicates a War Organ export
    const hasWarOrganMarker = lines.some(l => 
        /warorgan/i.test(l)
    );
    if (hasWarOrganMarker) {
        return 'WAR_ORGAN_V11';
    }

    const first10NonEmpty = lines
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, 10);

    if (first10NonEmpty.length >= 3) {
        const line0 = first10NonEmpty[0];
        const hasPointsHeader = /^.+?\s*[\[\(]\d+\s*(?:points|pts)[\]\)]$/i.test(line0);
        
        const hasBattleSize = first10NonEmpty.some(l => 
            /^(?:Battle Size:\s*)?(?:Strike Force|Incursion|Onslaught|Combat Patrol|StrikeForce)\s*\(\d+\s*(?:point limit|point|points|pts)\)$/i.test(l)
        );

        if (hasPointsHeader && hasBattleSize) {
            return 'WAR_ORGAN_V11';
        }
    }

    // Look at first 15 lines for generic V11 headers
    const first15 = lines
        .slice(0, 15)
        .map(l => l.trim().toLowerCase())
        .filter(Boolean);

    // If it explicitly says 11th Edition or has generic V11 tags
    const hasGenericV11 = first15.some(l => 
        l.includes('11th edition') || 
        l.includes('v11') || 
        /^\[[^\]]+\]\s+.*?\(\d+\s*(?:pts|points|punkte|puntos|punti)\)$/i.test(l)
    );

    if (hasGenericV11) {
        return 'V11_GENERIC';
    }

    // Fallback detection for GW App if the app version string was omitted
    const hasFaction = first15.some(l => l.startsWith('faction:'));
    const hasDetachment = first15.some(l => l.startsWith('detachment:'));
    if (hasFaction || hasDetachment) {
        return 'V11_GENERIC';
    }

    // Heuristics for GW App headers:
    // e.g. third line is faction (T'au Empire, World Eaters, etc.)
    // and fourth line is battle size like "Strike Force (2000 points)"
    const hasBattleSize = first15.some(l => 
        l.includes('strike force (') || 
        l.includes('incursion (') || 
        l.includes('onslaught (') ||
        /^(?:strike force|incursion|onslaught|force de frappe|fuerza de combate|einsatzverband|forza d'attacco|incursione|scharmützel|assalto|embate|offensive|ansturm)\s*\(\d+\s*(?:pts|points|punkte|puntos|punti)\)/i.test(l) ||
        (!l.includes('v11') && !l.includes('edition') && !l.includes('faction') && !l.includes('detachment') && /\(\d+\s*(?:pts|points|punkte|puntos|punti)\)/i.test(l))
    );
    if (hasBattleSize) {
        return 'GW_APP_V11';
    }

    return 'UNKNOWN';
}
