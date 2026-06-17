import fs from 'fs';
import path from 'path';
import { parseWtc, parseWtcCompact } from '../modules/parsers.js';

const repoRoot = process.cwd();
const read = (p) => fs.readFileSync(path.resolve(repoRoot, p), 'utf8').split(/\r?\n/);

const wtcLines = read('WTCSample.txt');
const compactLines = read('WTCCompactSample.txt');

const a = parseWtc(wtcLines);
const b = parseWtcCompact(compactLines);

const outDir = path.resolve(repoRoot, 'test');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const safeStringify = (obj) => JSON.stringify(obj, (k, v) => (k === '_parent' ? undefined : v), 2);
fs.writeFileSync(path.resolve(outDir, 'wtc_parsed.json'), safeStringify(a));
fs.writeFileSync(path.resolve(outDir, 'wtccompact_parsed.json'), JSON.stringify(b, null, 2));

console.log('Wrote test/wtc_parsed.json and test/wtccompact_parsed.json');
