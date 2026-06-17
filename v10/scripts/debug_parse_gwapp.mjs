import fs from 'fs/promises';
import { parseGwApp } from '../modules/parsers.js';

async function main() {
  const txt = await fs.readFile(new URL('../samples/GWAPPSample.txt', import.meta.url), 'utf8');
  const lines = txt.split(/\r?\n/);
  const parsed = parseGwApp(lines);
  console.log('SUMMARY:', JSON.stringify(parsed.SUMMARY, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
