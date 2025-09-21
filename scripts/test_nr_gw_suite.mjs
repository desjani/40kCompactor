import fs from 'fs';
import assert from 'assert';
import { parseNrGw } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../samples/NRGWSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const parsed = parseNrGw(lines);
console.log('=== NR_GW parsed JSON (compact) ===');
console.log(JSON.stringify(parsed, null, 2));

// Basic assertions as a baseline
assert(Array.isArray(parsed.CHARACTER), 'CHARACTER section missing');
assert(parsed.CHARACTER.length >= 4, 'Expected at least 4 characters');

// Expect enhancement Starflare attached to one of the characters or present as special
const foundEnh = (parsed.CHARACTER.concat(parsed['OTHER DATASHEETS'] || [])).some(u => (u.items||[]).some(it => it && /Starflare Ignition System/i.test(it.name)));
assert(foundEnh, 'Expected Starflare Ignition System enhancement to be attached');

console.log('Baseline NR_GW suite checks passed.');
