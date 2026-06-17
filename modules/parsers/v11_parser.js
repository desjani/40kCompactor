import { isWargearSkippable } from '../utils.js';

export function parseV11List(lines, skippableWargearMap = {}) {
    const result = {
        edition: '11th',
        metadata: {
            title: '',
            faction: '',
            detachment: '',
            pointsLimit: 0,
            pointsTotal: 0
        },
        units: []
    };

    if (!Array.isArray(lines)) return result;

    let currentUnit = null;

    // Helper to parse quantity and name: e.g. "2x Storm Bolter" -> { name: "Storm Bolter", quantity: 2 }
    const parseQtyAndName = (str, unitName) => {
        const cleaned = str.trim();
        let name = cleaned;
        let quantity = 1;
        const match = cleaned.match(/^(\d+)x?\s+(.*)$/i);
        if (match) {
            name = match[2].trim();
            quantity = parseInt(match[1], 10);
        }
        const skippable = isWargearSkippable(skippableWargearMap, result.metadata.faction, unitName, name);
        return {
            name,
            quantity,
            skippable
        };
    };

    for (let line of lines) {
        const raw = line;
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. Parse Metadata / Headers
        if (trimmed.startsWith('===') && trimmed.endsWith('===')) {
            result.metadata.title = trimmed.replace(/===/g, '').trim();
            continue;
        }

        const metaMatch = trimmed.match(/^(Faction|Detachment|Points):\s*(.*)$/i);
        if (metaMatch) {
            const key = metaMatch[1].toLowerCase();
            const val = metaMatch[2].trim();
            if (key === 'faction') {
                result.metadata.faction = val;
            } else if (key === 'detachment') {
                result.metadata.detachment = val;
            } else if (key === 'points') {
                // e.g. "1990 / 2000" or "1990"
                const parts = val.split('/');
                result.metadata.pointsTotal = parseInt(parts[0].trim(), 10) || 0;
                if (parts[1]) {
                    result.metadata.pointsLimit = parseInt(parts[1].trim(), 10) || 0;
                }
            }
            continue;
        }

        // 2. Parse Unit Header
        // e.g. "[Leader] Captain in Terminator Armour (95 pts)" or "[Line] 5x Terminator Squad (185 pts)"
        const unitMatch = trimmed.match(/^\[([^\]]+)\]\s+(?:(\d+)x?\s+)?(.*?)\s*\((\d+)\s*(?:pts|points)\)$/i);
        if (unitMatch) {
            const category = unitMatch[1].trim();
            const quantity = unitMatch[2] ? parseInt(unitMatch[2], 10) : 1;
            const name = unitMatch[3].trim();
            const points = parseInt(unitMatch[4], 10) || 0;

            currentUnit = {
                name,
                points,
                quantity,
                category,
                wargear: [],
                enhancements: [],
                subunits: []
            };
            result.units.push(currentUnit);
            continue;
        }

        // If we don't have a unit context yet, skip item parsing
        if (!currentUnit) continue;

        // 3. Parse Unit Wargear
        // e.g. "- Wargear: Relic Weapon, Storm Bolter"
        if (trimmed.toLowerCase().startsWith('- wargear:')) {
            const itemsStr = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
            items.forEach(it => {
                currentUnit.wargear.push(parseQtyAndName(it, currentUnit.name));
            });
            continue;
        }

        // 4. Parse Enhancement
        // e.g. "- Enhancement: Artificer Armour (10 pts)"
        if (trimmed.toLowerCase().startsWith('- enhancement:')) {
            const enhContent = trimmed.substring(trimmed.indexOf(':') + 1).trim();
            const enhMatch = enhContent.match(/^(.*?)\s*\((\d+)\s*(?:pts|points)\)$/i);
            if (enhMatch) {
                currentUnit.enhancements.push({
                    name: enhMatch[1].trim(),
                    points: parseInt(enhMatch[2], 10) || 0
                });
            } else {
                currentUnit.enhancements.push({
                    name: enhContent,
                    points: 0
                });
            }
            continue;
        }

        // 5. Parse Subunits / Models
        // e.g. "* 1x Terminator Sergeant: Power Weapon, Storm Bolter"
        // or "* 4x Terminator: 4x Power Fist, 4x Storm Bolter"
        const subunitMatch = trimmed.match(/^\*\s+(\d+)x?\s+([^:]+):\s*(.*)$/i);
        if (subunitMatch) {
            const qty = parseInt(subunitMatch[1], 10) || 1;
            const subName = subunitMatch[2].trim();
            const itemsStr = subunitMatch[3].trim();
            const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);

            const subunit = {
                name: subName,
                quantity: qty,
                wargear: []
            };

            items.forEach(it => {
                subunit.wargear.push(parseQtyAndName(it, currentUnit.name));
            });

            currentUnit.subunits.push(subunit);
            continue;
        }
    }

    return result;
}
