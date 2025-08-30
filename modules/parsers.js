
import { getIndent, normalizeForComparison, parseItemString } from './utils.js';
import { abbreviate } from './abbreviations.js';

// --- Helper Functions (shared by parsers) ---
function addItemToTarget(target, itemString, unitContextName, factionKeyword, itemType = 'wargear') {
    if (!target || !itemString) return;

    const cleanItemNameForCheck = itemString.replace(/^\d+x?\s*/, '').trim();
    if (normalizeForComparison(cleanItemNameForCheck) === 'warlord') {
        itemType = 'special';
    }

    const withMatch = itemString.match(/(\d+)\s+with\s+(.*)/);
    if (withMatch) {
        const quantity = parseInt(withMatch[1]);
        const items = withMatch[2].split(',').map(s => s.trim());
        items.forEach(itemName => {
            if (normalizeForComparison(itemName) === normalizeForComparison(unitContextName) ||
                (target.name && normalizeForComparison(itemName) === normalizeForComparison(target.name))) {
                return; // It's a redundant unit name, so ignore it.
            }
            const { quantity: innerQuantity, name } = parseItemString(itemName);
            const numericInnerQuantity = parseInt(innerQuantity.replace('x', ''), 10) || 1;
            const totalQuantity = quantity * numericInnerQuantity;
            const nameshort = abbreviate(name, unitContextName, factionKeyword);
            const existingItem = target.items.find(item => item.name === name);
            if (existingItem) {
                const existingQty = parseInt(existingItem.quantity.replace('x', ''));
                existingItem.quantity = `${existingQty + totalQuantity}x`;
            } else {
                target.items.push({ quantity: `${totalQuantity}x`, name, nameshort, items: [], type: itemType });
            }
        });
        return;
    }
    const { quantity, name } = parseItemString(itemString);
    if (normalizeForComparison(name) === normalizeForComparison(unitContextName) ||
        (target.name && normalizeForComparison(name) === normalizeForComparison(target.name))) {
        return; // It's a redundant unit name, so ignore it.
    }
    const nameshort = itemType === 'special' ? name : abbreviate(name, unitContextName, factionKeyword);
    const numericQuantity = parseInt(quantity.replace('x', ''), 10);
    const existingItem = target.items.find(item => item.name === name);
    if (existingItem) {
        const existingQty = parseInt(existingItem.quantity.replace('x', ''));
        existingItem.quantity = `${existingQty + numericQuantity}x`;
    } else {
        target.items.push({ quantity, name, nameshort, items: [], type: itemType });
    }
};

function parseAndAddEnhancement(enhancementContent, targetUnit, factionKeyword) {
    if (!targetUnit) return;
    const pointsRegex = /\s*\((.*?)\)$/;
    const pointsMatch = enhancementContent.match(pointsRegex);
    
    let enhancementName = enhancementContent;
    let enhancementPoints = '';

    if (pointsMatch) {
        enhancementName = enhancementContent.replace(pointsRegex, '').trim();
        const pointsText = pointsMatch[1].replace(/\s*pts/i, '');
        enhancementPoints = `(${pointsText})`;
    }

    // Prevent duplicate enhancements if the list is redundant (e.g., in header and body)
    const alreadyExists = targetUnit.items.some(item =>
        item.type === 'special' &&
        normalizeForComparison(item.name).includes(normalizeForComparison(enhancementName))
    );
    if (alreadyExists) {
        return;
    }

    const abbreviation = enhancementName.split(/[\s-]+/).map(word => word.charAt(0)).join('').toUpperCase();
    const shortText = `E: ${abbreviation} ${enhancementPoints}`.trim();
    
    targetUnit.items.push({ quantity: '1x', name: `Enhancement: ${enhancementContent}`, nameshort: shortText, items: [], type: 'special' });

    // After adding the enhancement, find and hide the corresponding "upgrade" wargear item
    // that often appears in GW App list wargear strings.
    const upgradeItemNameToFind = `${enhancementName} upgrade`;
    const upgradeItem = targetUnit.items.find(item => 
        item.type === 'wargear' && 
        normalizeForComparison(item.name) === normalizeForComparison(upgradeItemNameToFind)
    );
    if (upgradeItem) {
        upgradeItem.nameshort = 'NULL';
    }
};

