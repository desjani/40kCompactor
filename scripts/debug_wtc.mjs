import fs from 'fs';
import { parseWtcCompact } from '../modules/parsers.js';

const txt = fs.readFileSync(new URL('../samples/WTCCompactSample.txt', import.meta.url), 'utf8');
const lines = txt.split(/\r?\n/);
const res = parseWtcCompact(lines);
console.log(JSON.stringify(res.CHARACTER.concat(res['OTHER DATASHEETS']).flatMap(u => (u.items||[])).filter(i => i && i.type === 'special'), null, 2));
