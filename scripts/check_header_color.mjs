import fs from 'fs';
import { parseWtcCompact } from '../modules/parsers.js';
import { generateOutput } from '../modules/renderers.js';

const sample = fs.readFileSync(new URL('../WTCCompactSample.txt', import.meta.url), 'utf8');
const lines = sample.split('\n');
const parsed = parseWtcCompact(lines);
const ext = generateOutput(parsed, false, null, false, {}, false);
const comp = generateOutput(parsed, true, null, false, {}, true);
console.log('EXT HEADER HTML:\n', ext.html.split('\n').slice(0,5).join('\n'));
console.log('\nCOMP HEADER HTML:\n', comp.html.split('\n').slice(0,5).join('\n'));
