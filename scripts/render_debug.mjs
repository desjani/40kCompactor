import fs from 'fs';
import { parseGwAppV2 } from '../modules/parsers.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';

const txt = fs.readFileSync(new URL('../test.txt', import.meta.url), 'utf8');
const lines = txt.split(/\r?\n/);
const parsed = parseGwAppV2(lines);
console.log('=== PLAIN generateOutput ===');
const outPlain = generateOutput(parsed, true, null, false, {});
console.log(outPlain.plainText.slice(0, 1200));

console.log('\n=== PLAIN HTML (first 400 chars) ===');
console.log(outPlain.html.slice(0, 400));
