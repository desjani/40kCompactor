import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseNrGw } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../samples/NRGWSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'NR_GW', `Expected detectFormat -> NR_GW but got ${fmt}`);

const parsed = parseNrGw(lines);

// One Slaughterbound should have the Berzerker Glaive enhancement, the other should not
const chars = parsed.CHARACTER || [];
const sb = chars.filter(u=>/Slaughterbound/i.test(u.name));
assert.strictEqual(sb.length, 2, `Expected 2 Slaughterbound but got ${sb.length}`);
const sbEnhCounts = sb.map(u => (u.items||[]).filter(i=>/Enhancement:\s*Berzerker Glaive/i.test(i.name)).length);
assert.deepStrictEqual(sbEnhCounts.sort(), [0,1], `Expected one Slaughterbound with Berzerker Glaive, counts=${sbEnhCounts}`);

// Daemon Prince of Khorne should have Favoured of Khorne enhancement
const dpk = chars.find(u=>/Daemon Prince of Khorne/i.test(u.name));
assert(dpk, 'Daemon Prince of Khorne not found');
const dpkEnh = (dpk.items||[]).some(i=>/Enhancement:\s*Favoured of Khorne/i.test(i.name));
assert(dpkEnh, 'Favoured of Khorne enhancement missing on Daemon Prince of Khorne');

// Jakhals' Icon of Khorne should be a single item with quantity 1x (no subunit multiplication)
const others = parsed['OTHER DATASHEETS'] || [];
const jakhals = others.find(u=>/Jakhals/i.test(u.name));
assert(jakhals, 'Jakhals unit not found');
const icon = ((jakhals.items||[]).flatMap(s=>s.items||[]).find(i=>/Icon of Khorne/i.test(i.name))) || (jakhals.items||[]).find(i=>/Icon of Khorne/i.test(i.name));
assert(icon, 'Icon of Khorne not found');
assert.strictEqual(icon.quantity, '1x', `Expected Icon of Khorne 1x but got ${icon.quantity}`);

console.log('NR-GW quantities and enhancements test passed.');
