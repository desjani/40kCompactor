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
    // Each entry also includes an `attached` color for the attached unit role tags ([L1], [BG1], etc.)
    "World Eaters":        { unit: 'red',    subunit: 'grey',  wargear: 'yellow', points: 'green',  header: 'red',    attached: 'cyan' },
    "Adepta Sororitas":    { unit: 'white',  subunit: 'grey',  wargear: 'red',    points: 'yellow', header: 'white',  attached: 'cyan' },
    "Adeptus Custodes":    { unit: 'yellow', subunit: 'red',   wargear: 'white',  points: 'yellow', header: 'yellow', attached: 'cyan' },
    "Adeptus Mechanicus":  { unit: 'red',     subunit: 'grey',  wargear: 'white',  points: 'green',  header: 'red',    attached: 'cyan' },
    "Adeptus Titanicus":   { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'yellow', attached: 'cyan' },
    "Aeldari":             { unit: 'green',  subunit: 'blue',  wargear: 'white',  points: 'grey',   header: 'green',  attached: 'yellow' },
    "Astra Militarum":     { unit: 'grey',   subunit: 'green', wargear: 'cyan',   points: 'yellow', header: 'grey',   attached: 'magenta' },
    "Black Templars":      { unit: 'white',  subunit: 'grey',  wargear: 'black',  points: 'yellow', header: 'white',  attached: 'cyan' },
    "Blood Angels":        { unit: 'red',    subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'red',    attached: 'cyan' },
    "Chaos Daemons":       { unit: 'red',    subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'red',    attached: 'cyan' },
    "Chaos Knights":       { unit: 'red',    subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'red',    attached: 'cyan' },
    "Chaos Space Marines": { unit: 'red',    subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'red',    attached: 'cyan' },
    "Dark Angels":         { unit: 'green',  subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'green',  attached: 'cyan' },
    "Death Guard":         { unit: 'green',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'green',  attached: 'cyan' },
    "Deathwatch":          { unit: 'black',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'black',  attached: 'cyan' },
    "Drukhari":            { unit: 'magenta',subunit: 'grey',  wargear: 'cyan',   points: 'yellow', header: 'magenta', attached: 'white' },
    "Emperor's Children":  { unit: 'magenta',subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'magenta', attached: 'cyan' },
    "Genestealer Cults":   { unit: 'cyan',   subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'cyan',   attached: 'magenta' },
    "Grey Knights":        { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white',  attached: 'cyan' },
    "Imperial Fists":      { unit: 'yellow', subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'yellow', attached: 'cyan' },
    "Imperial Knights":    { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white',  attached: 'cyan' },
    "Iron Hands":          { unit: 'grey',   subunit: 'white', wargear: 'grey',   points: 'white',  header: 'grey',   attached: 'cyan' },
    "Leagues of Votann":   { unit: 'white',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'white',  attached: 'cyan' },
    "Necrons":             { unit: 'white',  subunit: 'grey',  wargear: 'white',   points: 'green', header: 'green',  attached: 'cyan' },
    "Orks":                { unit: 'green',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'green',  attached: 'cyan' },
    "Raven Guard":         { unit: 'black',  subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'black',  attached: 'cyan' },
    "Salamanders":         { unit: 'green',  subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'green',  attached: 'cyan' },
    "Space Marines":       { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue',   attached: 'cyan' },
    "Space Wolves":        { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue',   attached: 'cyan' },
    "T'au Empire":         { unit: 'yellow',   subunit: 'grey',  wargear: 'white',  points: 'Cyan', header: 'cyan',    attached: 'magenta' },
    "Thousand Sons":       { unit: 'magenta',subunit: 'grey',  wargear: 'blue',   points: 'yellow', header: 'magenta', attached: 'cyan' },
    "Tyranids":            { unit: 'cyan',   subunit: 'grey',  wargear: 'green',  points: 'yellow', header: 'cyan',   attached: 'magenta' },
    "Ultramarines":        { unit: 'blue',   subunit: 'grey',  wargear: 'white',  points: 'yellow', header: 'blue',   attached: 'cyan' },
    "White Scars":         { unit: 'white',  subunit: 'grey',  wargear: 'red',    points: 'yellow', header: 'white',  attached: 'cyan' },
    "Agents of the Imperium": { unit: 'white', subunit: 'grey', wargear: 'blue', points: 'yellow', header: 'white', attached: 'cyan' }
};
