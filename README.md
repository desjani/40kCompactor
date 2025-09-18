# 40kCompactor

List compactor for Warhammer 40,000 lists to create Discord-friendly versions.

This tool supports the following formats:
* Games Workshop App (GW App)
* New Recruit: WTC-Compact
* New Recruit: WTC
* New Recruit: GW/NR (aka NR-GW)
* NRNR (markdown-style variant)
* ListForge (Detailed)

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

- `wargear.json`: dynamic wargear database used for optional abbreviations.
- `skippable_wargear.json`: per-faction rules for hiding default/redundant wargear in the compact output.
- `abbreviation_rules.json`: supplemental rules to steer abbreviation generation (when needed).

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

```powershell
pwsh -NoProfile -Command "npm run validate"
```

Run the small test suite:

```powershell
pwsh -NoProfile -Command "npm test"
```

Optional lint (warnings-only, non-blocking):

```powershell
pwsh -NoProfile -Command "npm run lint"
```