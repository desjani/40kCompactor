import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateDiscordText, generateOutput } from '../modules/renderers.js';

const lines = [
  'Char2: 1x Captain in Gravis Armour (105 pts): Warlord, Master-crafted Heavy Bolt Rifle, Master-crafted Power Weapon',
  'Enhancement: Hunter\'s Instincts (+25 pts)'
];

const parsed = parseWtcCompact(lines);
console.log('\n=== PARSED DATA ===');
console.log(JSON.stringify(parsed, null, 2));

const abbrMap = buildAbbreviationIndex(parsed);
console.log('\n=== ABBREVIATION FLAT MAP (__flat_abbr) ===');
console.log(JSON.stringify(abbrMap.__flat_abbr, null, 2));

// Print nameshort fields for top-level units and their items
console.log('\n=== NAMESHORTS & ITEM LIST ===');
for (const section of ['CHARACTER','OTHER DATASHEETS']) {
  if (!Array.isArray(parsed[section])) continue;
  for (const u of parsed[section]) {
    console.log(`Unit: ${u.name} (${u.quantity}) nameshort=${u.nameshort}`);
    if (Array.isArray(u.items)) {
      for (const it of u.items) {
        console.log(`  - item: name='${it.name}' type='${it.type}' quantity='${it.quantity}' nameshort='${it.nameshort || ''}'`);
      }
    }
  }
}

console.log('\n=== RENDERED (Discord plain) ===');
console.log(generateDiscordText(parsed, true, true, abbrMap, false, {}));

console.log('\n=== RENDERED (HTML/plainText from generateOutput) ===');
console.log(JSON.stringify(generateOutput(parsed, true, abbrMap, false, {}), null, 2));
