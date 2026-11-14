import { isWargearSkippable } from '../utils.js';

// Ironbuilt (ironbuilt.app) list export format. Example shape:
//
//   +==========================================
//   Test — World Eaters
//   Berzerker Warband (2DP) + Vessels of Wrath (1DP)
//   Force Disposition: Purge the Foe
//   2000 / 2000 pts · 17 units
//   +==========================================
//
//   ── UNATTACHED CHARACTERS ───────
//   Angron [WARLORD] [330 pts]
//   Weapons: ➤ Samni’arius and Spinegrinder - strike, ➤ Samni’arius and Spinegrinder - sweep
//
//   Master of Executions [95 pts]
//   Enhancement: Berzerker Glaive (+35)
//   Weapons: Bolt pistol, Axe of dismemberment
//
//   ── BATTLELINE ──────────────────
//   Khorne Berzerkers [170 pts]
//   1x Khorne Berzerker Champion
//   2x Khorne Berzerker w/ eviscerator and bolt pistol
//   Weapons: ➤ Plasma pistol - standard x3, ➤ Plasma pistol - supercharge x3, Bolt pistol x7
//   Wargear: Icon of Khorne
//
//   Total: 2000 pts
//   https://ironbuilt.app/?s=...
//
// "Weapons:" already holds unit-wide totals, so model lines only feed the
// model count. A "➤" marks one profile of a multi-profile weapon; every
// profile repeats the same count, so profiles collapse into one entry.
export function parseIronbuilt(lines, skippableWargearMap = {}) {
    const result = {
        edition: '11th',
        metadata: {
            armyName: '',
            faction: '',
            detachment: '',
            detachments: [],
            detachmentPoints: 0,
            pointsLimit: 0,
            totalPoints: 0,
            forceDispositions: []
        },
        units: []
    };

    if (!Array.isArray(lines) || lines.length === 0) return result;

    const cleanLines = lines.map(l => l.replace(/ /g, ' ').trim());
    const isBanner = (l) => /^\+={5,}$/.test(l);
    const sectionRegex = /^──\s+(.+?)\s+─{3,}$/;
    const unitHeaderRegex = /^(.*?)\s*\[(\d[\d,]*)\s*pts\]$/i;
    const toInt = (s) => parseInt(String(s).replace(/,/g, ''), 10) || 0;

    // 1. Header block between the two "+=====" banners
    let i = cleanLines.findIndex(l => l.length > 0);
    if (i === -1) return result;
    if (isBanner(cleanLines[i])) {
        i++;
        let headerLineCount = 0;
        while (i < cleanLines.length && !isBanner(cleanLines[i])) {
            const line = cleanLines[i++];
            if (!line) continue;
            headerLineCount++;

            let m;
            if ((m = line.match(/^Force\s+Dispositions?\s*:\s*(.*)$/i))) {
                result.metadata.forceDispositions = m[1].split(',').map(s => s.trim()).filter(Boolean);
            } else if ((m = line.match(/^(\d[\d,]*)\s*\/\s*(\d[\d,]*)\s*pts\b/i))) {
                result.metadata.totalPoints = toInt(m[1]);
                result.metadata.pointsLimit = toInt(m[2]);
            } else if (/\(\s*\d+\s*DP\s*\)/i.test(line)) {
                const parts = line.split(/\s+\+\s+/).map(s => s.trim()).filter(Boolean);
                result.metadata.detachments = parts.map(p => p.replace(/\s*\(\s*\d+\s*DP\s*\)\s*$/i, '').trim());
                result.metadata.detachment = result.metadata.detachments.join(', ');
                result.metadata.detachmentPoints = parts.reduce((sum, p) => {
                    const dp = p.match(/\(\s*(\d+)\s*DP\s*\)/i);
                    return sum + (dp ? toInt(dp[1]) : 0);
                }, 0);
            } else if (headerLineCount === 1) {
                // "Army Name — Faction"; with no separator the line is the faction alone.
                const titleMatch = line.match(/^(.*?)\s+[—–]\s+(.*)$/);
                if (titleMatch) {
                    result.metadata.armyName = titleMatch[1].trim();
                    result.metadata.faction = titleMatch[2].trim();
                } else {
                    result.metadata.faction = line;
                }
            }
        }
        i++;
    }

    // 2. Body
    const categoryMap = {
        'UNATTACHED CHARACTERS': 'Characters',
        'CHARACTERS': 'Characters',
        'CHARACTER': 'Characters',
        'EPIC HERO': 'Characters',
        'EPIC HEROES': 'Characters',
        'BATTLELINE': 'Battleline',
        'DEDICATED TRANSPORT': 'Dedicated Transports',
        'DEDICATED TRANSPORTS': 'Dedicated Transports'
    };
    const toCanonicalCategory = (header) => {
        const upper = header.toUpperCase();
        if (categoryMap[upper]) return categoryMap[upper];
        return upper.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    };

    // Adds "Item xN" entries from a comma-separated Weapons:/Wargear: list.
    const addItems = (unit, itemsStr) => {
        const profileMax = new Map();
        itemsStr.split(',').map(s => s.trim()).filter(Boolean).forEach(raw => {
            let item = raw;
            const isProfile = /^➤/.test(item);
            item = item.replace(/^➤\s*/, '');
            let quantity = 1;
            const qtyMatch = item.match(/^(.*?)\s+x(\d+)$/i);
            if (qtyMatch) {
                item = qtyMatch[1].trim();
                quantity = toInt(qtyMatch[2]) || 1;
            }
            if (isProfile) {
                item = item.replace(/\s+-\s+[^-]+$/, '').trim();
                profileMax.set(item, Math.max(profileMax.get(item) || 0, quantity));
                return;
            }
            addWargear(unit, item, quantity);
        });
        profileMax.forEach((quantity, name) => addWargear(unit, name, quantity));
    };

    const addWargear = (unit, name, quantity) => {
        const existing = unit.wargear.find(w => w.name === name);
        if (existing) {
            existing.quantity += quantity;
            return;
        }
        unit.wargear.push({
            name,
            quantity,
            skippable: isWargearSkippable(skippableWargearMap, result.metadata.faction, unit.name, name)
        });
    };

    let currentSection = 'Other Datasheets';
    let currentUnit = null;

    for (; i < cleanLines.length; i++) {
        const line = cleanLines[i];
        if (!line || isBanner(line)) continue;
        if (/^Total\s*:\s*\d/i.test(line) || /^https?:\/\//i.test(line)) {
            currentUnit = null;
            continue;
        }

        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            currentSection = toCanonicalCategory(sectionMatch[1]);
            currentUnit = null;
            continue;
        }

        const unitMatch = line.match(unitHeaderRegex);
        if (unitMatch) {
            const tags = [...unitMatch[1].matchAll(/\[([^\]]+)\]/g)].map(t => t[1].trim());
            currentUnit = {
                name: unitMatch[1].replace(/\[[^\]]*\]/g, '').trim(),
                points: toInt(unitMatch[2]),
                quantity: 1,
                category: currentSection,
                isWarlord: tags.some(t => /^warlord$/i.test(t)),
                wargear: [],
                enhancements: [],
                subunits: []
            };
            result.units.push(currentUnit);
            continue;
        }

        if (!currentUnit) continue;

        let m;
        if ((m = line.match(/^Enhancement\s*:\s*(.*?)\s*(?:\(\+(\d[\d,]*)\s*(?:pts)?\))?$/i))) {
            currentUnit.enhancements.push({ name: m[1].trim(), points: m[2] ? toInt(m[2]) : 0 });
        } else if ((m = line.match(/^(?:Weapons|Wargear)\s*:\s*(.*)$/i))) {
            addItems(currentUnit, m[1]);
        } else if ((m = line.match(/^(\d+)x\s+(.+)$/i))) {
            // Loadout details after "w/" are already counted in Weapons:, so
            // model lines merge by base model name.
            const name = m[2].replace(/\s+w\/.*$/i, '').trim();
            const quantity = toInt(m[1]);
            const existing = currentUnit.subunits.find(s => s.name === name);
            if (existing) {
                existing.quantity += quantity;
            } else {
                currentUnit.subunits.push({ name, quantity, wargear: [] });
            }
            currentUnit.quantity = currentUnit.subunits.reduce((sum, s) => sum + s.quantity, 0);
        }
    }

    return result;
}
