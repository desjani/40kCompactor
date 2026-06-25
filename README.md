# 40kCompactor

List compactor for Warhammer 40,000 lists to create Discord-friendly versions.

> [!IMPORTANT]
> **Legacy Version Lock**: The `v10/` subdirectory contains the legacy 10th edition codebase. This directory is strictly version-locked and must not be modified or edited under any circumstances.


This tool supports the following formats:
* Games Workshop App (v11)
* War Organ (Flat & Indented)
* Generic 11th Edition formats

> [!NOTE]
> Legacy 10th Edition formats are supported via the version-locked `v10/` directory.

## Features

*   **Multiple Format Support:** Paste your army list from GW App, New Recruit (WTC-Compact, WTC, GW/NR), NRNR, or ListForge (Detailed).
*   **Extended and Compact Views:** See your full list or a compacted version with abbreviations.
*   **Discord-Friendly Output:** Copy your list in various formats for easy pasting into Discord. Output is code-fenced for both ANSI-colored and plain text.
*   **Customizable Colors:** Choose your own colors for the Discord output.
*   **Smart Wargear Skipping:** Automatically hides default or redundant wargear for a cleaner compact view.

## How to Use

1.  Paste your army list into the input box.
2.  Click "Compact this list" to see the extended and compact versions.
3.  Use the "Copy" buttons to copy the list in your desired format.

## Behavior and Output

- Toggle scoping: Combine Units and Hide Subunits only affect the compact (abbreviated) output. Full Text (extended) is not affected by these toggles.
- Discord output: Both ANSI and plain variants are emitted inside triple backtick fences. When colors are enabled, the fence is ```ansi.

## Customization

The compactor's behavior can be customized by editing JSON files in the repository root:

- `skippable_wargear.json`: per-faction rules for hiding default/redundant wargear in the compact output.
- `custom_abbrs.json`: custom abbreviation overrides.

### `skippable_wargear.json`

This file defines which wargear items should be hidden in the compact view. This is useful for removing default wargear that doesn't need to be explicitly listed.

The file is structured by faction. For each faction, you can specify:
*   A list of wargear names to skip for all units in that faction (using the `*` key).
*   A list of wargear names to skip for a specific unit.
*   Set a unit to `true` to skip all wargear for that unit.

**Example:**

```json
{
    "Space Marines": {
        "*": [ "Bolt Pistol", "Close Combat Weapon" ],
        "Intercessor Squad": [ "Bolt Rifle" ],
        "Aggressor Squad": true
    }
}
```

In this example:
*   "Bolt Pistol" and "Close Combat Weapon" will be skipped for all Space Marines units.
*   "Bolt Rifle" will be skipped for Intercessor Squads.
*   All wargear will be skipped for Aggressor Squads.

## Development

Prereqs: Node.js 20+ recommended.

Run the cross-format validator (quick end-to-end sanity checks):

```bash
npm run validate
```

Run the small test suite:

```bash
npm test
```

Optional lint (warnings-only, non-blocking):

```bash
npm run lint
```

## CLI Usage

You can use the compactor from the command line using `cli.mjs`. This is useful for integrating with Discord bots or other automation tools.

**Basic Usage:**
```bash
node cli.mjs -i path/to/list.txt
```

**Options:**
*   `-i, --input <file>`: Input file path (reads from stdin if not provided).
*   `-f, --format <format>`: Output format (`discordCompact`, `discordExtended`, `plainText`, `plainTextExtended`, `json`). Default: `discordCompact`.
*   `--show-subunits`: Show subunits in compact view.
*   `--combine-units`: Combine identical units.
*   `--multiline-header`: Use a multiline header.
*   `--no-bullets`: Disable bullet points.
*   `--hide-points`: Hide points costs.
*   `--color-mode <mode>`: Color mode (`none`, `faction`, `custom`). Default: `faction`.
*   `--color-unit <color>`: Custom color for units (e.g. `red`, `blue`).
*   `--color-header <color>`: Custom color for header.
*   `--color-subunit <color>`: Custom color for subunits.
*   `--color-wargear <color>`: Custom color for wargear.
*   `--color-points <color>`: Custom color for points.

**Allowed Colors:** `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `grey`.

**Example:**
```bash
node cli.mjs -i samples/GWAPP-Sample-Tau.txt --format discordCompact --show-subunits --combine-units --multiline-header --color-mode faction
```

## NPM Module Usage

You can use `40k-compactor` as a library in your own Node.js projects.

**Installation:**
```bash
npm install 40k-compactor
```

**Example:**
```javascript
import { detectFormat, parseGwAppV11, generateDiscordText, buildAbbreviationIndex } from '40k-compactor';
import fs from 'fs';

// Load your list
const listText = fs.readFileSync('mylist.txt', 'utf8');
const lines = listText.split('\n');

// Detect and Parse
const format = detectFormat(lines);
// Select parser based on format (simplified example)
const parsedData = parseGwAppV11(lines); 

// Build Abbreviations
const abbrIndex = buildAbbreviationIndex(parsedData);

// Load Configuration
const skippableWargear = JSON.parse(fs.readFileSync('./node_modules/40k-compactor/skippable_wargear.json', 'utf8'));

// Generate Output
const output = generateDiscordText(
    parsedData,
    false, // plain text? (false = discord formatted)
    true,  // use abbreviations?
    abbrIndex,
    false, // hide subunits?
    skippableWargear,
    true,  // combine identical units?
    { multilineHeader: true, colorMode: 'faction', forcePalette: true }
);

console.log(output);
```