// --- Format Detector ---
export function detectFormat(lines) {
    // WTC check is more specific, so it should go first.
    if (lines.slice(0, 10).some(line => /^\s*\+\s*FACTION KEYWORD:/.test(line))) {
        return 'WTC_COMPACT';
    }
    // GW App check is broader. Check for common section headers like CHARACTERS or BATTLELINE.
    if (lines.slice(0, 25).some(line => /^\s*(CHARACTERS|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS)\s*$/.test(line.toUpperCase()))) {
        return 'GW_APP';
    }
    return 'UNKNOWN';
}

// --- GW App Parser ---
export function parseGwApp(lines) {
    const result = {};
    let currentSection = null;
    let factionKeyword = null;
    const contextStack = []; // [{ indent, node }]

    // --- Header Parsing ---
    result.SUMMARY = {};
    const firstLine = lines[0];
    const pointsMatch = firstLine.match(/\((\d+)\s*points\)/);
    if (pointsMatch) {
        result.SUMMARY.TOTAL_ARMY_POINTS = `${pointsMatch[1]}pts`;
    }
    const detachmentIndex = lines.findIndex(line => /(Combat Patrol|Incursion|Strike Force|Onslaught)/.test(line));
    if (detachmentIndex !== -1 && detachmentIndex + 1 < lines.length) {
        const nextLine = lines[detachmentIndex + 1].trim();
        if (nextLine && !/^(CHARACTERS|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS)$/.test(nextLine.toUpperCase())) {
            result.SUMMARY.DETACHMENT = nextLine;
        }
        const factionLines = lines.slice(1, detachmentIndex).map(l => l.trim()).filter(l => l);
        if (factionLines.length > 0) {
            const fullFaction = factionLines.join(' - ');
            const shortFaction = factionLines[factionLines.length - 1];
            result.SUMMARY.FACTION_KEYWORD = shortFaction; // For debug display matching user expectation
            result.SUMMARY.DISPLAY_FACTION = fullFaction; // For list header display
            factionKeyword = fullFaction; // For internal logic (abbreviation)
        }
    }
    if (!result.SUMMARY.TOTAL_ARMY_POINTS && detachmentIndex !== -1) {
        const gameSizeMatch = lines[detachmentIndex].match(/\((\d+)\s*points\)/);
        if (gameSizeMatch) {
            result.SUMMARY.TOTAL_ARMY_POINTS = `${gameSizeMatch[1]}pts`;
        }
    }

    // --- Regex Definitions ---
    const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/;
    const gwUnitRegex = /^(.*?)\s+\((\d+)\s+(?:pts|points)\)$/;
    const bulletItemRegex = /^\s*•\s*(.*)/;

    let listParsingStarted = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('Exported with')) continue;

        // Section headers are the trigger to start parsing the list content.
        if (sectionHeaderRegex.test(trimmedLine.toUpperCase())) {
            listParsingStarted = true;
            currentSection = trimmedLine.toUpperCase().replace('CHARACTER', 'CHARACTERS').replace('DEDICATED TRANSPORTS', 'OTHER DATASHEETS');
            contextStack.length = 0;
            continue;
        }

        if (!listParsingStarted) {
            continue; // Ignore everything before the first section header.
        }

        // --- From here on, we are parsing the actual list ---
        const indent = getIndent(line);
        while (contextStack.length > 0 && indent <= contextStack[contextStack.length - 1].indent) {
            contextStack.pop();
        }
        const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

        // Unit Detection (must not be indented)
        if (indent === 0) {
            const gwMatch = trimmedLine.match(gwUnitRegex);
            if (gwMatch) {
                const unitName = gwMatch[1].trim();
                const unitPoints = parseInt(gwMatch[2]);
                const newUnit = { quantity: '1x', name: unitName, points: unitPoints, items: [] };
                
                const sectionKey = currentSection || 'OTHER DATASHEETS';
                result[sectionKey] = result[sectionKey] || [];
                result[sectionKey].push(newUnit);

                contextStack.push({ indent, node: newUnit });
                continue;
            }
        }

        // Item / Sub-unit Parsing (must be under a unit)
        if (parentContext) {
            const bulletMatch = trimmedLine.match(bulletItemRegex);
            if (bulletMatch) {
                const itemContent = bulletMatch[1].trim();
                const topLevelUnitName = contextStack[0].node.name;
                
                if (itemContent.startsWith('Enhancement:')) {
                    parseAndAddEnhancement(itemContent.replace('Enhancement:', '').trim(), contextStack[0].node, factionKeyword);
                    continue;
                }

                const subUnitRegex = /^(\d+x?\s+)(.*)/;
                const subUnitMatch = itemContent.match(subUnitRegex);
                const nextLine = (i + 1 < lines.length) ? lines[i + 1] : '';
                const nextLineIsMoreIndented = nextLine.trim() !== '' && getIndent(nextLine) > getIndent(line);
                const nextLineIsBulleted = nextLine.trim().startsWith('•');

                // A bulleted line is a subunit only if it's followed by a MORE indented AND bulleted line.
                // This is a more reliable heuristic for the GW App format.
                if (subUnitMatch && nextLineIsMoreIndented && nextLineIsBulleted) {
                    const newSubUnit = {
                        quantity: subUnitMatch[1].trim(),
                        name: subUnitMatch[2].trim(),
                            points: 0,
                            items: []
                        };
                    parentContext.node.items.push(newSubUnit);
                    contextStack.push({ indent, node: newSubUnit });
                } else {
                    addItemToTarget(parentContext.node, itemContent, topLevelUnitName, factionKeyword);
                }
            } else if (indent > 0) { // It's an indented, non-bulleted line (wargear)
                const topLevelUnitName = contextStack[0].node.name;
                addItemToTarget(parentContext.node, trimmedLine, topLevelUnitName, factionKeyword);
            }
        }
    }

    // --- Post-processing: Calculate total quantities for units with subunits ---
    for (const section in result) {
        if (Array.isArray(result[section])) {
            result[section].forEach(unit => {
                // We only want to sum quantities for units that have subunits.
                const hasSubunits = unit.items && unit.items.some(item => item.points !== undefined);

                if (hasSubunits) {
                    let totalQuantity = 0;
                    unit.items.forEach(item => {
                        // A subunit is an item that has a 'points' property. Wargear does not.
                        if (item.points !== undefined) {
                            totalQuantity += parseInt(item.quantity.replace('x', ''), 10) || 0;
                        }
                    });

                    if (totalQuantity > 1) {
                        unit.quantity = `${totalQuantity}x`;
                    }
                }
            });
        }
    }
    return result;
}

