import fs from 'fs';
// Provide a minimal global.document for renderer imports during CLI tests
globalThis.document = globalThis.document || { querySelector: () => null, getElementById: () => null };
import { parseGwApp } from '../modules/parsers.js';
import { generateOutput } from '../modules/renderers.js';
const skippable = JSON.parse(fs.readFileSync(new URL('../skippable_wargear.json', import.meta.url)).toString());
const src = fs.readFileSync(new URL('../source.txt', import.meta.url)).toString();
const lines = src.split(/\r?\n/);
const parsed = parseGwApp(lines);
const out = generateOutput(parsed, false, {}, false, skippable);
console.log(out.plainText);
