export function getIndent(line) {
    const match = line.match(/^\s*/);
    return match ? match[0].length : 0;
}

export function normalizeForComparison(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseItemString(itemString) {
    const itemRegex = /^(?:(\d+)x?\s+)?(.*)/;
    const itemMatch = itemString.trim().match(itemRegex);
    if (itemMatch) {
        const quantity = itemMatch[1] ? `${itemMatch[1]}x` : '1x';
    let name = itemMatch[2].trim();
    // Normalize inputs that begin with the literal 'with' (e.g. "with Hideous Mutations")
    name = name.replace(/^with\s+/i, '').trim();
        return { quantity, name };
    }
    return { quantity: '1x', name: itemString.trim() };
}

export function flexibleNameMatch(name1, name2) {
    if (!name1 || !name2) return false;
    const normName1 = normalizeForComparison(name1).replace(/s$/, '');
    const normName2 = normalizeForComparison(name2).replace(/s$/, '');

    return normName1.includes(normName2) || normName2.includes(normName1);
}

// Sort wargear/special item arrays in-place: descending numeric quantity, then by name (A-Z)
export function sortItemsByQuantityThenName(items) {
    if (!Array.isArray(items)) return items;
    items.sort((a, b) => {
        const aq = parseInt(String((a && a.quantity) || '1x').replace(/x/i, ''), 10) || 1;
        const bq = parseInt(String((b && b.quantity) || '1x').replace(/x/i, ''), 10) || 1;
        // descending quantity
        if (aq !== bq) return bq - aq;
        const an = (a && a.name) ? a.name.toString().toLowerCase() : '';
        const bn = (b && b.name) ? b.name.toString().toLowerCase() : '';
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
    });
    return items;
}

export function getCanonicalFactionName(faction) {
    if (!faction) return faction;
    
    // Normalize curly apostrophes to straight ones
    let normalized = faction.toString()
        .replace(/[\u2018\u2019\u201B\u2032]/g, "'");
    
    // Normalize text (remove accents/diacritics)
    try {
        normalized = normalized.normalize('NFD').replace(/\p{M}/gu, '');
    } catch (e) {
        // Fallback
    }
    
    normalized = normalized.toLowerCase().trim();
    
    const mapping = {
        // T'au Empire
        "empire t'au": "T'au Empire",
        "imperio t'au": "T'au Empire",
        "t'au-imperium": "T'au Empire",
        "tau-imperium": "T'au Empire",
        "tau imperium": "T'au Empire",
        "impero t'au": "T'au Empire",
        "sternenreich der t'au": "T'au Empire",
        "sternenreich der tau": "T'au Empire",
        "t'au empire": "T'au Empire",
        "tau empire": "T'au Empire",
        "imperio tau": "T'au Empire",
        "impero tau": "T'au Empire",

        // Chaos Daemons
        "demons du chaos": "Chaos Daemons",
        "demonios del caos": "Chaos Daemons",
        "chaosdaemonen": "Chaos Daemons",
        "chaos-daemonen": "Chaos Daemons",
        "chaosdämonen": "Chaos Daemons",
        "chaos-dämonen": "Chaos Daemons",
        "demoni del caos": "Chaos Daemons",
        "chaos daemons": "Chaos Daemons",

        // Genestealer Cults
        "cultes genestealers": "Genestealer Cults",
        "culte genestealers": "Genestealer Cults",
        "cultos genestealer": "Genestealer Cults",
        "culto genestealer": "Genestealer Cults",
        "symbiontenkulte": "Genestealer Cults",
        "symbiontenkult": "Genestealer Cults",
        "culti di genestealer": "Genestealer Cults",
        "culto dei genestealer": "Genestealer Cults",
        "culti dei genestealer": "Genestealer Cults",
        "genestealer cults": "Genestealer Cults",

        // Grey Knights
        "chevaliers gris": "Grey Knights",
        "caballeros grises": "Grey Knights",
        "graue ritter": "Grey Knights",
        "cavalieri grigi": "Grey Knights",
        "grey knights": "Grey Knights",

        // Imperial Knights
        "chevaliers imperiaux": "Imperial Knights",
        "caballeros imperiales": "Imperial Knights",
        "imperiale ritter": "Imperial Knights",
        "cavalieri imperiali": "Imperial Knights",
        "imperial knights": "Imperial Knights",

        // Leagues of Votann
        "ligues de votann": "Leagues of Votann",
        "ligas de votann": "Leagues of Votann",
        "ligen von votann": "Leagues of Votann",
        "leghe di votann": "Leagues of Votann",
        "leagues of votann": "Leagues of Votann",

        // Necrons
        "necrons": "Necrons",
        "necrones": "Necrons",
        "necroni": "Necrons",
        "necron": "Necrons",

        // Salamanders
        "salamandres": "Salamanders",
        "salamandras": "Salamanders",
        "salamandre": "Salamanders",
        "salamanders": "Salamanders",

        // Tyranids
        "tyranides": "Tyranids",
        "tiranidos": "Tyranids",
        "tyraniden": "Tyranids",
        "tiranidi": "Tyranids",
        "tyranids": "Tyranids",

        // Agents of the Imperium
        "agents de l'imperium": "Agents of the Imperium",
        "agentes del imperio": "Agents of the Imperium",
        "agenten des imperiums": "Agents of the Imperium",
        "agenti dell'imperium": "Agents of the Imperium",
        "agents of the imperium": "Agents of the Imperium",
        "agents imperiaux": "Agents of the Imperium",
        "agentes imperiales": "Agents of the Imperium",
        "imperiale agenten": "Agents of the Imperium",
        "agenti imperiali": "Agents of the Imperium",
        "imperial agents": "Agents of the Imperium",

        // Space Marines
        "marines espaciales": "Space Marines",
        "marines spaziali": "Space Marines",
        "space marines": "Space Marines",
        "weltraummarines": "Space Marines",

        // World Eaters
        "devoradores de mundos": "World Eaters",
        "divoratori di mondi": "World Eaters",
        "mangeurs de mondes": "World Eaters",
        "weltenfresser": "World Eaters",
        "world eaters": "World Eaters",

        // Death Guard
        "guardia de la muerte": "Death Guard",
        "guardia della morte": "Death Guard",
        "garde de la mort": "Death Guard",
        "todesgarde": "Death Guard",
        "death guard": "Death Guard",

        // Thousand Sons
        "mil hijos": "Thousand Sons",
        "mille figli": "Thousand Sons",
        "mille fils": "Thousand Sons",
        "tausend sohne": "Thousand Sons",
        "thousand sons": "Thousand Sons",

        // Chaos Space Marines
        "marines espaciales del caos": "Chaos Space Marines",
        "space marines del caos": "Chaos Space Marines",
        "space marines du chaos": "Chaos Space Marines",
        "chaos space marines": "Chaos Space Marines",

        // Chaos Knights
        "caballeros del caos": "Chaos Knights",
        "cavalieri del caos": "Chaos Knights",
        "chevaliers du chaos": "Chaos Knights",
        "chaosritter": "Chaos Knights",
        "chaos knights": "Chaos Knights",

        // Dark Angels
        "angeles oscuros": "Dark Angels",
        "angeli oscuri": "Dark Angels",
        "anges sombres": "Dark Angels",
        "dunkle engel": "Dark Angels",
        "dark angels": "Dark Angels",

        // Blood Angels
        "angeles sangrientos": "Blood Angels",
        "angeli sanguinari": "Blood Angels",
        "anges sanguins": "Blood Angels",
        "blutengel": "Blood Angels",
        "blood angels": "Blood Angels",

        // Black Templars
        "templarios negros": "Black Templars",
        "templari neri": "Black Templars",
        "templiers noirs": "Black Templars",
        "schwarze templer": "Black Templars",
        "black templars": "Black Templars",

        // Space Wolves
        "lobos espaciales": "Space Wolves",
        "lupi spaziali": "Space Wolves",
        "loups spatiaux": "Space Wolves",
        "weltraumwolfe": "Space Wolves",
        "space wolves": "Space Wolves",

        // Adepta Sororitas
        "sisters of battle": "Adepta Sororitas",
        "soeurs de bataille": "Adepta Sororitas",
        "hermanas de batalla": "Adepta Sororitas",
        "schwestern des kampfes": "Adepta Sororitas",
        "sororitas": "Adepta Sororitas",
        "sorelle della battaglia": "Adepta Sororitas",
        "adepta sororitas": "Adepta Sororitas",

        // Astra Militarum
        "imperial guard": "Astra Militarum",
        "garde imperiale": "Astra Militarum",
        "guardia imperial": "Astra Militarum",
        "imperiale armee": "Astra Militarum",
        "imperiale garde": "Astra Militarum",
        "guardia imperiale": "Astra Militarum",
        "astra militarum": "Astra Militarum",

        // Deathwatch
        "todeswache": "Deathwatch",
        "guet de la mort": "Deathwatch",
        "guardianes de la muerte": "Deathwatch",
        "veglia della morte": "Deathwatch",
        "deathwatch": "Deathwatch",

        // Drukhari
        "dark eldar": "Drukhari",
        "eldars noirs": "Drukhari",
        "eldar noirs": "Drukhari",
        "eldars oscuros": "Drukhari",
        "eldar oscuros": "Drukhari",
        "dunkle eldar": "Drukhari",
        "eldar oscuri": "Drukhari",
        "drukhari": "Drukhari",

        // Emperor's Children
        "enfants de l'empereur": "Emperor's Children",
        "hijos del emperador": "Emperor's Children",
        "kinder des imperators": "Emperor's Children",
        "figli dell'imperatore": "Emperor's Children",
        "emperor's children": "Emperor's Children",

        // Imperial Fists
        "poings imperiaux": "Imperial Fists",
        "punos imperiales": "Imperial Fists",
        "imperiale fauste": "Imperial Fists",
        "magli imperiali": "Imperial Fists",
        "pugni imperiali": "Imperial Fists",
        "imperial fists": "Imperial Fists",

        // Iron Hands
        "mains de fer": "Iron Hands",
        "manos de hierro": "Iron Hands",
        "eiserne hande": "Iron Hands",
        "mani di ferro": "Iron Hands",
        "iron hands": "Iron Hands",

        // Orks
        "orcs": "Orks",
        "orkos": "Orks",
        "orki": "Orks",
        "orks": "Orks",

        // Raven Guard
        "garde du corbeau": "Raven Guard",
        "guardia del cuervo": "Raven Guard",
        "rabengarde": "Raven Guard",
        "guardia del corvo": "Raven Guard",
        "raven guard": "Raven Guard",

        // White Scars
        "cicatrices blanches": "White Scars",
        "cicatrices blancas": "White Scars",
        "weisse narben": "White Scars",
        "cicatrici bianche": "White Scars",
        "white scars": "White Scars"
    };
    
    if (mapping[normalized]) {
        return mapping[normalized];
    }
    
    return faction;
}

export function isWargearSkippable(skippableWargearMap, faction, unitName, wargearName) {
    if (!skippableWargearMap || !faction || !unitName || !wargearName) return false;
    
    const canonicalFaction = getCanonicalFactionName(faction);
    
    const normalizeKey = (s) => {
        if (!s) return '';
        try {
            return s.toString().normalize('NFD')
                .replace(/\p{M}/gu, '')
                .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
                .replace(/[^\w\s'\-]/g, '')
                .toLowerCase().trim();
        } catch (e) {
            return s.toString().toLowerCase().trim();
        }
    };

    const factionKey = normalizeKey(canonicalFaction);
    const unitKey = normalizeKey(unitName);
    const unitAlt = unitKey.endsWith('s') ? unitKey.slice(0, -1) : unitKey + 's';
    const wargearKey = wargearName.toLowerCase().trim();

    // Find faction entry
    let factionData = undefined;
    for (const [k, v] of Object.entries(skippableWargearMap)) {
        if (normalizeKey(k) === factionKey) {
            factionData = v;
            break;
        }
    }
    if (!factionData) return false;

    // Find unit entry
    let unitData = undefined;
    const tryUnitKeys = [unitName, unitKey, unitAlt];
    for (const uk of tryUnitKeys) {
        if (Object.prototype.hasOwnProperty.call(factionData, uk)) {
            unitData = factionData[uk];
            break;
        }
    }
    if (unitData === undefined) {
        for (const [k, v] of Object.entries(factionData)) {
            if (normalizeKey(k) === unitKey || normalizeKey(k) === unitAlt) {
                unitData = v;
                break;
            }
        }
    }

    if (unitData === true) return true;
    if (Array.isArray(unitData)) {
        return unitData.map(s => (s || '').toString().toLowerCase().trim()).includes(wargearKey);
    }
    return false;
}

export function getModelsCount(unit) {
    if (!unit) return 1;
    if (Array.isArray(unit.subunits) && unit.subunits.length > 0) {
        return unit.subunits.reduce((sum, sub) => sum + (parseInt(sub.quantity, 10) || 0), 0);
    }
    const q = parseInt((unit.quantity || '1').toString().replace('x', ''), 10);
    return isNaN(q) ? 1 : q;
}