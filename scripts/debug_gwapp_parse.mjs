import fs from 'fs';
import { parseGwAppV2 } from '../modules/parsers.js';

const txt = fs.readFileSync(new URL('../test.txt', import.meta.url), 'utf8');
const lines = txt.split(/\r?\n/);
const parsed = parseGwAppV2(lines);
console.log('\n=== TOP-LEVEL SECTIONS ===');
console.log(Object.keys(parsed));
console.log('\n=== OTHER DATASHEETS (excerpt around Crisis Sunforge Battlesuits) ===');
const others = parsed['OTHER DATASHEETS'] || [];
others.forEach((ud, idx) => {
  if (ud.name && ud.name.toLowerCase().includes('sunforge')) {
    console.log('\n--- UNIT INDEX: ' + idx + ' ---');
    console.log(JSON.stringify(ud, null, 2));
  }
});

console.log('\n=== RAW COUNT OF OTHER DATASHEETS: ' + others.length + ' ===');

// Print first few units names for quick inspection
console.log('\n=== FIRST 20 OTHER DATASHEETS NAMES ===');
others.slice(0,20).forEach((u,i)=>console.log(i, u.quantity, u.name, 'type=', u.type, 'isComplex=', u.isComplex));
