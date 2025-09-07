// Faction color mapping for Discord/ANSI output.
// Only colors from the project's ansiPalette are used here.
// Keys should match the top-level keys from `skippable_wargear.json` or the
// `DISPLAY_FACTION`/`FACTION_KEYWORD` values produced by parsers.
//
// Rules applied when choosing colors:
// - Allowed hexes: '#000000','#FF0000','#00FF00','#FFFF00','#0000FF','#FF00FF','#00FFFF','#FFFFFF','#808080'
// - Unit != Subunit
// - Subunit != Wargear
// - Wargear != Points
// - Treat '#000000' and '#808080' as equivalent for uniqueness purposes
export default {
    "World Eaters":        { unit: '#FF0000', subunit: '#808080', wargear: '#FFFF00', points: '#00FF00' },
    "Adepta Sororitas":    { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Adeptus Custodes":    { unit: '#FFFFFF', subunit: '#808080', wargear: '#FF00FF', points: '#FFFF00' },
    "Adeptus Mechanicus":  { unit: '#FF00FF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Adeptus Titanicus":   { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Aeldari":             { unit: '#FF00FF', subunit: '#808080', wargear: '#00FFFF', points: '#FFFF00' },
    "Astra Militarum":     { unit: '#FFFF00', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Black Templars":      { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Blood Angels":        { unit: '#FF0000', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Chaos Daemons":       { unit: '#FF0000', subunit: '#808080', wargear: '#00FF00', points: '#FFFF00' },
    "Chaos Knights":       { unit: '#FF0000', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Chaos Space Marines": { unit: '#FF0000', subunit: '#808080', wargear: '#00FF00', points: '#FFFF00' },
    "Dark Angels":         { unit: '#00FF00', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Death Guard":         { unit: '#00FF00', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Deathwatch":         { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Drukhari":            { unit: '#FF00FF', subunit: '#808080', wargear: '#00FFFF', points: '#FFFF00' },
    "Emperor's Children":  { unit: '#FF00FF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Genestealer Cults":   { unit: '#00FFFF', subunit: '#808080', wargear: '#00FF00', points: '#FFFF00' },
    "Grey Knights":        { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Imperial Fists":      { unit: '#FFFF00', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Imperial Knights":    { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Iron Hands":          { unit: '#808080', subunit: '#ffffff', wargear: '#808080', points: '#FFFFFF' },
    "Leagues of Votann":   { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Necrons":             { unit: '#00FF00', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Orks":                { unit: '#00FF00', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Raven Guard":         { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Salamanders":         { unit: '#00FF00', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Space Marines":       { unit: '#0000FF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Space Wolves":        { unit: '#0000FF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "T'au Empire":         { unit: '#00FFFF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "Thousand Sons":       { unit: '#FF00FF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' },
    "Tyranids":            { unit: '#00FFFF', subunit: '#808080', wargear: '#00FF00', points: '#FFFF00' },
    "Ultramarines":        { unit: '#0000FF', subunit: '#808080', wargear: '#FFFFFF', points: '#FFFF00' },
    "White Scars":         { unit: '#FFFFFF', subunit: '#808080', wargear: '#FF0000', points: '#FFFF00' },
    "Agents of the Imperium": { unit: '#FFFFFF', subunit: '#808080', wargear: '#0000FF', points: '#FFFF00' }
};

