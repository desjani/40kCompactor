/**
 * 11th Edition List Format Detector
 */

export function detectV11Format(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return 'UNKNOWN';

    // Check if any line in the file indicates a GW App export
    const hasGwAppMarker = lines.some(l => 
        /^Export.*(?:App.*Version|Version.*App)/i.test(l) || 
        /Version.*D(?:onné|ata|aten|ato)/i.test(l)
    );

    if (hasGwAppMarker) {
        return 'GW_APP_V11';
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
