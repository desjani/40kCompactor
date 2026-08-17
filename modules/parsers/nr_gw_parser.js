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
    let inAttachedSection = false;
    let currentAttachedGroup = null;
    let warlordFoundExplicitly = false;

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

    // Add a parsed wargear item to a target list, summing into an existing entry of
    // the same name instead of pushing a duplicate. The same wargear name can appear
    // across multiple separate bullet lines within one unit/subunit (e.g. two "1x
    // Drone burst cannon" bullets for the same model).
    const addWargear = (targetArray, parsedWg) => {
        const existing = targetArray.find(w => w.name === parsedWg.name);
        if (existing) {
            existing.quantity += parsedWg.quantity;
        } else {
            targetArray.push(parsedWg);
        }
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

        // 1. Check for the "Attached Units" section header
        if (/^attached units$/i.test(trimmed)) {
            inAttachedSection = true;
            currentCategory = 'Attached Units';
            currentUnit = null;
            currentSubunit = null;
            currentAttachedGroup = null;
            continue;
        }

        // 2. Check for Category header (also ends an "Attached Units" section, since
        // a list can mix attached groups with standalone Characters/Battleline units)
        const cat = getCategory(trimmed);
        if (cat) {
            currentCategory = cat;
            currentUnit = null;
            currentSubunit = null;
            inAttachedSection = false;
            currentAttachedGroup = null;
            continue;
        }

        // 3. Check for an "Attached Unit N" group header within the Attached Units section
        const attachedGroupMatch = inAttachedSection && trimmed.match(/^attached unit\s+(\d+)$/i);
        if (attachedGroupMatch) {
            currentAttachedGroup = {
                name: `Attached Unit ${attachedGroupMatch[1]}`,
                points: 0,
                category: 'Attached Units',
                isAttached: true,
                attachedParts: []
            };
            result.units.push(currentAttachedGroup);
            currentUnit = null;
            currentSubunit = null;
            continue;
        }

        // 4. Check for bulleted lines (starts with • or * or -)
        const bulletMatch = trimmed.match(/^([•\*\-◦\u25e6\u2022])\s*(.*)$/);
        if (bulletMatch) {
            const content = bulletMatch[2].trim();

            // Check for "Attached as: Leader/Bodyguard" role marker
            const attachedAsMatch = content.match(/^attached as\s*:\s*(.*)$/i);
            if (attachedAsMatch) {
                if (currentUnit) {
                    currentUnit.attachedAs = attachedAsMatch[1].trim();
                    const roleStr = currentUnit.attachedAs.toLowerCase();
                    if (/leader/i.test(roleStr)) {
                        currentUnit.role = 'Leader';
                    } else if (/bodyguard/i.test(roleStr)) {
                        currentUnit.role = 'Bodyguard';
                    }
                }
                continue;
            }

            if (content.toLowerCase() === 'warlord') {
                if (currentUnit) {
                    currentUnit.isWarlord = true;
                    warlordFoundExplicitly = true;
                }
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
                        addWargear(currentSubunit.wargear, parsedWg);
                    } else if (currentUnit) {
                        addWargear(currentUnit.wargear, parsedWg);
                    }
                });
            }
            continue;
        }

        // 5. Unit Header line
        const unitMatch = trimmed.match(/^(?![•\*\-\s])(.*?)\s*\((\d+)\s*(?:pts|points|pt)\)$/i);
        if (unitMatch) {
            const name = unitMatch[1].trim();
            const points = parseInt(unitMatch[2], 10) || 0;

            currentUnit = {
                name,
                points,
                quantity: 1,
                category: inAttachedSection ? 'Attached Units' : currentCategory,
                wargear: [],
                enhancements: [],
                subunits: []
            };

            if (inAttachedSection && currentAttachedGroup) {
                currentAttachedGroup.attachedParts.push(currentUnit);
                currentAttachedGroup.points += points;
            } else {
                result.units.push(currentUnit);
            }
            currentSubunit = null; // Reset subunit context
            continue;
        }
    }

    // This format has no per-unit ID, so an explicit inline "Warlord" bullet (handled
    // above) is the authoritative signal. Only fall back to matching the header's
    // WARLORD name when no unit carried that marker, and flag just the first match —
    // duplicate-named units (e.g. two identical Knight Castellans) must not all be
    // flagged just because they share a name with the true warlord.
    if (!warlordFoundExplicitly && result.metadata.warlordName) {
        const wantName = result.metadata.warlordName.toLowerCase();
        outer:
        for (const u of result.units) {
            if (Array.isArray(u.attachedParts)) {
                for (const part of u.attachedParts) {
                    if ((part.name || '').toLowerCase() === wantName) {
                        part.isWarlord = true;
                        break outer;
                    }
                }
            } else if ((u.name || '').toLowerCase() === wantName) {
                u.isWarlord = true;
                break;
            }
        }
    }

    return result;
}
