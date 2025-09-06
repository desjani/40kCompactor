// Store the parsed data globally within the script's scope
let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';

// --- Abbreviation Database ---
let factionAbbreviationDBs = {}; // Use let to allow reassignment

document.addEventListener('DOMContentLoaded', () => {
    const parseButton = document.getElementById('parseButton');
    parseButton.disabled = true;
    parseButton.textContent = 'Loading DB...';

    // Use the shared dynamic loader so we don't duplicate fetch logic and so
    // the UI uses the exact same wargear abbreviation DB as the rest of the app.
    import('./modules/abbreviations.js')
        .then(mod => mod.loadAbbreviationRules())
        .then(data => {
            factionAbbreviationDBs = data;
            console.log("Wargear database loaded successfully.");
            parseButton.disabled = false;
            parseButton.textContent = 'Compact this list';
        })
        .catch(error => {
            console.error("Could not load wargear database:", error);
            parseButton.textContent = 'Error: DB Load Failed';
        });
    
    document.querySelectorAll('input[name="colorMode"], #unitColor, #subunitColor, #pointsColor').forEach(el => {
        el.addEventListener('change', (e) => {
            // Show/hide dropdowns when radio button changes
            if (e.target.name === 'colorMode') {
                document.getElementById('customColorPickers').style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
            
            // Re-render the compact view if data exists to provide a live preview
            if (parsedData) {
                const compactOutput = generateOutput(parsedData, true, factionAbbreviationDBs);
                document.getElementById('compactedOutput').innerHTML = compactOutput.html;
                compactPlainText = compactOutput.plainText; // Keep plain text in sync
            }
        });
    });
})

function normalizeForComparison(name) {
    if (!name) return '';
    // Decomposes accented chars (e.g., 'â' -> 'a' + '^') and removes the diacritics.
    // Also handles lowercase, trim, hyphens, and common character variations.
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/-/g, ' ') // Treat hyphens as spaces for matching
        .replace(/’/g, "'")
        .trim();
}

function flexibleItemMatch(rule, itemName) {
    const ruleItemNormalized = normalizeForComparison(rule.item);
    const itemNameNormalized = normalizeForComparison(itemName);
    if (ruleItemNormalized === itemNameNormalized) return true; // Exact match
    if (ruleItemNormalized === itemNameNormalized + 's') return true; // input: cutter, rule: cutters
    if (itemNameNormalized.endsWith('s') && ruleItemNormalized === itemNameNormalized.slice(0, -1)) return true; // input: cutters, rule: cutter
    return false;
}

