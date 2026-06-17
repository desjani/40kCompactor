// Test: items marked with abbr:'NULL' in the wargear DB must be hidden in compact output
import assert from 'assert/strict';

// Minimal DOM stubs used by renderers/ui imports
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, querySelector: () => null };
// ui.js expects AnsiUp; provide a tiny stub so imports succeed in Node tests
global.AnsiUp = class { toHtml(s){ return s; } }; 

const { generateOutput, generateDiscordText } = await import('../modules/renderers.js');

const testData = {
  SUMMARY: { DISPLAY_FACTION: 'Test Faction' },
  "OTHER DATASHEETS": [
    {
      quantity: '1x', name: 'Test Squad', points: 100, items: [
        { quantity: '1x', name: 'Hidden Item', nameshort: 'HID', type: 'wargear' },
        { quantity: '1x', name: 'Visible Item', nameshort: 'VIS', type: 'wargear' }
      ]
    }
  ]
};

// DB marks 'Hidden Item' as NULL and 'Visible Item' as 'V'
const wargearDb = {
  'hidden item': 'NULL',
  'visible item': 'V'
};

const out = generateOutput(testData, true, wargearDb, false, {});
console.log(out.plainText);
assert(out.plainText.includes('Visible Item') || out.plainText.includes('V'), 'Expected visible item present');
assert(!out.plainText.includes('Hidden Item') && !out.plainText.includes('HID'), 'Hidden item should not appear in compact output');
console.log('OK: NULL abbreviation hides the item');
