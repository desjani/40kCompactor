import fs from 'fs';
import path from 'path';
import { detectFormat } from '../modules/parsers/detectors.js';

const sample = path.resolve(process.cwd(), 'NRGWSample.txt');
if (!fs.existsSync(sample)) {
  console.error('NRGWSample.txt not found');
  process.exit(1);
}
const lines = fs.readFileSync(sample, 'utf8').split(/\r?\n/);
const res = detectFormat(lines);
console.log('NRGWSample.txt ->', res);
if (res.format !== 'NR-GW') {
  console.error('Expected NR-GW, got', res.format);
  process.exit(2);
}
