import { isWargearSkippable, parseNewRecruitHeader } from '../utils.js';

export function parseNRGW(lines, skippableWargearMap = {}) {
    if (!Array.isArray(lines) || lines.length === 0) {
        return {
            edition: '11th',
            metadata: {
                title: '', armyName: '', faction: '', detachment: '', detachments: [],
                pointsTotal: 0, totalPoints: 0, pointsLimit: 0, forceDispositions: [],
                warlordName: '', warlordId: '', enhancements: []
            },
            units: []
        };
    }

    // TODO: Re-add Force Dispositions when New Recruit adds support
    // TODO: Re-add Attached Units when New Recruit adds support

    const cleanLines = lines.map(l => l ? l.replace(/\u00a0/g, ' ') : '');
    const { metadata, nextIndex } = parseNewRecruitHeader(cleanLines);
    const result = {
        edition: '11th',
        metadata,
        units: []
    };

    let currentUnit = null;
    let currentSubunit = null;
    let currentCategory = 'Other Datasheets';

    const parseQtyAndName = (str, unitName) => {
        const cleaned = str.trim();
        let name = cleaned;
        let quantity = 1;
        const match = cleaned.match(/^(\d+)x?\s+(.*)$/i);
        if (match) {
            name = match[2].trim();
            quantity = parseInt(match[1], 10);
        }
        name = name.replace(/^with\s+/i, '').trim();
        const skippable = isWargearSkippable(skippableWargearMap, result.metadata.faction, unitName, name);
        return {
            name,
            quantity,
            skippable
        };
    };

    const getCategory = (str) => {
        const lower = str.trim().toLowerCase();
        if (lower.startsWith('character')) return 'Characters';
        if (lower.startsWith('battleline')) return 'Battleline';
        if (lower.startsWith('dedicated transport')) return 'Dedicated Transports';
        if (lower.startsWith('other datasheet')) return 'Other Datasheets';
        return null;
    };

    const getNextNonEmptyLineIndentAndContent = (startIndex) => {
        let idx = startIndex;
        while (idx < cleanLines.length) {
            const line = cleanLines[idx];
            const trimmed = line.trim();
            if (trimmed.length > 0) {
                const leadingSpaces = line.length - line.trimStart().length;
                return { indent: leadingSpaces, content: trimmed };
            }
            idx++;
        }
        return null;
    };

    for (let i = nextIndex; i < cleanLines.length; i++) {
        const line = cleanLines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const leadingSpaces = line.length - line.trimStart().length;

        // 1. Check for Category header
        const cat = getCategory(trimmed);
        if (cat) {
            currentCategory = cat;
            currentUnit = null;
            currentSubunit = null;
            continue;
        }

        // 2. Check for bulleted lines (starts with • or * or -)
        const bulletMatch = trimmed.match(/^([•\*\-◦\u25e6\u2022])\s*(.*)$/);
        if (bulletMatch) {
            const content = bulletMatch[2].trim();

            if (content.toLowerCase() === 'warlord') {
                if (currentUnit) currentUnit.isWarlord = true;
                continue;
            }

            // Check for enhancement:
            const enhMatch = content.match(/^(.*?)\s*\(\+(\d+)\s*(?:pts|points|pt)\)/i);
            if (enhMatch) {
                if (currentUnit) {
                    currentUnit.enhancements.push({
                        name: enhMatch[1].trim(),
                        points: parseInt(enhMatch[2], 10) || 0
                    });
                }
                continue;
            }

            // Subunit detection based on next line indentation
            const next = getNextNonEmptyLineIndentAndContent(i + 1);
            const isSubunitHeader = next && next.indent > leadingSpaces;

            if (isSubunitHeader && leadingSpaces <= 2) {
                // It is a subunit header
                const match = content.match(/^(?:(\d+)x?\s+)?(.*)$/);
                const quantity = match && match[1] ? parseInt(match[1], 10) : 1;
                const name = match ? match[2].trim() : content;

                currentSubunit = {
                    name,
                    quantity,
                    wargear: []
                };

                if (currentUnit) {
                    currentUnit.subunits.push(currentSubunit);
                }
            } else {
                // It is wargear (unit-level or subunit-level)
                const items = content.split(',').map(s => s.trim()).filter(Boolean);
                items.forEach(it => {
                    const parsedWg = parseQtyAndName(it, currentUnit ? currentUnit.name : '');
                    if (currentSubunit && leadingSpaces > 2) {
                        currentSubunit.wargear.push(parsedWg);
                    } else if (currentUnit) {
                        currentUnit.wargear.push(parsedWg);
                    }
                });
            }
            continue;
        }

        // 3. Unit Header line
        const unitMatch = trimmed.match(/^(?![•\*\-\s])(.*?)\s*\((\d+)\s*(?:pts|points|pt)\)$/i);
        if (unitMatch) {
            const name = unitMatch[1].trim();
            const points = parseInt(unitMatch[2], 10) || 0;

            currentUnit = {
                name,
                points,
                quantity: 1,
                category: currentCategory,
                wargear: [],
                enhancements: [],
                subunits: []
            };

            // Check if is Warlord via header metadata matching
            if (result.metadata.warlordName && name.toLowerCase() === result.metadata.warlordName.toLowerCase()) {
                currentUnit.isWarlord = true;
            }

            result.units.push(currentUnit);
            currentSubunit = null; // Reset subunit context
            continue;
        }
    }

    return result;
}
