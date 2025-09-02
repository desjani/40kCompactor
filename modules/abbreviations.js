
import { normalizeForComparison, flexibleItemMatch, flexibleNameMatch } from './utils.js';

let factionAbbreviationDBs = {};

export async function loadAbbreviationDatabase() {
    try {
                const response = await fetch('./wargear.json?v=0.0.8');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        factionAbbreviationDBs = await response.json();
        console.log("Wargear database loaded successfully.");
        return true;
    } catch (error) {
        console.error("Could not load wargear database:", error);
        return false;
    }
}

export function abbreviate(itemName, unitName, fullFactionKeyword) {
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

           const unitRulesKey = Object.keys(rules).find(key => flexibleNameMatch(key, unitName));
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
