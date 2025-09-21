import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseLf } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../samples/LFSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'LF', `Expected detectFormat -> LF but got ${fmt}`);

const parsed = parseLf(lines);

// Characters: one Slaughterbound should have Berzerker Glaive, the other not; DP has Favoured of Khorne
const chars = parsed.CHARACTER || [];
const sb = chars.filter(u=>/Slaughterbound/i.test(u.name));
assert.strictEqual(sb.length, 2, `Expected 2 Slaughterbound but got ${sb.length}`);
const sbEnhCounts = sb.map(u => (u.items||[]).filter(i=>/Enhancement:\s*Berzerker Glaive/i.test(i.name)).length);
assert.deepStrictEqual(sbEnhCounts.sort(), [0,1], `Expected one Slaughterbound with Berzerker Glaive, counts=${sbEnhCounts}`);

const dpk = chars.find(u=>/\bDaemon Prince\b/i.test(u.name));
assert(dpk, 'World Eaters Daemon Prince not found');
const dpkEnh = (dpk.items||[]).some(i=>/Enhancement:\s*Favoured of Khorne/i.test(i.name));
assert(dpkEnh, 'Favoured of Khorne enhancement missing on World Eaters Daemon Prince');

// Jakhals: ensure Icon of Khorne is present as a single 1x item at unit level and that Jakhal subunits sum to 8
const others = parsed['OTHER DATASHEETS'] || [];
const jakhals = others.find(u=>/Jakhals/i.test(u.name));
assert(jakhals, 'Jakhals unit not found');

const icon = (jakhals.items||[]).find(i=>/Icon of Khorne/i.test(i.name))
         || (jakhals.items||[]).flatMap(s=>s.items||[]).find(i=>/Icon of Khorne/i.test(i.name));
assert(icon, 'Icon of Khorne not found');
assert.strictEqual(icon.quantity, '1x', `Expected Icon of Khorne 1x but got ${icon.quantity}`);

const subJ = (jakhals.items||[]).filter(i=>i.type==='subunit' && /^Jakhal$/i.test(i.name));
const totalJ = subJ.reduce((acc,s)=> acc + (parseInt(s.quantity)||0), 0);
assert.strictEqual(totalJ, 8, `Expected total Jakhal models 8 but got ${totalJ}`);

console.log('LF detection and parse test passed.');
