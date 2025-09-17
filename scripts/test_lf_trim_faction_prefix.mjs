import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseLf } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../LFSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'LF', `Expected detectFormat -> LF but got ${fmt}`);

const parsed = parseLf(lines);

const beasts = parsed['OTHER DATASHEETS'] || [];
const spawn = beasts.find(u=>/Chaos Spawn$/i.test(u.name));
assert(spawn, 'Chaos Spawn unit not found or not trimmed');
assert(!/^World Eaters\s+/i.test(spawn.name), `Expected faction prefix trimmed, got '${spawn.name}'`);

console.log('LF trim faction prefix test passed.');
