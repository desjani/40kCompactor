import { isWargearSkippable } from '../utils.js';

// Warmind (warmind.online) list export format. Example shape:
//
//   Test
//   ──────────────────────────────
//   Faction: World Eaters
//   Detachment: Berzerker Warband, Vessels of Wrath
//   Battle Size: Strike Force (2000 pts)
//   Total: 2000 / 2000 pts · 3/3 DP · ✓ Legal
//   Disposition: Priority Assets
//
//   EPIC HERO
//   Angron (330 pts) · Warlord
//      · Samni’arius and Spinegrinder
//
//   BATTLELINE
//   Master of Executions (95 pts)
//      · Bolt Pistol, Axe of Dismemberment
//      · Enhancement: Berzerker Glaive (+35 pts)
//      └ Leads: Khorne Berzerkers ×10 (170 pts)
//         · 7× Bolt Pistol, Icon of Khorne, 3× Plasma Pistol, 8× Chainblade, 2× Khornate Eviscerator
//
//   ──────────────────────────────
//   2000 / 2000 pts · 17 units · Strike Force
//   Built with Warmind · https://warmind.online
//
// Indentation uses non-breaking spaces (3 per level) ahead of a "·" (detail)
// or "└" (Leads:) bullet.
export function parseWarmind(lines, skippableWargearMap = {}) {
    const result = {
        edition: '11th',
        metadata: {
            armyName: '',
            faction: '',
            detachment: '',
            detachments: [],
            battleSize: '',
            pointsLimit: 0,
            totalPoints: 0,
            detachmentPoints: 0,
            detachmentPointsLimit: 0,
            isLegal: true,
            forceDispositions: []
        },
        units: []
    };

    if (!Array.isArray(lines) || lines.length === 0) return result;

    const cleanLines = lines.map(l => l.replace(/ /g, ' ').trimEnd());
    const isNonEmpty = (l) => l.trim().length > 0;
    const isSeparator = (l) => /^[─\-_=]{3,}$/.test(l.trim());

    let i = 0;
    while (i < cleanLines.length && !isNonEmpty(cleanLines[i])) i++;

    // The army title is a free-text line before any "Key: value" metadata or
    // the dashed separator beneath it; not every export necessarily has one.
    if (i < cleanLines.length) {
        const trimmed = cleanLines[i].trim();
        if (!isSeparator(trimmed) && !/^(?:Faction|Detachment|Battle\s*Size|Total|Disposition)\s*:/i.test(trimmed)) {
            result.metadata.armyName = trimmed;
            i++;
        }
    }

    // 1. Metadata header
    while (i < cleanLines.length) {
        const trimmed = cleanLines[i].trim();
        if (!trimmed) { i++; continue; }
        if (isSeparator(trimmed)) { i++; continue; }

        let m;
        if ((m = trimmed.match(/^Faction\s*:\s*(.*)$/i))) {
            result.metadata.faction = m[1].trim();
            i++; continue;
        }
        if ((m = trimmed.match(/^Detachment\s*:\s*(.*)$/i))) {
            result.metadata.detachment = m[1].trim();
            result.metadata.detachments = m[1].split(',').map(s => s.trim()).filter(Boolean);
            i++; continue;
        }
        if ((m = trimmed.match(/^Battle\s*Size\s*:\s*(.*?)\s*\((\d+[\d,]*)\s*pts?\)\s*$/i))) {
            result.metadata.battleSize = m[1].trim();
            result.metadata.pointsLimit = parseInt(m[2].replace(/,/g, ''), 10) || 0;
            i++; continue;
        }
        if ((m = trimmed.match(/^Total\s*:\s*(\d+[\d,]*)\s*\/\s*(\d+[\d,]*)\s*pts\s*·\s*(\d+)\s*\/\s*(\d+)\s*DP(?:\s*·\s*(.*))?$/i))) {
            result.metadata.totalPoints = parseInt(m[1].replace(/,/g, ''), 10) || 0;
            if (!result.metadata.pointsLimit) {
                result.metadata.pointsLimit = parseInt(m[2].replace(/,/g, ''), 10) || 0;
            }
            result.metadata.detachmentPoints = parseInt(m[3], 10) || 0;
            result.metadata.detachmentPointsLimit = parseInt(m[4], 10) || 0;
            if (m[5]) {
                result.metadata.isLegal = /legal/i.test(m[5]) && !/illegal/i.test(m[5]);
            }
            i++; continue;
        }
        if ((m = trimmed.match(/^Disposition\s*:\s*(.*)$/i))) {
            result.metadata.forceDispositions = m[1].split(',').map(s => s.trim()).filter(Boolean);
            i++; continue;
        }

        break;
    }

    // 2. Body: category headers and unit blocks
    const categoryMap = {
        'EPIC HERO': 'Characters',
        'CHARACTER': 'Characters',
        'CHARACTERS': 'Characters',
        'BATTLELINE': 'Battleline',
        'DEDICATED TRANSPORT': 'Dedicated Transports',
        'DEDICATED TRANSPORTS': 'Dedicated Transports'
    };
    const toCanonicalCategory = (header) => {
        if (categoryMap[header]) return categoryMap[header];
        return header.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    };
    // A category header is a bare, all-caps line (e.g. "BATTLELINE", "DEDICATED
    // TRANSPORT") with no points value and no bullet prefix.
    const isCategoryHeader = (trimmed) => /^[A-Z][A-Z\s]*$/.test(trimmed);

    const unitHeaderRegex = /^(.*?)\s*(?:×\s*(\d+)\s*)?\((\d+[\d,]*)\s*pts\)(?:\s*·\s*(.*))?$/i;
    const footerSummaryRegex = /·\s*\d+\s*units?\s*·/i;
    const builtWithRegex = /^Built with Warmind/i;

    const parseQtyAndName = (str, unitName) => {
        const cleaned = str.trim();
        const match = cleaned.match(/^(\d+)\s*×\s*(.*)$/);
        let name = cleaned;
        let quantity = 1;
        if (match) {
            quantity = parseInt(match[1], 10) || 1;
            name = match[2].trim();
        }
        const skippable = isWargearSkippable(skippableWargearMap, result.metadata.faction, unitName, name);
        return { name, quantity, skippable };
    };

    const parseBulletLine = (line) => {
        const trimmed = line.trim();
        const m = trimmed.match(/^([·└])\s*(.*)$/);
        if (!m) return null;
        return {
            indent: line.length - line.trimStart().length,
            bullet: m[1],
            content: m[2].trim()
        };
    };

    let currentSection = 'Other Datasheets';

    while (i < cleanLines.length) {
        const trimmed = cleanLines[i].trim();
        if (!trimmed) { i++; continue; }
        if (isSeparator(trimmed) || builtWithRegex.test(trimmed) || footerSummaryRegex.test(trimmed)) {
            i++; continue;
        }

        if (isCategoryHeader(trimmed)) {
            currentSection = toCanonicalCategory(trimmed);
            i++;
            continue;
        }

        const unitMatch = trimmed.match(unitHeaderRegex);
        if (unitMatch) {
            const unit = {
                name: unitMatch[1].trim(),
                points: parseInt(unitMatch[3].replace(/,/g, ''), 10) || 0,
                quantity: unitMatch[2] ? parseInt(unitMatch[2], 10) : 1,
                category: currentSection,
                isWarlord: false,
                wargear: [],
                enhancements: [],
                subunits: []
            };

            const tagsStr = unitMatch[4] ? unitMatch[4].trim() : '';
            if (tagsStr) {
                tagsStr.split('·').map(s => s.trim()).filter(Boolean).forEach(tag => {
                    if (/^warlord$/i.test(tag)) unit.isWarlord = true;
                });
            }
            i++;

            // A unit that leads another (via a "└ Leads:" line) gets its own
            // block merged with that led unit into an Attached Units wrapper,
            // the shape the renderers already understand from the GW App parser.
            let ledUnit = null;

            while (i < cleanLines.length) {
                const nextRaw = cleanLines[i];
                if (!isNonEmpty(nextRaw)) { i++; continue; }

                const bullet = parseBulletLine(nextRaw);
                if (!bullet) break;

                if (bullet.bullet === '└') {
                    const leadsMatch = bullet.content.match(/^Leads\s*:\s*(.*)$/i);
                    const leadsUnitMatch = leadsMatch && leadsMatch[1].trim().match(unitHeaderRegex);
                    if (leadsUnitMatch) {
                        ledUnit = {
                            name: leadsUnitMatch[1].trim(),
                            points: parseInt(leadsUnitMatch[3].replace(/,/g, ''), 10) || 0,
                            quantity: leadsUnitMatch[2] ? parseInt(leadsUnitMatch[2], 10) : 1,
                            category: currentSection,
                            wargear: [],
                            enhancements: [],
                            subunits: []
                        };
                    }
                    i++;
                    continue;
                }

                // bullet === '·': belongs to the led unit once "Leads:" has
                // introduced one, otherwise to the leader/standalone unit itself.
                const target = ledUnit || unit;
                const content = bullet.content;

                const enhMatch = content.match(/^Enhancement\s*:\s*(.*?)\s*\(\+(\d+[\d,]*)\s*pts\)\s*$/i);
                if (enhMatch) {
                    target.enhancements.push({
                        name: enhMatch[1].trim(),
                        points: parseInt(enhMatch[2].replace(/,/g, ''), 10) || 0
                    });
                    i++;
                    continue;
                }
                if (/^warlord$/i.test(content)) {
                    unit.isWarlord = true;
                    i++;
                    continue;
                }

                content.split(',').map(s => s.trim()).filter(Boolean).forEach(item => {
                    target.wargear.push(parseQtyAndName(item, target.name));
                });
                i++;
            }

            if (ledUnit) {
                result.units.push({
                    name: unit.name,
                    points: unit.points + ledUnit.points,
                    category: 'Attached Units',
                    isAttached: true,
                    attachedParts: [
                        { ...unit, role: 'Leader' },
                        { ...ledUnit, role: 'Bodyguard' }
                    ]
                });
            } else {
                result.units.push(unit);
            }
            continue;
        }

        i++;
    }

    return result;
}
