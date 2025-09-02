import { normalizeForComparison, flexibleNameMatch } from './utils.js';

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
    return text.split(/[\s-]/).map(word => word.charAt(0)).join('').toUpperCase();
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

            if (unitRules === true) {
                if (wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            } else if (Array.isArray(unitRules)) {
                if (unitRules.includes(item.name) && wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            }

            const factionWideRules = factionRules['*'];
            if (Array.isArray(factionWideRules)) {
                if (factionWideRules.includes(item.name) && wargearMap.has(item.name)) {
                    wargearMap.get(item.name).abbr = 'NULL';
                }
            }
        }
        if (item.items && item.items.length > 0) {
            markSkippable(item.items, factionRules, unitName, wargearMap);
        }
    });
}

export function generateAbbreviations(parsedList) {
    const wargearMap = new Map();

    // Phase 1: Data Collection
    for (const section in parsedList) {
        if (Array.isArray(parsedList[section])) {
            parsedList[section].forEach(unit => {
                collectWargear(unit.items, wargearMap, unit.name);
            });
        }
    }

    // Initial Abbreviation
    for (const [name, data] of wargearMap.entries()) {
        const words = name.split(' ');
        if (words.length === 1 && name.length > 3) {
            data.abbr = shortenWord(name);
        } else {
            data.abbr = getInitialism(name);
        }
    }

    // Phase 2: Conflict Resolution
    const conflicts = new Map();
    for (const [name, data] of wargearMap.entries()) {
        if (!conflicts.has(data.abbr)) {
            conflicts.set(data.abbr, []);
        }
        conflicts.get(data.abbr).push(name);
    }

    for (const [abbr, names] of conflicts.entries()) {
        if (names.length > 1) {
            // Conflict detected
            names.forEach(name => {
                const words = name.split(' ');
                let newAbbr = '';
                if (words.length > 1) {
                    let length = 1;
                    let unique = false;
                    while(!unique) {
                        newAbbr = words.map(word => shortenWord(word).slice(0, length)).join('').toUpperCase();
                        const otherNames = names.filter(n => n !== name);
                        const otherAbbrs = otherNames.map(n => n.split(' ').map(w => shortenWord(w).slice(0, length)).join('').toUpperCase());
                        if (!otherAbbrs.includes(newAbbr)) {
                            unique = true;
                        }
                        length++;
                        // Add a safeguard to prevent infinite loops in case of unresolvable conflicts
                        if (length > 10) { // Arbitrary limit, adjust as needed
                            newAbbr = name.toUpperCase(); // Fallback to full name
                            unique = true;
                        }
                    }
                } else {
                    newAbbr = shortenWord(name).toUpperCase();
                }
                wargearMap.get(name).abbr = newAbbr;
            });
        }
    }
    
    // Mark skippable wargear
    const factionName = parsedList.SUMMARY?.FACTION_KEYWORD;
    const factionRules = skippableWargear[factionName];

    if (factionRules) {
        for (const section in parsedList) {
            if (Array.isArray(parsedList[section])) {
                parsedList[section].forEach(unit => {
                    markSkippable(unit.items, factionRules, unit.name, wargearMap);
                });
            }
        }
    }

    return wargearMap;
}
