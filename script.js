import { h, render } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';
import { App } from './App.js';
import { parseGwApp } from './parsers/gw_app_parser.js';
import { parseWtcCompact } from './parsers/wtc_compact_parser.js';
import { parseRosz } from './parsers/rosz_parser.js';

// Store the parsed data globally within the script's scope
let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';

// --- Abbreviation Database ---
let factionAbbreviationDBs = {}; // Use let to allow reassignment

document.addEventListener('DOMContentLoaded', () => {
    render(h(App), document.getElementById('app'));

    const parseButton = document.getElementById('parseButton');
    parseButton.disabled = true;
    parseButton.textContent = 'Loading DB...';

    fetch('./Wargear_tree.json?v=0.0.8')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
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
                const compactOutput = generateOutput(parsedData, true);
                document.getElementById('compactedOutput').innerHTML = compactOutput.html;
                compactPlainText = compactOutput.plainText; // Keep plain text in sync
            }
        });
    });

    const roszInput = document.getElementById('roszInput');
    roszInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            parseRosz(file)
                .then(result => {
                    parsedData = result;
                    const extendedOutput = generateOutput(result, false);
                    document.getElementById('unabbreviatedOutput').innerHTML = extendedOutput.html;
                    extendedPlainText = extendedOutput.plainText;
                    const compactOutput = generateOutput(result, true);
                    document.getElementById('compactedOutput').innerHTML = compactOutput.html;
                    compactPlainText = compactOutput.plainText;
                    updateCharCounts();
                })
                .catch(error => {
                    console.error(error);
                    document.getElementById('unabbreviatedOutput').innerHTML = `<p style="color: var(--color-danger);">${error.message}</p>`;
                    document.getElementById('compactedOutput').innerHTML = '';
                });
        }
    });
})

function normalizeForComparison(name) {
    if (!name) return '';
    // Decomposes accented chars (e.g., 'â' -> 'a' + '^') and removes the diacritics.
    // Also handles lowercase, trim, and common character variations.
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
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
         searchOrder.push("Space Marines", "Imperial Knights", "Imperial Agents");
     } else if (fullFactionKeyword && fullFactionKeyword.includes("Imperium")) {
         // For other non-SM Imperium factions
         searchOrder.push("Imperial Knights", "Agents of the Imperium");
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
    const extendedOutput = generateOutput(result, false);
    document.getElementById('unabbreviatedOutput').innerHTML = extendedOutput.html;
    extendedPlainText = extendedOutput.plainText;
    const compactOutput = generateOutput(result, true);
    document.getElementById('compactedOutput').innerHTML = compactOutput.html;
    compactPlainText = compactOutput.plainText;
    updateCharCounts();
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
    WTC_COMPACT: parseWtcCompact,
    ROSZ: parseRosz
};

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
    
    document.getElementById('inputCharCount').textContent = `Characters: ${originalSize}`;

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
            if (unit.isComplex) {
                quantityDisplay = '';
            }
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
        const textToCopy = generateDiscordText(parsedData, false, true);
        copyTextToClipboard(textToCopy);
    }
});

document.getElementById('copyExtendedDiscordButton').addEventListener('click', (). => {
    if (parsedData) {
        const textToCopy = generateDiscordText(parsedData, false, false);
        copyTextToClipboard(textToCopy);
    }
});

document.getElementById('copyPlainDiscordButton').addEventListener('click', () => {
    if (parsedData) {
        const textToCopy = generateDiscordText(parsedData, true);
        copyTextToClipboard(textToCopy.trim());
    }
});