function abbreviate(itemName, unitName, fullFactionKeyword) {
     const debugOutput = document.getElementById('debugOutput');
     const searchOrder = [];
     const mainFaction = fullFactionKeyword ? (fullFactionKeyword.split(' - ').pop() || fullFactionKeyword) : null;

     if (mainFaction) {
         searchOrder.push(mainFaction);
     }
     // Add broader categories for cross-faction rules.
     const spaceMarineChapters = [
        "Black Templars", "Blood Angels", "Dark Angels", "Deathwatch", 
        "Imperial Fists", "Iron Hands", "Raven Guard", "Salamanders", 
        "Space Wolves", "Ultramarines"
     ];
     const isSpaceMarineFaction = mainFaction && (
         spaceMarineChapters.includes(mainFaction) || 
         (fullFactionKeyword && (fullFactionKeyword.includes("Space Marines") || fullFactionKeyword.includes("Adeptus Astartes")))
     );

     if (isSpaceMarineFaction) {
         searchOrder.push("Space Marines", "Imperial Knights", "Agents of the Imperium");
     } else if (mainFaction === "Agents of the Imperium") {
        // Special handling for Agents of the Imperium soup lists.
        // This ensures we check the dedicated "Agents" section first, then the home factions of allied units.
        searchOrder.push("Adepta Sororitas", "Adeptus Custodes", "Astra Militarum", "Grey Knights", "Imperial Knights", "Space Marines");
     } else if (fullFactionKeyword && (fullFactionKeyword.includes("Imperium") || ["Adepta Sororitas", "Adeptus Custodes", "Adeptus Mechanicus", "Astra Militarum", "Grey Knights", "Imperial Knights"].includes(mainFaction))) {
        // For other non-SM Imperium factions, add common allies.
        // The main faction is already at the start of the searchOrder.
        searchOrder.push("Agents of the Imperium", "Imperial Knights");
     }

    const chaosFactions = [
        "Chaos Daemons", "Chaos Knights", "Chaos Space Marines", 
        "Death Guard", "Emperor's Children", "Thousand Sons", "World Eaters"
    ];

    const isChaosFaction = mainFaction && (
        chaosFactions.includes(mainFaction) ||
        (fullFactionKeyword && fullFactionKeyword.includes("Chaos"))
    );

    if (isChaosFaction) {                 
        searchOrder.push("Chaos Space Marines", "Chaos Knights", "Chaos Daemons");
    }
     
     // --- Aeldari Factions ---
     const aeldariFactions = ["Aeldari", "Drukhari"];
     const isAeldariFaction = mainFaction && (
         aeldariFactions.includes(mainFaction) ||
         (fullFactionKeyword && (fullFactionKeyword.includes("Aeldari") || fullFactionKeyword.includes("Drukhari")))
     );
     if (isAeldariFaction) {
         searchOrder.push("Aeldari", "Drukhari");
     }
     
     // --- Tyranid Factions ---
     const tyranidFactions = ["Tyranids", "Genestealer Cults"];
     const isTyranidFaction = mainFaction && (
         tyranidFactions.includes(mainFaction) ||
         (fullFactionKeyword && (fullFactionKeyword.includes("Tyranids") || fullFactionKeyword.includes("Genestealer Cults")))
     );
     if (isTyranidFaction) {
        searchOrder.push("Genestealer Cults", "Tyranids");
     }
     const factionsToSearch = [...new Set(searchOrder)];


     const findRule = () => {
         let bestUnitRules = null;
         // --- First Pass: Find the most specific unit entry across all relevant factions ---
         for (const faction of factionsToSearch) {
            const dbFactionKey = Object.keys(factionAbbreviationDBs).find(key => normalizeForComparison(key) === normalizeForComparison(faction));
            if (!dbFactionKey) continue;
            const rules = factionAbbreviationDBs[dbFactionKey];

            const unitRulesKey = Object.keys(rules).find(key => normalizeForComparison(key) === normalizeForComparison(unitName));
            if (unitRulesKey) {
                bestUnitRules = rules[unitRulesKey];
                break; // Found the first, most specific unit entry. Stop searching for the unit.
            }
         }

         // --- Second Pass: Search for the item within the found unit entry. ---
         if (bestUnitRules) {
             let foundRule = bestUnitRules.find(rule => flexibleItemMatch(rule, itemName));
             if (foundRule) return foundRule; // Specific item in specific unit
             foundRule = bestUnitRules.find(rule => rule.item === "*");
             if (foundRule) return foundRule; // Wildcard in specific unit
         }

         // --- Third Pass: If no unit-specific rule was found, check for global item matches ---
         for (const faction of factionsToSearch) {
             const dbFactionKey = Object.keys(factionAbbreviationDBs).find(key => normalizeForComparison(key) === normalizeForComparison(faction));
             if (!dbFactionKey) continue;
             const rules = factionAbbreviationDBs[dbFactionKey];

             if (!rules || !rules["*"]) continue;
             let foundRule = rules["*"].find(rule => flexibleItemMatch(rule, itemName));
             if (foundRule) return foundRule;
         }
         return null;
     };

     const rule = findRule();

     return rule ? rule.abbr : itemName;
}

// --- Main Parsing Controller ---
document.getElementById('parseButton').addEventListener('click', () => {
    const debugOutput = document.getElementById('debugOutput');
    if (debugOutput) debugOutput.innerHTML = '';
    const text = document.getElementById('inputText').value;
    const lines = text.split('\n');

    const format = detectFormat(lines);
    const parser = parsers[format];

    if (!parser) {
        console.error("Unsupported list format.");
        document.getElementById('unabbreviatedOutput').innerHTML = '<p style="color: var(--color-danger);">Unsupported list format. Please use GW App or WTC-Compact format.</p>';
        document.getElementById('compactedOutput').innerHTML = '';
        return;
    }

    const result = parser(lines);

    // --- Debug Parsed Object ---
    if (debugOutput) {
        const resultEntry = document.createElement('pre');
        resultEntry.style.whiteSpace = 'pre-wrap';
        resultEntry.style.wordBreak = 'break-all';
        resultEntry.textContent = JSON.stringify(result, null, 2);
        debugOutput.appendChild(resultEntry);
    }

    // --- Common Rendering Logic ---
    parsedData = result;
    const extendedOutput = generateOutput(result, false, factionAbbreviationDBs);
    document.getElementById('unabbreviatedOutput').innerHTML = extendedOutput.html;
    extendedPlainText = extendedOutput.plainText;
    const compactOutput = generateOutput(result, true, factionAbbreviationDBs);
    document.getElementById('compactedOutput').innerHTML = compactOutput.html;
    compactPlainText = compactOutput.plainText;
    updateCharCounts();
});

