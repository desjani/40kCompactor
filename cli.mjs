import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, parseGwApp, parseWtcCompact, parseWtc, parseNrGw, parseNrNr, parseLf } from './modules/parsers.js';
import { generateDiscordText } from './modules/renderers.js';
import { buildAbbreviationIndex } from './modules/abbreviations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colorNameToHex = {
    black: '#000000', red: '#FF0000', green: '#00FF00', yellow: '#FFFF00', blue: '#0000FF',
    magenta: '#FF00FF', cyan: '#00FFFF', white: '#FFFFFF', grey: '#808080'
};

function parseColor(input, flagName) {
    if (!input) return undefined;
    const lower = input.toLowerCase();
    if (colorNameToHex[lower]) {
        return colorNameToHex[lower];
    }
    console.error(`Error: Invalid color '${input}' for ${flagName}. Allowed colors: ${Object.keys(colorNameToHex).join(', ')}`);
    process.exit(1);
}

function printUsage() {
    console.log(`
Usage: node cli.mjs [options] [input-file]

Options:
  -i, --input <file>       Input file path (reads from stdin if not provided)
  -f, --format <format>    Output format: discordCompact (default), discordExtended, plainText, plainTextExtended, json
  --hide-subunits          Hide subunits in compact view
  --combine-units          Combine identical units
  --multiline-header       Use multiline header
  --no-bullets             Disable bullet points
  --hide-points            Hide points costs
  --color-mode <mode>      Color mode: none, faction (default), custom
  --color-unit <color>     Custom color for units
  --color-subunit <color>  Custom color for subunits
  --color-wargear <color>  Custom color for wargear
  --color-points <color>   Custom color for points
  --color-header <color>   Custom color for header
  --help                   Show this help message

Allowed colors: ${Object.keys(colorNameToHex).join(', ')}
`);
}

async function main() {
    const args = process.argv.slice(2);
    const options = {
        input: null,
        format: 'discordCompact',
        hideSubunits: false,
        combineUnits: false,
        multilineHeader: false,
        noBullets: false,
        hidePoints: false,
        colorMode: 'faction',
        colors: {}
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        } else if (arg === '--input' || arg === '-i') {
            options.input = args[++i];
        } else if (arg === '--format' || arg === '-f') {
            options.format = args[++i];
        } else if (arg === '--hide-subunits') {
            options.hideSubunits = true;
        } else if (arg === '--combine-units') {
            options.combineUnits = true;
        } else if (arg === '--multiline-header') {
            options.multilineHeader = true;
        } else if (arg === '--no-bullets') {
            options.noBullets = true;
        } else if (arg === '--hide-points') {
            options.hidePoints = true;
        } else if (arg === '--color-mode') {
            options.colorMode = args[++i];
        } else if (arg === '--color-unit') {
            options.colors.unit = parseColor(args[++i], '--color-unit');
        } else if (arg === '--color-subunit') {
            options.colors.subunit = parseColor(args[++i], '--color-subunit');
        } else if (arg === '--color-wargear') {
            options.colors.wargear = parseColor(args[++i], '--color-wargear');
        } else if (arg === '--color-points') {
            options.colors.points = parseColor(args[++i], '--color-points');
        } else if (arg === '--color-header') {
            options.colors.header = parseColor(args[++i], '--color-header');
        } else if (!arg.startsWith('-') && !options.input) {
            options.input = arg;
        }
    }

    // Read Input
    let inputText = '';
    if (options.input) {
        try {
            inputText = fs.readFileSync(options.input, 'utf8');
        } catch (e) {
            console.error(`Error reading input file: ${e.message}`);
            process.exit(1);
        }
    } else {
        // Read from stdin
        inputText = await new Promise((resolve, reject) => {
            const chunks = [];
            process.stdin.on('data', chunk => chunks.push(chunk));
            process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            process.stdin.on('error', reject);
        });
    }

    if (!inputText.trim()) {
        console.error('No input provided.');
        printUsage();
        process.exit(1);
    }

    // Load skippable_wargear.json
    let skippableWargearMap = {};
    try {
        const configPath = path.join(__dirname, 'skippable_wargear.json');
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            skippableWargearMap = JSON.parse(content);
        }
    } catch (e) {
        console.warn('Warning: Failed to load skippable_wargear.json', e.message);
    }

    // Detect Format
    const lines = inputText.split(/\r?\n/);
    const format = detectFormat(lines);
    
    const parser = {
        GW_APP: parseGwApp,
        WTC: parseWtc,
        WTC_COMPACT: parseWtcCompact,
        NR_GW: parseNrGw,
        NRNR: parseNrNr,
        LF: parseLf
    }[format];

    if (!parser) {
        console.error('Unsupported list format.');
        process.exit(1);
    }

    // Parse
    let parsedData;
    try {
        parsedData = parser(lines);
    } catch (e) {
        console.error('Error parsing list:', e);
        process.exit(1);
    }

    if (options.format === 'json') {
        console.log(JSON.stringify(parsedData, (k, v) => (k === '_parent' ? undefined : v), 2));
        return;
    }

    // Build Abbreviations
    let wargearAbbrDB = { __flat_abbr: {} };
    try {
        wargearAbbrDB = buildAbbreviationIndex(parsedData);
    } catch (e) {
        console.warn('Warning: Failed to build abbreviation index', e);
    }

    // Render
    const renderOptions = {
        colorMode: options.colorMode,
        multilineHeader: options.multilineHeader,
        colors: options.colors,
        forcePalette: true
    };

    let output = '';
    switch (options.format) {
        case 'discordCompact':
            output = generateDiscordText(parsedData, false, true, wargearAbbrDB, options.hideSubunits, skippableWargearMap, options.combineUnits, renderOptions, options.noBullets, options.hidePoints);
            break;
        case 'discordExtended':
            output = generateDiscordText(parsedData, false, false, wargearAbbrDB, options.hideSubunits, skippableWargearMap, options.combineUnits, renderOptions, options.noBullets, options.hidePoints);
            break;
        case 'plainText':
            output = generateDiscordText(parsedData, true, true, wargearAbbrDB, options.hideSubunits, skippableWargearMap, options.combineUnits, renderOptions, options.noBullets, options.hidePoints);
            break;
        case 'plainTextExtended':
            output = generateDiscordText(parsedData, true, false, wargearAbbrDB, options.hideSubunits, skippableWargearMap, options.combineUnits, renderOptions, options.noBullets, options.hidePoints);
            break;
        default:
            console.error(`Unknown format: ${options.format}`);
            process.exit(1);
    }

    console.log(output);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
