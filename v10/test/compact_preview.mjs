// Quick preview script: parse test.txt and print compact preview
// Stubs minimal DOM globals required by ui.js
// Stub minimal DOM + global dependencies before importing modules that reference them
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, textContent: '' })
};
globalThis.AnsiUp = class { ansi_to_html(s){ return s; } };
globalThis.window = {};

import fs from 'fs/promises';

async function run() {
    const { parseWtcCompact } = await import('../modules/parsers.js');
    const { generateDiscordText } = await import('../modules/renderers.js');

    const txt = await fs.readFile(new URL('../test.txt', import.meta.url));
    const lines = txt.split(/\r?\n/);
    const parsed = parseWtcCompact(lines);
    // load skippable map
    const skippable = JSON.parse(await fs.readFile(new URL('../skippable_wargear.json', import.meta.url)));
    const compact = generateDiscordText(parsed, true, true, null, true, skippable);
    console.log('--- Compact Preview ---');
    console.log(compact);
}

run().catch(err => { console.error(err); process.exitCode = 1; });
