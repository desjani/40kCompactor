import fs from 'fs';
import { parseGwApp } from '../modules/parsers.js';
import path from 'path';

const filePath = process.argv[2] ? path.resolve(process.argv[2]) : new URL('../samples/GWAPPSample.txt', import.meta.url);
const txt = fs.readFileSync(filePath, 'utf8');
const lines = txt.split(/\r?\n/);
const parsed = parseGwApp(lines);
console.log('\n=== TOP-LEVEL SECTIONS ===');
console.log(Object.keys(parsed));
console.log('\n=== OTHER DATASHEETS (excerpt around Crisis Sunforge Battlesuits) ===');
const others = parsed['OTHER DATASHEETS'] || [];
others.forEach((ud, idx) => {
    console.log(`\n--- UNIT INDEX: ${idx} ---`);
    console.log(`Name: ${ud.name}, Quantity: ${ud.quantity}, isComplex: ${ud.isComplex}`);
    console.log('Items:');
    ud.items.forEach(it => {
        console.log(`  - [${it.type}] ${it.quantity} ${it.name}`);
        if (it.items && it.items.length > 0) {
            it.items.forEach(sub => {
                console.log(`    - [${sub.type}] ${sub.quantity} ${sub.name}`);
            });
        }
    });
});

console.log('\n=== RAW COUNT OF OTHER DATASHEETS: ' + others.length + ' ===');

console.log('\n=== FIRST 20 OTHER DATASHEETS NAMES ===');
others.slice(0,20).forEach((u,i)=>console.log(i, u.quantity, u.name, 'type=', u.type, 'isComplex=', u.isComplex));
