import { normalizeForComparison, flexibleNameMatch } from './utils.js';

const SPACE_MARINE_CHAPTERS = [
    "Adeptus Astartes", // General Space Marine faction
    "Ultramarines",
    "Dark Angels",
    "Blood Angels",
    "Space Wolves",
    "Imperial Fists",
    "Salamanders",
    "Raven Guard",
    "White Scars",
    "Black Templars",
    "Deathwatch",
    "Grey Knights"
];

const IMPERIUM_FACTIONS = [...new Set([
    "Adepta Sororitas",
    "Adeptus Custodes",
    "Adeptus Mechanicus",
    "Adeptus Titanicus",
    "Astra Militarum",
    "Agents of the Imperium",
    "Imperial Knights",
    ...SPACE_MARINE_CHAPTERS
])];

let skippableWargear = {};
let abbreviationRules = {};

export async function loadAbbreviationRules() {
    try {
        const [skippableResponse, rulesResponse] = await Promise.all([
            fetch('./skippable_wargear.json?v=0.1.2'),
            fetch('./abbreviation_rules.json?v=0.1.2')
        ]);

        if (!skippableResponse.ok) {
            throw new Error(`HTTP error! status: ${skippableResponse.status}`);
        }
        if (!rulesResponse.ok) {
            throw new Error(`HTTP error! status: ${rulesResponse.status}`);
        }

        skippableWargear = await skippableResponse.json();
        abbreviationRules = await rulesResponse.json();

        console.log("Abbreviation rules loaded successfully.");
        return true;
    } catch (error) {
        console.error("Could not load abbreviation rules:", error);
        return false;
    }
}

function getInitialism(text) {
    if (!text) return '';
    const processedText = text.replace(/\band\b/gi, '&'); // Use word boundaries to match whole word "and"
    return processedText.split(/[\s-]/).map(word => word.charAt(0)).join('').toUpperCase();
}

function shortenWord(word) {
    const lowerWord = word.toLowerCase();
    if (abbreviationRules[lowerWord]) {
        return abbreviationRules[lowerWord];
    }
    // Fallback: remove vowels
    return lowerWord.replace(/[aeiou]/gi, '');
}

function collectWargear(items, wargearMap, unitName) {
    items.forEach(item => {
        if (item.type === 'wargear') {
            if (!wargearMap.has(item.name)) {
                wargearMap.set(item.name, {
                    units: new Set(),
                    abbr: ''
                });
            }
            wargearMap.get(item.name).units.add(unitName);
        }
        if (item.items && item.items.length > 0) {
            collectWargear(item.items, wargearMap, unitName);
        }
    });
}

