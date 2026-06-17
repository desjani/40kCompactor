import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseLf } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../samples/LFSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'LF', `Expected detectFormat -> LF but got ${fmt}`);

const parsed = parseLf(lines);

const battleline = parsed['OTHER DATASHEETS'] || [];
const bers = battleline.find(u=>/Khorne Berserkers/i.test(u.name));
assert(bers, 'Khorne Berserkers unit not found');

const subs = (bers.items||[]).filter(i=>i.type==='subunit');
const ks = subs.find(s=>/^Khorne Berserker$/i.test(s.name));
assert(ks, 'Aggregated Khorne Berserker subunit not found');
assert.strictEqual(ks.quantity, '9x', `Expected Khorne Berserker subunit 9x but got ${ks.quantity}`);

const w = Object.fromEntries((ks.items||[]).map(i=>[i.name.toLowerCase(), i.quantity]));
assert.strictEqual(w['berserker chainblade'], '7x', `Expected 7x Berserker chainblade but got ${w['berserker chainblade']}`);
assert.strictEqual(w['bolt pistol'], '7x', `Expected 7x Bolt pistol but got ${w['bolt pistol']}`);
assert.strictEqual(w['khornate eviscerator'], '2x', `Expected 2x Khornate eviscerator but got ${w['khornate eviscerator']}`);
assert.strictEqual(w['plasma pistol'], '2x', `Expected 2x Plasma pistol but got ${w['plasma pistol']}`);

console.log('LF subunit aggregation test passed.');
