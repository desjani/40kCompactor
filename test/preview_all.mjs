// Preview harness: produce permutations of outputs for a parsed list.
// Stubs minimal DOM + global dependencies before importing modules that reference them
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, textContent: '' })
};
globalThis.AnsiUp = class { ansi_to_html(s){ return s; } };
globalThis.window = {};

import fs from 'fs/promises';

async function loadParsed() {
    const { parseWtcCompact } = await import('../modules/parsers.js');
    const txt = await fs.readFile(new URL('../test.txt', import.meta.url), 'utf8');
    const lines = txt.split(/\r?\n/);
    return parseWtcCompact(lines);
}

async function loadSkippable() {
    return JSON.parse(await fs.readFile(new URL('../skippable_wargear.json', import.meta.url)));
}

function printDivider(title) {
    console.log('\n----- ' + title + ' -----\n');
}

async function run() {
    const parsed = await loadParsed();
    const skippable = await loadSkippable();

    // Filter parsed data to a single target unit for focused testing
    // Can be overridden by environment variable PREVIEW_TARGET_UNIT
    const TARGET_UNIT = process.env.PREVIEW_TARGET_UNIT || 'Khorne Berzerkers';
    function filterParsedByUnit(data, unitName) {
        if (!unitName) return data;
        const out = {};
        for (const k of Object.keys(data)) {
            if (k === 'SUMMARY') { out[k] = data[k]; continue; }
            if (!Array.isArray(data[k])) continue;
            const arr = data[k].filter(u => (u && u.name && u.name.toLowerCase() === unitName.toLowerCase()));
            if (arr.length > 0) out[k] = arr;
        }
        return out;
    }
    const parsedFiltered = filterParsedByUnit(parsed, TARGET_UNIT);

    // dynamic import of renderers after stubs
    const { generateDiscordText, generateOutput } = await import('../modules/renderers.js');
    // Load abbreviation DB so compact/abbr outputs use the wargear JSON and NULL rules
    let wargearDB = null;
    try {
        const { loadAbbreviationRules } = await import('../modules/abbreviations.js');
        wargearDB = await loadAbbreviationRules();
    } catch (e) {
        // fallback: leave wargearDB null and render without DB-driven abbreviations
        wargearDB = null;
    }

    // We'll toggle this function used by generateDiscordText: getMultilineHeaderState from ui.js
    // Some modules import it directly; we can override the exported function by creating a small shim module
    // However easiest is to set a global that ui.js reads if implemented; if not, we set a fake in module cache.
    // For now, rely on generateDiscordText's own behavior; but we'll simulate multiline header by
    // temporarily modifying the ui module's exported function if possible.
    try {
        const ui = await import('../modules/ui.js');
        if (ui && typeof ui.setMultilineHeaderState === 'function') {
            // nothing
        }
    } catch (e) {
        // ignore
    }

    const permutations = [];
    const hideSubunitsOptions = [false, true];
    const multilineOptions = [false, true];
    const coloringOptions = [false, true]; // coloring affects HTML vs plain text/ANSI conversion

    for (const hideSubunits of hideSubunitsOptions) {
        for (const multiline of multilineOptions) {
            for (const coloring of coloringOptions) {
                // Discord compact (useAbbreviations = true)
                permutations.push({ mode: 'Discord Compact', useAbbr: true, plain: false, hideSubunits, multiline, coloring });
                permutations.push({ mode: 'Discord Compact (plain)', useAbbr: true, plain: true, hideSubunits, multiline, coloring });
                // Discord extended (useAbbreviations = false)
                permutations.push({ mode: 'Discord Extended', useAbbr: false, plain: false, hideSubunits, multiline, coloring });
                permutations.push({ mode: 'Discord Extended (plain)', useAbbr: false, plain: true, hideSubunits, multiline, coloring });
                // Plain Text compact/extended via generateOutput
                permutations.push({ mode: 'Plain Compact', useAbbr: true, plain: true, hideSubunits, multiline, coloring });
                permutations.push({ mode: 'Plain Extended', useAbbr: false, plain: true, hideSubunits, multiline, coloring });
            }
        }
    }

    // Deduplicate by stringified key to avoid many repeats
    const seen = new Set();
    for (const p of permutations) {
        const key = `${p.mode}|abbr:${p.useAbbr}|hide:${p.hideSubunits}|ml:${p.multiline}|col:${p.coloring}|plain:${p.plain}`;
        if (seen.has(key)) continue;
        seen.add(key);

        printDivider(key);

        // Try to set multiline header state if module supports it
        try {
            const uiModule = await import('../modules/ui.js');
            if (typeof uiModule.setMultilineHeaderState === 'function') {
                uiModule.setMultilineHeaderState(p.multiline);
            }
        } catch (e) {
            // ignore
        }

        if (p.mode.startsWith('Discord')) {
            // generateDiscordText(data, plain, useAbbreviations = true, wargearAbbrMap, hideSubunits, skippableWargearMap)
            const text = generateDiscordText(parsedFiltered, p.plain, p.useAbbr, wargearDB, p.hideSubunits, skippable);
            if (p.coloring && !p.plain) {
                // Convert ANSI to HTML via AnsiUp stub (which returns input for now)
                console.log(text);
            } else {
                console.log(text);
            }
        } else {
            // generateOutput(data, useAbbreviations, wargearAbbrMap, hideSubunits, skippableWargearMap)
            const { html, plainText } = generateOutput(parsedFiltered, p.useAbbr, wargearDB, p.hideSubunits, skippable);
            if (p.mode.includes('Compact')) {
                console.log(plainText);
            } else {
                // Extended plain
                console.log(plainText);
            }
        }
    }

    printDivider('END');
}

run().catch(err => { console.error('Preview failed', err); process.exitCode = 1; });
