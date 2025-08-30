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
            const unitRegex = /^(?:(?<charid>Char\d+):\s*)?(?<unitinfo>.*?)\s+\((?<points>\d+)\s*pts?\)(?<wargearblock>:\s*(?<wargear>.*))?$/;
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
                    const enhMatch = value.match(/(?:Enhancement:\s*)?(.*)\s\(on\s(?:(Char\d+):\s*)?(.*)\)/);
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