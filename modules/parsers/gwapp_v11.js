import { isWargearSkippable } from '../utils.js';

export function parseGwAppV11(lines, skippableWargearMap = {}) {
    const result = {
        edition: '11th',
        metadata: {
            armyName: '',
            totalPoints: 0,
            faction: '',
            battleSize: '',
            pointsLimit: 0,
            detachments: [],
            detachmentPoints: 0,
            forceDispositions: []
        },
        units: []
    };

    if (!Array.isArray(lines) || lines.length === 0) return result;

    // Filter out empty lines for metadata parsing
    const cleanLines = lines.map(l => l.trimEnd());
    const nonEmptyLines = cleanLines.filter(l => l.trim().length > 0);

    if (nonEmptyLines.length === 0) return result;

    // Helper to map translated section headers to standard English versions
    const getCanonicalSectionHeader = (line) => {
        if (!line) return null;
        let norm = line.toLowerCase().trim();
        try {
            norm = norm.normalize('NFD').replace(/\p{M}/gu, '');
        } catch (e) {}

        const mapping = {
            // Attached units
            "attached units": "Attached Units",
            "unites attachees": "Attached Units",
            "unidades acopladas": "Attached Units",
            "angegliederte einheiten": "Attached Units",
            "unita associate": "Attached Units",

            // Characters
            "characters": "Characters",
            "personnages": "Characters",
            "personajes": "Characters",
            "charaktermodelle": "Characters",
            "personaggi": "Characters",

            // Dedicated transports
            "dedicated transports": "Dedicated Transports",
            "transports assignes": "Dedicated Transports",
            "transportes asignados": "Dedicated Transports",
            "angeschlossene transportfahrzeuge": "Dedicated Transports",
            "trasporti dedicati": "Dedicated Transports",

            // Other datasheets
            "other datasheets": "Other Datasheets",
            "autres fiches techniques": "Other Datasheets",
            "otras hojas de datos": "Other Datasheets",
            "andere datenblatter": "Other Datasheets",
            "altre schede tecniche": "Other Datasheets"
        };

        return mapping[norm] || null;
    };

    const forceDispPrefixRegex = /^(Force\s+Dispositions|Dispositions\s+des\s+Forces|Disposiciones\s+de\s+la?\s+fuerza|Streitkräfteaufstellungen?)\s*:\s*/i;
    const attachedUnitHeaderRegex = /^(Attached Unit|Unité|Unidad acoplada|Angegliederte Einheit|Unità associata|Unita associata)\s+(\d+)(?:\s+Attachée)?$/i;

    // 1. Parse Metadata Headers
    // Line 1: e.g. "Retaliation + AAC Mass suits (2000 points)"
    const line1 = nonEmptyLines[0].trim();
    const line1Match = line1.match(/^(.*?)\s*\((\d+)\s*(?:pts|points|punkte|puntos|punti)\)$/i);
    if (line1Match) {
        result.metadata.armyName = line1Match[1].trim();
        result.metadata.totalPoints = parseInt(line1Match[2], 10) || 0;
    } else {
        result.metadata.armyName = line1;
    }

    // Line 2 (non-empty index 1): Faction, e.g. "T’au Empire"
    if (nonEmptyLines[1]) {
        result.metadata.faction = nonEmptyLines[1].trim();
    }

    // Line 3 (non-empty index 2): Battle size, e.g. "Strike Force (2000 points)"
    if (nonEmptyLines[2]) {
        const line3 = nonEmptyLines[2].trim();
        const line3Match = line3.match(/^(.*?)\s*\((\d+)\s*(?:pts|points|punkte|puntos|punti)\)$/i);
        if (line3Match) {
            result.metadata.battleSize = line3Match[1].trim();
            result.metadata.pointsLimit = parseInt(line3Match[2], 10) || 0;
        } else {
            result.metadata.battleSize = line3;
        }
    }

    // Line 4 (non-empty index 3): Detachments, e.g. "Advanced Acquisition Cadre and Retaliation Cadre (3 Detachment Points)"
    let headerOffset = 3;
    if (nonEmptyLines[3] && !forceDispPrefixRegex.test(nonEmptyLines[3])) {
        const line4 = nonEmptyLines[3].trim();
        const line4Match = line4.match(/^(.*?)\s*\((\d+)\s*(?:Detachment\s*Points|Points?\s*de\s*D[eé]tachement|Puntos\s*de\s*Destacamento|Detachement[- ]*Punkte|Detachementpunkte|Punti\s*(?:di\s*)?Distaccamento)\)$/i);
        if (line4Match) {
            const detStr = line4Match[1].trim();
            result.metadata.detachmentPoints = parseInt(line4Match[2], 10) || 0;
            // Split by translated separators
            result.metadata.detachments = detStr.split(/\s+(?:and|et|y|und|e)\s+/i).map(d => d.trim()).filter(Boolean);
        } else {
            result.metadata.detachments = [line4];
        }
        headerOffset = 4;
    }

    // Line 5 (non-empty index 4): Force Dispositions, e.g. "Force Dispositions: Purge the Foe, "
    if (nonEmptyLines[headerOffset] && forceDispPrefixRegex.test(nonEmptyLines[headerOffset])) {
        const line5 = nonEmptyLines[headerOffset].trim();
        const dispStr = line5.replace(forceDispPrefixRegex, '').trim();
        // Strip trailing comma and split by comma
        const cleanedDisp = dispStr.replace(/,$/, '');
        result.metadata.forceDispositions = cleanedDisp.split(',').map(d => d.trim()).filter(Boolean);
    }

    // 2. Group Remaining Lines into Sections and Unit Blocks
    let currentSection = 'Characters';
    let currentAttachedGroup = null;

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

    // Parse a single line's indent and bullet properties
    const parseLineDetails = (line) => {
        const leadingSpaces = line.length - line.trimStart().length;
        const trimmed = line.trim();
        const bulletMatch = trimmed.match(/^•\s*(.*)$/);
        if (bulletMatch) {
            return {
                leadingSpaces,
                hasBullet: true,
                content: bulletMatch[1].trim()
            };
        }
        return {
            leadingSpaces,
            hasBullet: false,
            content: trimmed
        };
    };

    // Helper to compile a tree of indented lines into a structured unit object
    const parseUnitBlock = (unitName, unitPoints, blockLines) => {
        const unit = {
            name: unitName,
            points: unitPoints,
            category: currentSection,
            isAttached: false,
            isWarlord: false,
            wargear: [],
            enhancements: [],
            subunits: []
        };

        if (blockLines.length === 0) return unit;

        // Build tree using indentation
        const root = { content: 'Root', indent: -1, children: [] };
        const stack = [root];

        blockLines.forEach(line => {
            const details = parseLineDetails(line);
            const node = {
                content: details.content,
                indent: details.leadingSpaces,
                hasBullet: details.hasBullet,
                children: []
            };

            while (stack.length > 1 && stack[stack.length - 1].indent >= node.indent) {
                stack.pop();
            }

            stack[stack.length - 1].children.push(node);
            stack.push(node);
        });

        // Helper to collect all wargear items recursively from a node's descendants
        const collectWargearRecursive = (node, targetArray) => {
            const parsed = parseQtyAndName(node.content, unitName);
            targetArray.push(parsed);
            node.children.forEach(child => {
                collectWargearRecursive(child, targetArray);
            });
        };

        // Traverse the tree recursively to find properties at indent level 2 and potential 'Attached as' headers at level 0
        const elements = [];
        let attachedAsNode = null;
        let attachedAsMatchResult = null;
        const findNodes = (nodes) => {
            nodes.forEach(node => {
                const match = node.content.match(/^(attached as|attach[eé]e en tant que|acoplado como|angegliedert als|associato come)\s*:\s*(.*)$/i);
                if (match) {
                    attachedAsNode = node;
                    attachedAsMatchResult = match;
                }
                if (node.indent === 2) {
                    elements.push(node);
                }
                if (node.children && node.children.length > 0) {
                    findNodes(node.children);
                }
            });
        };
        findNodes(root.children);

        if (attachedAsNode && attachedAsMatchResult) {
            unit.attachedAs = attachedAsMatchResult[2].trim();
            const roleStr = unit.attachedAs.toLowerCase();
            if (/(leader|meneur|l[ií]der|anfuehrer|anführer|capo|comandante)/i.test(roleStr)) {
                unit.role = 'Leader';
            } else if (/(bodyguard|gardes?\s+du\s+corps|escolta|leibwaechter|leibwächter|guardia\s+del\s+corpo)/i.test(roleStr)) {
                unit.role = 'Bodyguard';
            } else {
                unit.role = 'Bodyguard';
            }
        }

        elements.forEach(node => {
            const content = node.content;
            const warlordRegex = /^(warlord|seigneur de guerre|se[nñ]or de la guerra|kriegsherr|signore della guerra)$/i;
            const enhancementRegex = /^(enhancement|optimisation|mejora|aufwertung|verbesserung|potenziamento)\s*:\s*(.*)$/i;

            if (warlordRegex.test(content)) {
                unit.isWarlord = true;
            } else {
                const enhancementMatch = content.match(enhancementRegex);
                if (enhancementMatch) {
                    const enhName = enhancementMatch[2].trim();
                    unit.enhancements.push({ name: enhName });
                } else {
                    // A unit item: could be a subunit (if it has bulleted children) or unit wargear
                    const hasBulletedChildren = node.children.some(c => c.hasBullet);
                    if (hasBulletedChildren) {
                        // It is a subunit!
                        const parsedSub = parseQtyAndName(content, unitName);
                        const subunit = {
                            name: parsedSub.name,
                            quantity: parsedSub.quantity,
                            wargear: []
                        };
                        // Collect wargear from all of its descendants
                        node.children.forEach(child => {
                            collectWargearRecursive(child, subunit.wargear);
                        });
                        unit.subunits.push(subunit);
                    } else {
                        // It is a top-level wargear item
                        collectWargearRecursive(node, unit.wargear);
                    }
                }
            }
        });

        return unit;
    };

    // Start parsing the body lines
    let i = 0;
    // Find the first empty line or first section/unit header, skipping metadata
    while (i < cleanLines.length) {
        const line = cleanLines[i].trim();
        if (forceDispPrefixRegex.test(line) || getCanonicalSectionHeader(line)) {
            break;
        }
        i++;
    }
    if (i < cleanLines.length && forceDispPrefixRegex.test(cleanLines[i].trim())) {
        i++; // skip force dispositions line
    }

    while (i < cleanLines.length) {
        const line = cleanLines[i];
        const trimmed = line.trim();
        if (!trimmed) {
            i++;
            continue;
        }

        const canonicalHeader = getCanonicalSectionHeader(trimmed);

        // Check for section transitions
        if (canonicalHeader) {
            currentSection = canonicalHeader;
            currentAttachedGroup = null;
            i++;
            continue;
        }

        // Check for attached unit group headers
        const attachedMatch = trimmed.match(attachedUnitHeaderRegex);
        if (currentSection === 'Attached Units' && attachedMatch) {
            currentAttachedGroup = {
                name: `Attached Unit ${attachedMatch[2]}`,
                points: 0,
                category: 'Attached Units',
                isAttached: true,
                attachedParts: []
            };
            result.units.push(currentAttachedGroup);
            i++;
            continue;
        }

        // Check for unit header line, e.g. "Commander Farsight (80 points)"
        const unitMatch = trimmed.match(/^(.*?)\s*\((\d+)\s*(?:pts|points|punkte|puntos|punti)\)$/i);
        if (unitMatch) {
            const unitName = unitMatch[1].trim();
            const unitPoints = parseInt(unitMatch[2], 10) || 0;
            const blockLines = [];
            i++;

            // Collect all subsequent lines belonging to this unit block
            while (i < cleanLines.length) {
                const nextLine = cleanLines[i];
                const nextTrimmed = nextLine.trim();
                if (!nextTrimmed) {
                    i++;
                    continue;
                }

                // If next line starts a new section, attached group, or unit header, stop
                if (getCanonicalSectionHeader(nextTrimmed) ||
                    (currentSection === 'Attached Units' && attachedUnitHeaderRegex.test(nextTrimmed)) ||
                    nextTrimmed.match(/^(.*?)\s*\((\d+)\s*(?:pts|points|punkte|puntos|punti)\)$/i) ||
                    /^(?:exported with app version|exporte avec la version|export|esport)/i.test(nextTrimmed)) {
                    break;
                }

                blockLines.push(nextLine);
                i++;
            }

            const unit = parseUnitBlock(unitName, unitPoints, blockLines);

            if (currentSection === 'Attached Units' && currentAttachedGroup) {
                unit.category = 'Attached Units';
                currentAttachedGroup.attachedParts.push(unit);
                currentAttachedGroup.points += unit.points;
            } else {
                result.units.push(unit);
            }
            continue;
        }

        i++;
    }

    return result;
}
