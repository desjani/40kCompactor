// Run a single, focused preview: Discord compact, no color, show subunits, single-line header
import fs from 'fs/promises';

globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, textContent: '' }),
    querySelector: () => null
};
globalThis.AnsiUp = class { ansi_to_html(s){ return s; } };

async function run() {
    const { parseWtcCompact } = await import('../modules/parsers.js');
    const { generateDiscordText } = await import('../modules/renderers.js');
    const { buildAbbreviationIndex } = await import('../modules/abbreviations.js');
    const ui = await import('../modules/ui.js');

    const txt = await fs.readFile(new URL('../test.txt', import.meta.url), 'utf8');
    const lines = txt.split(/\r?\n/);
    const parsed = parseWtcCompact(lines);
    const skippable = JSON.parse(await fs.readFile(new URL('../skippable_wargear.json', import.meta.url), 'utf8'));

    // Build dynamic abbreviation index from parsed data
    const wargearDB = buildAbbreviationIndex(parsed);

    // Enforce single-line header
    if (ui && typeof ui.setMultilineHeaderState === 'function') ui.setMultilineHeaderState(false);

    // Mode: Discord compact, plain (no color), useAbbreviations true, show subunits (hideSubunits=false)
    const out = generateDiscordText(parsed, true, true, wargearDB, false, skippable);
    console.log(out);
}

run().catch(e => { console.error(e); process.exitCode = 1; });