// --- WTC Compact Parser ---
export function parseWtcCompact(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], "OTHER DATASHEETS": [] };
    let currentSection = null;
    let factionKeyword = null;
    const enhancementTargets = {};

    // --- Regex Definitions ---
    const summaryRegex = /^\+\s*([^:]+):\s*(.*)$/;
    const summaryEnhancementRegex = /^&\s*(.*)/;
    const separatorRegex = /^\s*\+{3}\s*$/;
    const sectionHeaderRegex = /^(CHARACTER|OTHER DATASHEETS)$/;
    const unitRegex = /^(?:(?<charid>Char\d+):\s*)?(?<unitinfo>.*?)\s+\((?<points>\d+)\s*pts?\)(?<wargearblock>: \s*(?<wargear>.*))?$/;
    const bulletRegex = /^\s*•\s*(.*)/;
    const enhancementLineRegex = /^Enhancement:\s*(.*)/;

    // --- Pass 1: Separate Header and Body ---
    let headerLines;
    let bodyLines;
    const separatorIndex = lines.findIndex(line => separatorRegex.test(line.trim()));

    if (separatorIndex !== -1) {
        headerLines = lines.slice(0, separatorIndex);
        bodyLines = lines.slice(separatorIndex + 1);
    } else {
        const firstBodyLineIndex = lines.findIndex(line => {
            const trimmed = line.trim();
            if (trimmed === '' || trimmed.startsWith('+') || trimmed.startsWith('&')) {
                return false; // These are header lines or blank lines, not the start of the body.
            }
            // A true body line is a section header or a unit definition.
            // Anything else (like a list title) is considered part of the preamble.
            if (sectionHeaderRegex.test(trimmed) || unitRegex.test(trimmed)) {
                return true;
            }
            return false;
        });

        if (firstBodyLineIndex === -1) { // No body found, all lines are header-like
            headerLines = lines;
            bodyLines = [];
        } else {
            headerLines = lines.slice(0, firstBodyLineIndex);
            bodyLines = lines.slice(firstBodyLineIndex);
        }
    }

    // --- Pass 2: Parse Header ---
    for (const line of headerLines) {
        const summaryMatch = line.match(summaryRegex);
        if (summaryMatch) {
            const key = summaryMatch[1].trim().toUpperCase();
            const value = summaryMatch[2].trim();
            if (key === 'FACTION KEYWORD') {
                const fullFaction = value;
                const shortFaction = value.split(' - ').pop();
                result.SUMMARY.FACTION_KEYWORD = shortFaction; // For debug display matching user expectation
                result.SUMMARY.DISPLAY_FACTION = fullFaction; // For list header display
                factionKeyword = fullFaction; // For internal logic (abbreviation)
            } else if (key === 'DETACHMENT') {
                result.SUMMARY.DETACHMENT = value;
            } else if (key === 'TOTAL ARMY POINTS') {
                result.SUMMARY.TOTAL_ARMY_POINTS = value;
            }
            continue;
        }

        const summaryEnhancementMatch = line.match(summaryEnhancementRegex);
        if (summaryEnhancementMatch) {
            const value = summaryEnhancementMatch[1].trim();
            const enhMatch = value.match(/(?:Enhancement:\s*)?(.*)\s+\(on\s+(?:(Char\d+):\s*)?(.*)\)/);
            if (enhMatch) {
                const enhName = enhMatch[1].trim();
                const targetName = enhMatch[3].trim();
                enhancementTargets[targetName] = enhName;
            }
        }
    }

    // --- Pass 3: Parse Body ---
    const contextStack = []; // Stack of { indent: number, node: object }
    let lastUnitProcessed = null;

    for (let i = 0; i < bodyLines.length; i++) {
        const line = bodyLines[i];
        const trimmedLine = line.trim();
        if (!trimmedLine || separatorRegex.test(trimmedLine)) continue;

        const indent = getIndent(line);

        while (contextStack.length > 0) {
            const lastContext = contextStack[contextStack.length - 1];
            // A new context is a child if it's more indented.
            // Or, if it's a bullet and the parent is not, at the same indent level.
            const isChildBullet = trimmedLine.startsWith('•') && !lastContext.isBullet && indent === lastContext.indent;

            if (indent > lastContext.indent || isChildBullet) {
                // The current context is correct, this line is a child.
            } else {
                // This line is a sibling or a parent, so pop the context.
                contextStack.pop();
            }
            break; // Otherwise, the context is correct
        }

        const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

        // Case 1: Section Header
        if (indent === 0 && sectionHeaderRegex.test(trimmedLine)) {
            currentSection = trimmedLine;
            contextStack.length = 0;
            continue;
        }

        // Case 2: Unit Line (simple or complex)
        const unitMatch = trimmedLine.match(unitRegex);
        if (unitMatch && (indent === 0 || !parentContext)) {
            const { charid, unitinfo, points, wargear } = unitMatch.groups;
            const { quantity, name } = parseItemString(unitinfo.trim());
            
            const newUnit = { 
                quantity, 
                name, 
                points: parseInt(points, 10), 
                items: [],
                isComplex: !unitMatch.groups.wargearblock
            };

            const sectionKey = (currentSection === 'CHARACTER' || charid) ? 'CHARACTER' : 'OTHER DATASHEETS';
            result[sectionKey] = result[sectionKey] || [];
            result[sectionKey].push(newUnit);
            lastUnitProcessed = newUnit;
            contextStack.push({ indent, node: newUnit, isBullet: trimmedLine.startsWith('•') });

            if (wargear) {
                wargear.split(',').forEach(item => addItemToTarget(newUnit, item.trim(), newUnit.name, factionKeyword));
            }
            continue;
        }

        // Case for top-level enhancements that belong to the previous unit
        const enhancementMatch = trimmedLine.match(enhancementLineRegex);
        if (enhancementMatch && !parentContext) {
            if (lastUnitProcessed) {
                parseAndAddEnhancement(enhancementMatch[1].trim(), lastUnitProcessed, factionKeyword);
            }
            continue;
        }


        // Case 3: Indented item (Sub-unit, Wargear, or Enhancement)
        if (parentContext) {
            const topLevelUnitName = contextStack[0].node.name;
            const bulletMatch = trimmedLine.match(bulletRegex);

            if (bulletMatch) { // It's a potential sub-unit or bulleted wargear
                const content = bulletMatch[1];
                const [subUnitInfo, wargearInfo] = content.split(/:\s*/, 2);
                const subUnitMatch = subUnitInfo.match(/^(\d+x?\s+)(.*)/);
                const nextLine = (i + 1 < bodyLines.length) ? bodyLines[i + 1] : '';
                const nextLineIsMoreIndented = nextLine.trim() !== '' && getIndent(nextLine) > getIndent(line);

                // A line is a subunit if it starts with a quantity AND (it has wargear on the same line OR it's followed by an indent)
                if (subUnitMatch && (wargearInfo || nextLineIsMoreIndented)) {
                    const { quantity, name } = parseItemString(subUnitInfo);
                    const newSubUnit = { quantity, name, points: 0, items: [] };
                    parentContext.node.items.push(newSubUnit);

                    if (wargearInfo) { // Single-line subunit (e.g. Intercessors)
                        wargearInfo.split(/(?=\d+\s+with)|,/).forEach(part => {
                            addItemToTarget(newSubUnit, part.trim(), topLevelUnitName, factionKeyword);
                        });
                    } else { // Multi-line subunit (e.g. Jakhals), its wargear is on subsequent lines
                        contextStack.push({ indent, node: newSubUnit, isBullet: trimmedLine.startsWith('•') });
                    }
                } else { 
                    // It's a bulleted line, but not a subunit header. Treat as wargear for the current context.
                    addItemToTarget(parentContext.node, content, topLevelUnitName, factionKeyword);
                }
                continue; // The bulleted line is processed.
            } else if (trimmedLine.match(enhancementLineRegex)) { // Enhancement for the top-level unit
                const enhContent = trimmedLine.match(enhancementLineRegex)[1].trim();
                parseAndAddEnhancement(enhContent, contextStack[0].node, factionKeyword);
            } else { // Wargear for the current context (the last thing on the stack)
                addItemToTarget(parentContext.node, trimmedLine, topLevelUnitName, factionKeyword);
            }
        }
    }

    // --- Pass 4: Apply Enhancements from Header ---
    Object.keys(enhancementTargets).forEach(targetName => {
        const enhName = enhancementTargets[targetName];
        const allUnits = [...(result.CHARACTER || []), ...(result['OTHER DATASHEETS'] || [])];
        const targetUnit = allUnits.find(u => normalizeForComparison(u.name) === normalizeForComparison(targetName));
        if (targetUnit) {
            parseAndAddEnhancement(enhName, targetUnit, factionKeyword);
        }
    });

    // --- Pass 5: Calculate total quantities for complex units ---
    for (const section in result) {
        if (Array.isArray(result[section])) {
            result[section].forEach(unit => {
                if (unit.isComplex) {
                    let totalQuantity = 0;
                    unit.items.forEach(item => {
                        // A subunit is an item that has a 'points' property. Wargear does not.
                        if (item.points !== undefined) {
                            totalQuantity += parseInt(item.quantity.replace('x', ''), 10) || 0;
                        }
                    });

                    if (totalQuantity > 0) {
                        unit.quantity = `${totalQuantity}x`;
                    }
                }
            });
        }
    }

    return result;
}
