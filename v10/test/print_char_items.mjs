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
for (const c of (parsed.CHARACTER||[])) {
    console.log(`CHAR: ${c.name} (${c.charId || 'noid'})`);
    for (const it of (c.items||[])) console.log(`  - ${it.quantity} ${it.name}`);
}

process.exit(0);
