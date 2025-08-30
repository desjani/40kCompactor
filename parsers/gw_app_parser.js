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