import fs from 'fs';
import { parseNrGw } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../NRGWSample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const result = parseNrGw(lines);
console.log(JSON.stringify(result, null, 2));
