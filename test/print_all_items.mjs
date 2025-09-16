import fs from 'fs';
import path from 'path';
import { parseWtc } from '../modules/parsers.js';

function readSample(name) {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    return txt.split(/\r?\n/);
}

const lines = readSample('WTCSample.txt');
if (!lines) { console.error('WTCSample.txt not found'); process.exit(2); }
const parsed = parseWtc(lines);
const all = [...(parsed.CHARACTER||[]), ...(parsed['OTHER DATASHEETS']||[])];
for (const u of all) {
    console.log(`UNIT: ${u.quantity} ${u.name}`);
    for (const it of (u.items||[])) console.log(`  - ${it.quantity} ${it.name}`);
    const subs = (u.items||[]).filter(x=>x && x.type==='subunit');
    for (const s of subs) {
        console.log(`  SUB: ${s.quantity} ${s.name}`);
        for (const it of (s.items||[])) console.log(`    * ${it.quantity} ${it.name}`);
    }
}
console.log('\n--- PARSE_DEBUG ---');
try {
    const dbg = (parsed.SUMMARY && parsed.SUMMARY._parseDebug) || [];
    for (const l of dbg) console.log(l);
} catch (e) { console.error('no parse debug'); }
process.exit(0);
