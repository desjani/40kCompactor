// Simple test runner for renderers in Node (ES module)
// Stubs minimal DOM globals required by ui.js
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, textContent: '' })
};
globalThis.AnsiUp = class { ansi_to_html(s){ return s; } };
globalThis.window = {};

// We'll dynamically import the renderers after stubbing globals so ui.js can run safely

function makeKhorneSample() {
    return {
        SUMMARY: { DISPLAY_FACTION: 'Legiones Astartes - Khorne', FACTION_KEYWORD: 'Khorne' },
        'OTHER DATASHEETS': [
            {
                quantity: '10x',
                name: 'Khorne Berzerkers',
                points: 200,
                items: [
                    // subunit with wargear
                    { quantity: '1x', name: 'Khorne Berzerker Champion', points: 15, items: [
                        { quantity: '1x', name: 'Bolt Pistol', type: 'wargear' },
                        { quantity: '1x', name: 'Chainaxe', type: 'wargear' }
                    ], type: 'subunit' },
                    // top-level wargear
                    { quantity: '10x', name: 'Khorne Pole', items: [], type: 'wargear' }
                ]
            }
        ]
    };
}

async function run() {
    // Dynamic import after global stubs
    const { generateDiscordText } = await import('../modules/renderers.js');

    const parsed = makeKhorneSample();
    // skippable map: nothing skipped for this faction/unit
    const skippable = { 'Khorne': { 'Khorne Berzerkers': [] } };
    const text = generateDiscordText(parsed, true, true, null, true, skippable);
    console.log('--- Render Output ---');
    console.log(text);
    // Accept either full names or abbreviations (BP, CH) depending on renderer abbreviation map
    if (!/(Bolt Pistol|Chainaxe|\bBP\b|\bCH\b)/.test(text)) {
        console.error('ERROR: expected inline wargear (Bolt Pistol / Chainaxe / BP / CH) not found');
        process.exitCode = 2;
    } else {
        console.log('OK: inline wargear found');
    }
}

run().catch(err => { console.error('Test failed', err); process.exitCode = 1; });
