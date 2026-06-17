import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseNrGw } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../samples/NRGWSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'NR_GW', `Expected detectFormat -> NR_GW but got ${fmt}`);

const parsed = parseNrGw(lines);
console.log('Parsed SUMMARY:', parsed.SUMMARY);
assert(parsed.SUMMARY, 'SUMMARY missing');
assert(parsed.SUMMARY.DISPLAY_FACTION && parsed.SUMMARY.DISPLAY_FACTION.includes("T'au Empire"), 'DISPLAY_FACTION mismatch');
assert(parsed.SUMMARY.TOTAL_ARMY_POINTS && parsed.SUMMARY.TOTAL_ARMY_POINTS.includes('2070'), 'TOTAL_ARMY_POINTS mismatch');

console.log('NR_GW detection and parse test passed.');
