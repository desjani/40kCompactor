import fs from 'fs';
import path from 'path';
import { detectFormat } from '../modules/parsers/detectors.js';

const samples = [
  { file: 'WTCSample.txt', expect: 'WTC' },
  { file: 'WTCCompactSample.txt', expect: 'WTC-Compact' },
  { file: 'NRGWSample.txt', expect: 'NR-GW' },
  { file: 'NRNRsample.txt', expect: 'NRNR' },
  { file: 'GWAPPSample.txt', expect: 'GWAPP' },
  { file: 'GWAPPSample2.txt', expect: 'GWAPP' },
];

let ok = true;
for (const { file, expect } of samples) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) {
    console.warn('Missing sample:', file);
    continue;
  }
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const res = detectFormat(lines);
  console.log(`${file} ->`, res.format, `conf=${res.confidence}`);
  if (res.format !== expect) {
    console.error(`Expected ${expect} for ${file}, got ${res.format}`);
    ok = false;
  }
}

if (!ok) process.exit(2);
