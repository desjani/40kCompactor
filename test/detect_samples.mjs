import fs from 'fs';
import path from 'path';
import { detectFormat } from '../modules/parsers/detectors.js';

function readSample(name) {
  const p = path.resolve(process.cwd(), name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split(/\r?\n/);
}

const wtc = readSample('WTCSample.txt');
const compact = readSample('WTCCompactSample.txt');

console.log('WTCSample.txt ->', detectFormat(wtc));
console.log('WTCCompactSample.txt ->', detectFormat(compact));
