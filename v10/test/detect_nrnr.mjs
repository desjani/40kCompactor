import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { detectFormat } from '../modules/parsers/detectors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.join(__dirname, '..', 'NRNRsample.txt');

async function run() {
  const txt = await fs.readFile(samplePath, 'utf8');
  const r = detectFormat(txt);
  console.log('Detector result:', r);
  if (r.format !== 'NRNR' || r.confidence < 0.6) {
    console.error('Detection failed or low confidence');
    process.exit(1);
  }
  console.log('Detection OK');
}

run().catch(e => { console.error(e); process.exit(2); });
