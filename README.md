# 40kCompactor

List compactor for Warhammer 40,000 lists to create Discord-friendly versions.

This tool supports the following formats:
*   Games Workshop App format
*   WTC-Compact format

## Features

*   **Multiple Format Support:** Paste your army list from the GW App or WTC-Compact format.
*   **Extended and Compact Views:** See your full list or a compacted version with abbreviations.
*   **Discord-Friendly Output:** Copy your list in various formats for easy pasting into Discord.
*   **Customizable Colors:** Choose your own colors for the Discord output.
*   **Smart Wargear Skipping:** Automatically hides default or redundant wargear for a cleaner compact view.

## How to Use

1.  Paste your army list into the input box.
2.  Click "Compact this list" to see the extended and compact versions.
3.  Use the "Copy" buttons to copy the list in your desired format.

## Customization

The compactor's behavior can be customized by editing the JSON files in the `v2` directory.

### `abbreviation_rules.json`

This file contains rules for shortening wargear names. You can add your own abbreviations to this file. The key is the full wargear name (in lowercase), and the value is the abbreviation.

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