// Hotkey: Ctrl+Enter or Cmd+Enter triggers the same action as clicking 'Compact this list'
document.addEventListener('keydown', (e) => {
    // Accept Ctrl+Enter (Windows/Linux) and Meta(Cmd)+Enter (macOS)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const btn = document.getElementById('parseButton');
        if (btn && !btn.disabled) {
            // Prevent default to avoid submitting forms or other side effects
            e.preventDefault();
            btn.click();
        }
    }
});

document.getElementById('resetButton').addEventListener('click', () => {
    document.getElementById('inputText').value = '';
    document.getElementById('unabbreviatedOutput').innerHTML = '';
    document.getElementById('compactedOutput').innerHTML = '';
    document.getElementById('debugOutput').innerHTML = '';

    parsedData = null;
    extendedPlainText = '';
    compactPlainText = '';

    updateCharCounts();
    document.getElementById('inputText').focus();
});

document.getElementById('toggleDebugButton').addEventListener('click', (e) => {
    const debugContainer = document.getElementById('debugContainer');
    const button = e.currentTarget;
    if (debugContainer.style.display === 'none') {
        debugContainer.style.display = 'flex';
        button.textContent = 'Hide Debug Log';
    } else {
        debugContainer.style.display = 'none';
        button.textContent = 'Show Debug Log';
    }
});

// --- Helper Functions (shared by parsers) ---
function getIndent(s) { return s.match(/^\s*/)[0].length; }

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
function detectFormat(lines) {
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

// --- Parser Registration ---
const parsers = {
    GW_APP: parseGwApp,
    WTC_COMPACT: parseWtcCompact
};

// --- GW App Parser ---
function parseGwApp(lines) {
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
function parseWtcCompact(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], "OTHER DATASHEETS": [] };
    let currentSection = null;
    let factionKeyword = null;
    const enhancementTargets = {};

    // --- Regex Definitions ---
    const summaryRegex = /^\+\s*([^:]+):\s*(.*)$/;
    const summaryEnhancementRegex = /^&\s*(.*)/;
    const separatorRegex = /^\s*\+{3}\s*$/;
    const sectionHeaderRegex = /^(CHARACTER|OTHER DATASHEETS)$/;
    const unitRegex = /^(?:(?<charid>Char\d+):\s*)?(?<unitinfo>.*?)\s+\(?<points>\d+)\s*pts?\)(?<wargearblock>: \s*(?<wargear>.*))?$/;
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

        // This loop ensures the context stack is correct before we proceed.
        // We pop items off the stack until the top item is the true parent of the current line.
        while (contextStack.length > 0 && indent <= contextStack[contextStack.length - 1].indent) {
            contextStack.pop();
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
                items: []
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
                // If the unit contains subunits (items with points or explicit type 'subunit'), sum their quantities
                const hasSubunits = unit.items && unit.items.some(it => it && (it.points !== undefined || it.type === 'subunit'));
                if (hasSubunits) {
                    let totalQuantity = 0;
                    unit.items.forEach(item => {
                        if (item && (item.points !== undefined || item.type === 'subunit')) {
                            totalQuantity += parseInt(item.quantity.replace('x', ''), 10) || 0;
                        }
                    });
                    if (totalQuantity > 0) unit.quantity = `${totalQuantity}x`;
                }
            });
        }
    }

    return result;
}

function parseItemString(itemString) {
    const match = itemString.match(/^(\d+x?\s+)?(.*)$/);
    if (match) {
        const quantity = match[1] ? match[1].trim() : '1x';
        const name = match[2].trim();
        return { quantity, name };
    }
    return { quantity: '1x', name: itemString };
}

