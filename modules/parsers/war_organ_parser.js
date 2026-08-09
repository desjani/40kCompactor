import { isWargearSkippable } from '../utils.js';

export function parseWarOrganV11(lines, skippableWargearMap = {}) {
    const result = {
        edition: '11th',
        metadata: {
            title: '',
            armyName: '',
            pointsTotal: 0,
            totalPoints: 0,
            faction: '',
            battleSize: '',
            pointsLimit: 0,
            detachment: '',
            detachments: [],
            forceDispositions: []
        },
        units: []
    };

    if (!Array.isArray(lines) || lines.length === 0) return result;

    const cleanLines = lines.map(l => l.trimEnd());
    const nonEmptyLines = cleanLines.filter(l => l.trim().length > 0);

    if (nonEmptyLines.length < 2) return result;

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

    // Helper to split wargear items by comma and 'and'
    const splitWargearItems = (str) => {
        const normalized = str.replace(/\s+and\s+/ig, ', ');
        return normalized.split(',').map(s => s.trim()).filter(Boolean).map(item => {
            // War Organ names some drones after their built-in weapon (e.g. "Gun
            // drone with twin pulse carbine"); other formats just use the base name
            // ("Gun Drone"). Keep only the part before "with" so names match across formats.
            const withMatch = item.match(/^(.*?)\s+with\s+(.*)$/i);
            return withMatch ? withMatch[1].trim() : item;
        });
    };

    // 1. Parse Metadata Headers
    // Title and Total Points (1st non-empty line)
    const firstLine = nonEmptyLines[0].trim();
    const titleMatch = firstLine.match(/^(.+?)\s*[\[\(](\d+)\s*(?:points|pts)[\]\)]$/i);
    if (titleMatch) {
        result.metadata.title = titleMatch[1].trim();
        result.metadata.armyName = titleMatch[1].trim();
        result.metadata.pointsTotal = parseInt(titleMatch[2], 10) || 0;
        result.metadata.totalPoints = parseInt(titleMatch[2], 10) || 0;
    } else {
        result.metadata.title = firstLine;
        result.metadata.armyName = firstLine;
    }

    // Faction (2nd non-empty line)
    result.metadata.faction = nonEmptyLines[1].trim();

    // Battle Size & Limit (3rd non-empty line)
    if (nonEmptyLines[2]) {
        const battleSizeLine = nonEmptyLines[2].trim();
        const battleMatch = battleSizeLine.match(/^(?:Battle Size:\s*)?(.+?)\s*\((\d+)\s*(?:point limit|point|points|pts)\)$/i);
        if (battleMatch) {
            result.metadata.battleSize = battleMatch[1].trim();
            result.metadata.pointsLimit = parseInt(battleMatch[2], 10) || 0;
        } else {
            result.metadata.battleSize = battleSizeLine;
        }
    }

    // Detachments (4th non-empty line)
    if (nonEmptyLines[3]) {
        const detachmentLine = nonEmptyLines[3].trim();
        const detMatch = detachmentLine.match(/^(?:Detachments:\s*)(.*)$/i);
        let detStr = detMatch ? detMatch[1].trim() : detachmentLine;
        // Strip a trailing "(N Detachment Points)" or "(N/N Detachment Points)" suffix
        detStr = detStr.replace(/\s*\(\d+(?:\/\d+)?\s*Detachment\s*Points\)\s*$/i, '').trim();
        result.metadata.detachment = detStr;
        result.metadata.detachments = detStr.split(',').map(d => d.trim()).filter(Boolean);
    }

    // Determine scan start index in the original lines array
    let nonEmptyCount = 0;
    let scanStartIndex = 0;
    for (let idx = 0; idx < lines.length; idx++) {
        if (lines[idx].trim().length > 0) {
            nonEmptyCount++;
            if (nonEmptyCount === 4) {
                scanStartIndex = idx + 1;
                break;
            }
        }
    }

    // Force Disposition is an optional 5th metadata line (not all exports include it).
    // Peek at the next non-empty line after Detachments; only consume it if it actually
    // looks like a Force Disposition line, so files without one fall through to body scanning.
    for (let idx = scanStartIndex; idx < cleanLines.length; idx++) {
        const peekTrimmed = cleanLines[idx].trim();
        if (peekTrimmed.length === 0) continue;
        const fdMatch = peekTrimmed.match(/^Force\s*Disposition:\s*(.*)$/i);
        if (fdMatch) {
            result.metadata.forceDispositions = fdMatch[1].trim().split(',').map(d => d.trim()).filter(Boolean);
            scanStartIndex = idx + 1;
        }
        break;
    }

    // Category mappings for Format 2
    const categoryMap = {
        'CHARACTER': 'Characters',
        'BATTLELINE': 'Battleline',
        'DEDICATED TRANSPORTS': 'Dedicated Transports',
        'OTHER DATASHEETS': 'Other Datasheets',
        'ALLY CHARACTERS': 'Characters',
        'ALLY OTHER DATASHEETS': 'Other Datasheets'
    };

    function guessCategory(unitName) {
        const name = unitName.toLowerCase();
        const charKeywords = ['captain', 'canoness', 'hospitaller', 'palatine', 'commander', 'castellan', 'prime', 'lord', 'champion', 'priest', 'inquisitor', 'celestine', 'vahl'];
        if (charKeywords.some(kw => name.includes(kw))) {
            return 'Characters';
        }
        const transportKeywords = ['rhino', 'chimera', 'imprulsor', 'repulsor', 'land raider', 'drop pod', 'transport', 'devilfish', 'taurox'];
        if (transportKeywords.some(kw => name.includes(kw))) {
            return 'Dedicated Transports';
        }
        return 'Other Datasheets';
    }

    // Detect format type (Format 2 has deeper indentation or "Enhancement:" lines).
    // The category-header check is intentionally case-sensitive (matching categoryMap's
    // own case-sensitive lookup below): newer War Organ exports generate randomized,
    // mixed-case "group name" headers for attached units (e.g. "Character", "Vehicle",
    // "Khorne Trouble Team") that must not be confused with the real ALL-CAPS Format 2
    // category headers ("CHARACTER", "BATTLELINE", "DEDICATED TRANSPORTS").
    const isFormat2 = lines.some(l => /^\s*(?:CHARACTER|BATTLELINE|DEDICATED TRANSPORTS|OTHER DATASHEETS)\s*$/.test(l))
        || lines.some(l => /^\s*•\s*Enhancement:/i.test(l))
        || !lines.some(l => /^\s*Battle Size:/i.test(l));

    let currentSection = 'Other Datasheets';
    let currentUnit = null;

    if (isFormat2) {
        // --- Format 2 (Indented Tree structure) ---
        let i = scanStartIndex;
        while (i < cleanLines.length) {
            const line = cleanLines[i];
            const trimmed = line.trim();
            if (!trimmed) {
                i++;
                continue;
            }

            // Check if it's a category header
            if (categoryMap[trimmed]) {
                currentSection = categoryMap[trimmed];
                i++;
                continue;
            }

            // Check for unit header, e.g. "Canoness With Jump Pack (85 points)"
            const unitMatch = trimmed.match(/^(?:(\d+)x?\s+)?(.*?)\s*[\[\(](\d+)\s*(?:points|pts)[\]\)]$/i);
            if (unitMatch && !trimmed.startsWith('•')) {
                const qty = unitMatch[1] ? parseInt(unitMatch[1], 10) : 1;
                const unitName = unitMatch[2].trim();
                const unitPoints = parseInt(unitMatch[3], 10) || 0;

                currentUnit = {
                    name: unitName,
                    points: unitPoints,
                    quantity: qty,
                    category: currentSection,
                    wargear: [],
                    enhancements: [],
                    subunits: []
                };
                result.units.push(currentUnit);
                i++;

                // Collect block lines for this unit
                const blockLines = [];
                while (i < cleanLines.length) {
                    const nextLine = cleanLines[i];
                    const nextTrimmed = nextLine.trim();
                    if (!nextTrimmed) {
                        i++;
                        continue;
                    }

                    // Stop if we hit another unit header or category header
                    if (categoryMap[nextTrimmed] || 
                        (!nextTrimmed.startsWith('•') && nextTrimmed.match(/^(?:(\d+)x?\s+)?(.*?)\s*[\[\(](\d+)\s*(?:points|pts)[\]\)]$/i))) {
                        break;
                    }

                    blockLines.push(nextLine);
                    i++;
                }

                // Process tree
                if (blockLines.length > 0) {
                    const root = { content: 'Root', indent: -1, children: [] };
                    const stack = [root];

                    blockLines.forEach(bl => {
                        const leadingSpaces = bl.length - bl.trimStart().length;
                        const blTrimmed = bl.trim();
                        const bulletMatch = blTrimmed.match(/^([•◦\u25e6\u2022])\s*(.*)$/);
                        const hasBullet = !!bulletMatch;
                        const content = bulletMatch ? bulletMatch[2].trim() : blTrimmed;

                        const node = {
                            content,
                            indent: leadingSpaces,
                            hasBullet,
                            children: []
                        };

                        while (stack.length > 1 && stack[stack.length - 1].indent >= node.indent) {
                            stack.pop();
                        }

                        stack[stack.length - 1].children.push(node);
                        stack.push(node);
                    });

                    // Helper to collect wargear recursively
                    const collectWargearRecursive = (node, targetArray) => {
                        const parsed = parseQtyAndName(node.content, currentUnit.name);
                        targetArray.push(parsed);
                        node.children.forEach(child => {
                            collectWargearRecursive(child, targetArray);
                        });
                    };

                    // Process Root children (level 1 indentation)
                    root.children.forEach(node => {
                        const content = node.content;
                        const contentLower = content.toLowerCase();

                        if (contentLower === 'warlord') {
                            currentUnit.isWarlord = true;
                        } else if (contentLower.startsWith('enhancement:')) {
                            const enhName = content.substring(content.indexOf(':') + 1).trim();
                            currentUnit.enhancements.push({
                                name: enhName,
                                points: 0
                            });
                        } else {
                            // Subunit if it has bulleted children, otherwise unit-level wargear
                            const hasChildren = node.children.length > 0;
                            if (hasChildren) {
                                const parsedSub = parseQtyAndName(content, currentUnit.name);
                                const subunit = {
                                    name: parsedSub.name,
                                    quantity: parsedSub.quantity,
                                    wargear: []
                                };
                                node.children.forEach(child => {
                                    collectWargearRecursive(child, subunit.wargear);
                                });
                                currentUnit.subunits.push(subunit);
                            } else {
                                collectWargearRecursive(node, currentUnit.wargear);
                            }
                        }
                    });
                }
                continue;
            }

            i++;
        }
    } else {
        // --- Format 1 (Flat lists using "with" and "[+XX points]") ---
        let i = scanStartIndex;
        while (i < cleanLines.length) {
            const line = cleanLines[i];
            const trimmed = line.trim();
            if (!trimmed) {
                i++;
                continue;
            }

            // Check for unit header
            const unitMatch = trimmed.match(/^(?:(\d+)x?\s+)?(.*?)\s*[\[\(](\d+)\s*(?:points|pts)[\]\)]$/i);
            if (unitMatch && !trimmed.startsWith('•')) {
                const qty = unitMatch[1] ? parseInt(unitMatch[1], 10) : 1;
                const unitName = unitMatch[2].trim();
                const unitPoints = parseInt(unitMatch[3], 10) || 0;

                currentUnit = {
                    name: unitName,
                    points: unitPoints,
                    quantity: qty,
                    category: guessCategory(unitName),
                    wargear: [],
                    enhancements: [],
                    subunits: []
                };
                result.units.push(currentUnit);
                i++;

                while (i < cleanLines.length) {
                    const nextLine = cleanLines[i];
                    const nextTrimmed = nextLine.trim();
                    if (!nextTrimmed) {
                        i++;
                        continue;
                    }

                    // Stop if we hit another unit header
                    if (!nextTrimmed.startsWith('•') && nextTrimmed.match(/^(?:(\d+)x?\s+)?(.*?)\s*[\[\(](\d+)\s*(?:points|pts)[\]\)]$/i)) {
                        break;
                    }

                    const bulletMatch = nextTrimmed.match(/^•\s*(.*)$/);
                    if (bulletMatch) {
                        const content = bulletMatch[1].trim();
                        const contentLower = content.toLowerCase();

                        if (contentLower === 'warlord') {
                            currentUnit.isWarlord = true;
                        } else {
                            // Check if it's a subunit line: e.g. "1 Sacresant Superior with Plasma pistol and Spear of the faithful"
                            const subunitMatch = content.match(/^(\d+)\s+(.+?)\s+with\s+(.+)$/i);
                            if (subunitMatch) {
                                const subQty = parseInt(subunitMatch[1], 10);
                                const subName = subunitMatch[2].trim();
                                const subWargearStr = subunitMatch[3].trim();

                                const subunit = {
                                    name: subName,
                                    quantity: subQty,
                                    wargear: []
                                };

                                const items = splitWargearItems(subWargearStr);
                                items.forEach(it => {
                                    // Format 1 wargear items carry a per-model quantity (e.g. "Bolt
                                    // pistol" implicitly means 1 each); multiply by the subunit's
                                    // own model count so totals match Format 2's pre-multiplied convention.
                                    const parsedWg = parseQtyAndName(it, currentUnit.name);
                                    parsedWg.quantity = parsedWg.quantity * subQty;
                                    subunit.wargear.push(parsedWg);
                                });

                                currentUnit.subunits.push(subunit);
                            } else {
                                // Unit-level wargear and/or enhancements
                                const items = splitWargearItems(content);
                                items.forEach(it => {
                                    // Check for enhancement tag [+XX points]
                                    const enhMatch = it.match(/^(.+?)\s*[\[\(]\+(\d+)\s*(?:points|pts)[\]\)]$/i);
                                    if (enhMatch) {
                                        currentUnit.enhancements.push({
                                            name: enhMatch[1].trim(),
                                            points: parseInt(enhMatch[2], 10) || 0
                                        });
                                    } else {
                                        currentUnit.wargear.push(parseQtyAndName(it, currentUnit.name));
                                    }
                                });
                            }
                        }
                    }
                    i++;
                }
                continue;
            }

            i++;
        }
    }

    return result;
}
