import fs from 'fs';
import path from 'path';
import { detectFormat } from '../modules/parsers/detectors.js';

const samplePath = path.resolve(process.cwd(), 'WTCCompactSample.txt');
let sample;
try {
  sample = fs.readFileSync(samplePath, 'utf8');
} catch (e) {
  console.error('WTC sample not found at', samplePath);
  process.exit(2);
}

const res = detectFormat(sample);
console.log('Detector result for WTC sample:', res);

if (res.format !== 'WTC-Compact' || res.confidence < 0.4) {
  console.error('WTC detection failed');
  process.exit(1);
}

console.log('WTC detection OK');
process.exit(0);