function getInlineItemsString(items, useAbbreviations = true) {
    if (!items || items.length === 0) return '';
    
    const specialItems = items.filter(item => item.type === 'special' && item.nameshort !== "NULL");
    const wargearItems = items.filter(item => item.type === 'wargear' && item.nameshort !== "NULL");

    if (specialItems.length === 0 && wargearItems.length === 0) return '';

    wargearItems.sort((a, b) => parseInt(b.quantity.replace('x', ''), 10) - parseInt(a.quantity.replace('x', ''), 10));
    
    const specialStrings = specialItems.map(item => {
        if (useAbbreviations) {
            return item.nameshort;
        }
        // For extended discord format, show the full name but clean it up.
        if (item.name.startsWith('Enhancement: ')) {
            return item.name.substring('Enhancement: '.length);
        }
        return item.name;
    });
    const wargearStrings = wargearItems.map(item => {
        const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
        const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
        const itemName = useAbbreviations ? item.nameshort : item.name;
        return `${itemQtyDisplay}${itemName}`;
    });

    const allStrings = [...specialStrings, ...wargearStrings];
    
    return ` (${allStrings.join(', ')})`;
}

function generateOutput(data, useAbbreviations) {
    let html = '', plainText = '';
    const factionKeyword = data.SUMMARY?.FACTION_KEYWORD || '';
    const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (factionKeyword.split(' - ').pop() || factionKeyword);

    const colorMode = document.querySelector('input[name="colorMode"]:checked').value;
    const useCustomColors = useAbbreviations && colorMode === 'custom';
    
    let colors = {};
    if (useCustomColors) {
        colors = {
            unit: document.getElementById('unitColor').value,
            subunit: document.getElementById('subunitColor').value,
            points: document.getElementById('pointsColor').value
        };
    }

    if (data.SUMMARY) {
        const summaryParts = [];
        if (displayFaction) summaryParts.push(displayFaction);
        if (data.SUMMARY.DETACHMENT) summaryParts.push(`${data.SUMMARY.DETACHMENT}`);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) summaryParts.push(`${data.SUMMARY.TOTAL_ARMY_POINTS}`);
        if (summaryParts.length > 0) {
            const summaryText = summaryParts.join(' | ');
            const headerColorStyle = useCustomColors ? `color: ${colors.points};` : 'color: var(--color-text-secondary);';
            html += `<div style="padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);"><p style="font-size: 0.75rem; margin-bottom: 0.25rem; ${headerColorStyle} font-weight: 600;">${summaryText}</p></div>`;
            plainText += summaryText + '\n-------------------------------------\n';
        }
    }
    html += `<div style="margin-top: 0.5rem;">`;
    for (const section in data) {
        if (section !== 'SUMMARY' && Array.isArray(data[section]) && data[section].length > 0) {
            data[section].forEach(unit => {
                const numericQuantity = parseInt(unit.quantity.replace('x', ''), 10);
                let quantityDisplay = numericQuantity > 1 ? `${numericQuantity} ` : '';

                if (useAbbreviations) { // Compact List Rendering
                    const topLevelItems = unit.items.filter(item => item.points === undefined);
                    const itemsString = getInlineItemsString(topLevelItems);
                    const unitNameText = `${quantityDisplay}${unit.name}`;
                    const pointsText = `[${unit.points}]`;
                    
                    const unitNameHTML = useCustomColors ? `<span style="color: ${colors.unit};">${unitNameText}</span>` : unitNameText;
                    const pointsHTML = useCustomColors ? `<span style="color: ${colors.points};">${pointsText}</span>` : pointsText;
                    
                    const unitTextForPlain = `${unitNameText}${itemsString} ${pointsText}`;
                    const unitHTML = `${unitNameHTML}${itemsString} ${pointsHTML}`;

                    html += `<div><p style="color: var(--color-text-primary); font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">${unitHTML}</p>`;
                    plainText += `* ${unitTextForPlain}\n`;

                    const subunitItems = unit.items.filter(item => item.points !== undefined);
                    if (subunitItems.length > 0) {
                        html += `<div style="padding-left: 1rem; font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 400;">`;
                        subunitItems.forEach(item => {
                            const subUnitHasVisibleItems = item.items && item.items.some(subItem => subItem.nameshort !== "NULL" || subItem.type === 'special');
                            if (subUnitHasVisibleItems) {
                                const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                                const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                                const subunitItemsString = getInlineItemsString(item.items);
                                
                                const subunitNameText = `${itemQtyDisplay}${item.name}`;
                                const subunitNameHTML = useCustomColors ? `<span style="color: ${colors.subunit};">${subunitNameText}</span>` : subunitNameText;
                                const itemHTML = `${subunitNameHTML}${subunitItemsString}`;
                                const itemTextForPlain = `${subunitNameText}${subunitItemsString}`;

                                html += `<p style="font-weight: 500; color: var(--color-text-primary); margin: 0;">${itemHTML}</p>`;
                                plainText += `  + ${itemTextForPlain}\n`;
                            }
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                } else { // Extended List Rendering
                    const unitText = `${quantityDisplay}${unit.name} [${unit.points}]`;
                    html += `<div><p style="color: var(--color-text-primary); font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">${unitText}</p>`;
                    plainText += `* ${unitText}\n`;
                    if (unit.items && unit.items.length > 0) {
                        html += `<div style="padding-left: 1rem; font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 400;">`;
                        const topLevelItems = unit.items.filter(item => item.points === undefined);
                        const subunitItems = unit.items.filter(item => item.points !== undefined).sort((a, b) => parseInt(a.quantity.replace('x', ''), 10) - parseInt(b.quantity.replace('x', ''), 10));

                        topLevelItems.forEach(item => {
                            const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                            const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                            html += `<p style="margin: 0;">${itemQtyDisplay}${item.name}</p>`;
                            plainText += `  - ${itemQtyDisplay}${item.name}\n`;
                        });

                        subunitItems.forEach(item => {
                            const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                            const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                            const itemText = `${itemQtyDisplay}${item.name}`;
                            html += `<p style="font-weight: 500; color: var(--color-text-primary); margin: 0.5rem 0 0 0;">${itemText}</p>`;
                            plainText += `  * ${itemText}\n`;

                            if (item.items && item.items.length > 0) {
                                html += `<div style="padding-left: 1rem;">`;
                                item.items.forEach(subItem => {
                                    const subItemNumericQty = parseInt(subItem.quantity.replace('x', ''), 10);
                                    const subItemQtyDisplay = subItemNumericQty > 1 ? `${subItemNumericQty} ` : '';
                                    html += `<p style="margin: 0;">${subItemQtyDisplay}${subItem.name}</p>`;
                                    plainText += `    - ${subItemQtyDisplay}${subItem.name}\n`;
                                });
                                html += `</div>`;
                            }
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
            });
        }
    }
    html += `</div>`;
    return { html, plainText };
}    
function updateCharCounts() {
    const originalSize = document.getElementById('inputText').value.length;
    const extendedSize = extendedPlainText.trim().length;
    const compactSize = compactPlainText.trim().length;
    
                                            const hasSubunits = Array.isArray(unit.items) && unit.items.some(it => it && (it.points !== undefined || it.type === 'subunit'));
                                            if (hasSubunits) quantityDisplay = '';

    if (originalSize > 0) {
        const extendedRatioPercent = ((extendedSize / originalSize) * 100).toFixed(1);
        document.getElementById('extendedCharCount').innerHTML = `Characters: ${extendedSize} | ${extendedRatioPercent}%`;

        const compactRatioPercent = ((compactSize / originalSize) * 100).toFixed(1);
        document.getElementById('compactCharCount').innerHTML = `Characters: ${compactSize} | ${compactRatioPercent}%`;
    } else {
        document.getElementById('extendedCharCount').innerHTML = '';
        document.getElementById('compactCharCount').innerHTML = '';
    }
}

function generateDiscordText(data, plain, useAbbreviations = true) {
    const colorMode = document.querySelector('input[name="colorMode"]:checked').value;
    const useColor = !plain && colorMode !== 'none';
    let text = plain ? '' : (useColor ? '```ansi\n' : '```\n');

    const ansiPalette = [
        { name: 'grey', hex: '#808080', code: 30 },
        { name: 'red', hex: '#FF0000', code: 31 },
        { name: 'green', hex: '#00FF00', code: 32 },
        { name: 'yellow', hex: '#FFFF00', code: 33 },
        { name: 'blue', hex: '#0000FF', code: 34 },
        { name: 'magenta', hex: '#FF00FF', code: 35 },
        { name: 'cyan', hex: '#00FFFF', code: 36 },
        { name: 'white', hex: '#FFFFFF', code: 37 }
    ];

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };

    const findClosestAnsi = (hexColor) => {
        const inputRgb = hexToRgb(hexColor);
        if (!inputRgb) return ansiPalette.find(c => c.name === 'white').code;

        let minDistance = Infinity;
        let bestCode = ansiPalette.find(c => c.name === 'white').code;

        for (const color of ansiPalette) {
            const paletteRgb = hexToRgb(color.hex);
            const distance = Math.pow(inputRgb.r - paletteRgb.r, 2) +
                           Math.pow(inputRgb.g - paletteRgb.g, 2) +
                           Math.pow(inputRgb.b - paletteRgb.b, 2);
            if (distance < minDistance) {
                minDistance = distance;
                bestCode = color.code;
            }
        }
        return bestCode;
    };

    const toAnsi = (txt, hexColor, bold = false) => {
        if (!useColor || !hexColor) return txt;
        // Black is often unreadable on Discord's dark theme.
        if (hexColor.toLowerCase() === '#000000') return txt;

        const ansiCode = findClosestAnsi(hexColor);
        const boldCode = bold ? '1;' : '';
        return `\u001b[${boldCode}${ansiCode}m${txt}\u001b[0m`;
    };

    let colors = { unit: '#FFFFFF', subunit: '#808080', points: '#FFFF00' }; // Default custom colors
    if (useColor) {
        if (colorMode === 'custom') {
            colors = {
                unit: document.getElementById('unitColor').value,
                subunit: document.getElementById('subunitColor').value,
                points: document.getElementById('pointsColor').value
            };
        }
    }

    if (data.SUMMARY) {
        const summaryParts = [];
        if (data.SUMMARY.FACTION_KEYWORD) {
            const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (data.SUMMARY.FACTION_KEYWORD.split(' - ').pop() || data.SUMMARY.FACTION_KEYWORD);
            summaryParts.push(displayFaction);
        }
        if (data.SUMMARY.DETACHMENT) summaryParts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) summaryParts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (summaryParts.length > 0) {
            const header = summaryParts.join(' | ');
            text += `${toAnsi(header, colors.points, true)}\n\n`;
        }
    }
    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        data[section].forEach(unit => {
            const numericQuantity = parseInt(unit.quantity.replace('x', ''), 10);
            let quantityDisplay = numericQuantity > 1 ? `${numericQuantity} ` : '';
            // If unit has subunits, don't show aggregated top-level quantity inline
            const hasSubunits = Array.isArray(unit.items) && unit.items.some(it => it && (it.points !== undefined || it.type === 'subunit'));
            if (hasSubunits) quantityDisplay = '';
            const unitName = `${quantityDisplay}${unit.name}`;
            const points = `${unit.points}`;
            const topLevelItems = unit.items.filter(item => item.points === undefined);
            const itemsString = getInlineItemsString(topLevelItems, useAbbreviations);
            text += `* ${toAnsi(unitName, colors.unit, true)}${itemsString} ${toAnsi(`[${points}]`, colors.points, true)}\n`;
            
            const subunitItems = unit.items.filter(item => item.points !== undefined);
            subunitItems.forEach(item => {
                const subUnitHasVisibleItems = item.items && item.items.some(subItem => subItem.nameshort !== "NULL" || subItem.type === 'special');
                if (subUnitHasVisibleItems) {
                    const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                    const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                    const subunitName = item.name;
                    const subunitItemsString = getInlineItemsString(item.items, useAbbreviations);
                    const subunitText = `${itemQtyDisplay}${subunitName}`;
                    const prefix = plain ? '*' : '+';
                    text += `  ${prefix} ${toAnsi(subunitText, colors.subunit)}${subunitItemsString}\n`;
                }
            });
        });
    }
    if (!plain) text += '```';
    return text;
}

async function copyTextToClipboard(text) {
    if (!text) return;
    if (!navigator.clipboard) {
        console.error('Clipboard API not available');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        const popup = document.getElementById('copyPopup');
        popup.classList.add('show');
        setTimeout(() => { popup.classList.remove('show'); }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}

document.getElementById('copyExtendedButton').addEventListener('click', () => {
     copyTextToClipboard(extendedPlainText.trim());
});

document.getElementById('copyCompactButton').addEventListener('click', () => {
    if (parsedData) {
    const textToCopy = generateDiscordText(parsedData, false, true, factionAbbreviationDBs);
        copyTextToClipboard(textToCopy);
    }
});

document.getElementById('copyExtendedDiscordButton').addEventListener('click', () => {
    if (parsedData) {
    const textToCopy = generateDiscordText(parsedData, false, false, factionAbbreviationDBs);
        copyTextToClipboard(textToCopy);
    }
});

document.getElementById('copyPlainDiscordButton').addEventListener('click', () => {
    if (parsedData) {
    const textToCopy = generateDiscordText(parsedData, true, true, factionAbbreviationDBs);
        copyTextToClipboard(textToCopy.trim());
    }
});
