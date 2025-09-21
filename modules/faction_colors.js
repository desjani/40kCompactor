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
    // Use simple color names (allowed: black, red, green, yellow, blue, magenta, cyan, white, grey)
    // Each entry now includes an explicit `header` color so the page header can be colored per-faction.
    "World Eaters":        { unit: 'red',    subunit: 'grey',  wargear: 'yellow', points: 'green',  header: 'red' },
    "Adepta Sororitas":    { unit: 'white',  subunit: 'grey',  wargear: 'red',    points: 'yellow', header: 'white' },
    "Adeptus Custodes":    { unit: 'yellow', subunit: 'red',   wargear: 'white',  points: 'yellow', header: 'yellow' },
    "Adeptus Mechanicus":  { unit: 'red',     subunit: 'grey',  wargear: 'white',  points: 'green',  header: 'red' },
    "Adeptus Titanicus":   { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'yellow' },
    "Aeldari":             { unit: 'green',  subunit: 'blue',  wargear: 'white',  points: 'grey',   header: 'green' },
    "Astra Militarum":     { unit: 'grey',   subunit: 'green', wargear: 'cyan',   points: 'yellow', header: 'grey' },
    "Black Templars":      { unit: 'white',  subunit: 'grey',  wargear: 'black',  points: 'yellow', header: 'white' },
    "Blood Angels":        { unit: 'red',    subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'red' },
    "Chaos Daemons":       { unit: 'red',    subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'red' },
    "Chaos Knights":       { unit: 'red',    subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'red' },
    "Chaos Space Marines": { unit: 'red',    subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'red' },
    "Dark Angels":         { unit: 'green',  subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'green' },
    "Death Guard":         { unit: 'green',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'green' },
    "Deathwatch":          { unit: 'black',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'black' },
    "Drukhari":            { unit: 'magenta',subunit: 'grey',  wargear: 'cyan',   points: 'yellow', header: 'magenta' },
    "Emperor's Children":  { unit: 'magenta',subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'magenta' },
    "Genestealer Cults":   { unit: 'cyan',   subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'cyan' },
    "Grey Knights":        { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white' },
    "Imperial Fists":      { unit: 'yellow', subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'yellow' },
    "Imperial Knights":    { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white' },
    "Iron Hands":          { unit: 'grey',   subunit: 'white', wargear: 'grey',   points: 'white',  header: 'grey' },
    "Leagues of Votann":   { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white' },
    "Necrons":             { unit: 'white',  subunit: 'grey',  wargear: 'white',   points: 'green', header: 'green' },
    "Orks":                { unit: 'green',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'green' },
    "Raven Guard":         { unit: 'black',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'black' },
    "Salamanders":         { unit: 'green',  subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'green' },
    "Space Marines":       { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue' },
    "Space Wolves":        { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue' },
    "T'au Empire":         { unit: 'yellow',   subunit: 'grey',  wargear: 'white',  points: 'Cyan', header: 'cyan' },
    "Thousand Sons":       { unit: 'magenta',subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'magenta' },
    "Tyranids":            { unit: 'cyan',   subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'cyan' },
    "Ultramarines":        { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue' },
    "White Scars":         { unit: 'white',  subunit: 'grey',  wargear: 'red',    points: 'yellow', header: 'white' },
    "Agents of the Imperium": { unit: 'white', subunit: 'grey', wargear: 'blue', points: 'yellow', header: 'white' }
};