function markSkippable(items, factionRules, unitName, wargearMap) {
    items.forEach(item => {
        if (item.type === 'wargear') {
            let unitRules = null;
            for (const key in factionRules) {
                if (flexibleNameMatch(key, unitName)) {
                    unitRules = factionRules[key];
                    break;
                }
            }

            // Convert item.name to lowercase for case-insensitive comparison
            const lowerCaseItemName = item.name.toLowerCase();

            if (unitRules === true) {
                if (wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            } else if (Array.isArray(unitRules)) {
                // Convert each rule to lowercase for comparison
                const lowerCaseUnitRules = unitRules.map(rule => rule.toLowerCase());
                if (lowerCaseUnitRules.includes(lowerCaseItemName) && wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            }

            const factionWideRules = factionRules['*'];
            if (Array.isArray(factionWideRules)) {
                // Convert each rule to lowercase for comparison
                const lowerCaseFactionWideRules = factionWideRules.map(rule => rule.toLowerCase());
                if (lowerCaseFactionWideRules.includes(lowerCaseItemName) && wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            }
        }
        if (item.items && item.items.length > 0) {
            markSkippable(item.items, factionRules, unitName, wargearMap);
        }
    });
}

// This function attempts to resolve a conflict by extending the abbreviation of 'nameToAbbreviate'
// until it is unique among 'existingAbbrs'.
function resolveConflict(nameToAbbreviate, existingAbbrs, originalName) {
    const processedName = originalName.replace(/\band\b/gi, '&');
    const words = processedName.split(/[\s-]/);
    if (words.length === 0) return originalName.toUpperCase(); // Fallback

    let currentLength = 1;
    let newAbbr = '';

    while (true) {
        // Corrected camel case for the first word's extended part
        let firstWordPart = words[0].charAt(0).toUpperCase() + words[0].substring(1, currentLength).toLowerCase();
        newAbbr = firstWordPart;

        for (let i = 1; i < words.length; i++) {
            newAbbr += words[i].charAt(0).toUpperCase(); // Take first letter from subsequent words
        }

        if (!existingAbbrs.has(newAbbr)) {
            return newAbbr; // Found a unique abbreviation
        }

        currentLength++;
        // Safeguard to prevent infinite loops or overly long abbreviations
        if (currentLength > words[0].length + 5) { // +5 to allow some extra characters if needed
            return generateCamelCaseAbbr(originalName); // Fallback to a more descriptive but potentially longer abbr
        }
    }
}

// Helper to generate camel case abbreviation (for fallback or specific cases)
function generateCamelCaseAbbr(name) {
    if (!name) return '';
    const processedName = name.replace(/\band\b/gi, '&');
    const words = processedName.split(/[\s-]/);
    if (words.length === 0) return '';

    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
}

export function generateAbbreviations(parsedList) {
    const wargearMap = new Map(); // Stores { name: { units: Set, abbr: string } }

    // Phase 1: Data Collection
    for (const section in parsedList) {
        if (Array.isArray(parsedList[section])) {
            parsedList[section].forEach(unit => {
                collectWargear(unit.items, wargearMap, unit.name);
            });
        }
    }

    // Phase 1.5: Mark skippable wargear (moved up to ensure 'NULL' is set early)
    const factionName = parsedList.SUMMARY?.FACTION_KEYWORD;
    let relevantFactionRules = {};

    // Always include the specific faction's rules if they exist
    if (skippableWargear[factionName]) {
        Object.assign(relevantFactionRules, skippableWargear[factionName]);
    }

    // Check if the current faction is an Imperium faction
    const isImperiumFaction = IMPERIUM_FACTIONS.some(faction => factionName.includes(faction));

    if (isImperiumFaction) {
        if (skippableWargear["Space Marines"]) {
            Object.assign(relevantFactionRules, skippableWargear["Space Marines"]);
        }
        if (skippableWargear["Agents of the Imperium"]) {
            Object.assign(relevantFactionRules, skippableWargear["Agents of the Imperium"]);
        }
        if (skippableWargear["Imperial Knights"]) {
            Object.assign(relevantFactionRules, skippableWargear["Imperial Knights"]);
        }
    }

    // Only proceed if there are any relevant rules
    if (Object.keys(relevantFactionRules).length > 0) {
        for (const section in parsedList) {
            if (Array.isArray(parsedList[section])) {
                parsedList[section].forEach(unit => {
                    markSkippable(unit.items, relevantFactionRules, unit.name, wargearMap);
                });
            }
        }
    }

    // Phase 2: Initial Abbreviation Generation and Conflict Resolution
    const usedAbbrs = new Set(); // To keep track of abbreviations already assigned
    const itemsToProcess = Array.from(wargearMap.entries()); // Convert to array to maintain order

    for (const [name, data] of itemsToProcess) {
        if (data.abbr === 'NULL') {
            // If already marked as NULL, skip abbreviation generation and conflict resolution
            continue;
        }

        let currentAbbr;
        const words = name.split(' ');

        if (words.length === 1 && name.length > 3) {
            currentAbbr = shortenWord(name).toUpperCase(); // Use shortenWord for single words
        } else {
            currentAbbr = getInitialism(name); // Use initialism for multiple words
        }

        // Check for conflict with already assigned abbreviations
        if (usedAbbrs.has(currentAbbr)) {
            // Conflict detected, resolve for the current item
            const existingAbbrsForResolution = new Set(usedAbbrs); // Pass a copy of currently used abbrs
            currentAbbr = resolveConflict(name, existingAbbrsForResolution, name);
        }

        data.abbr = currentAbbr;
        usedAbbrs.add(currentAbbr);
    }

    return wargearMap;
}
