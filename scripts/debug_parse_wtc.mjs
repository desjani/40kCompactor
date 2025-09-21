import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { parseWtcCompact } from '../modules/parsers.js';

async function main() {
  const arg = process.argv[2] || new URL('../samples/WTCCompactSample.txt', import.meta.url);
  const url = typeof arg === 'string' ? pathToFileURL(arg) : arg;
  const txt = await fs.readFile(url, 'utf8');
  const lines = txt.split(/\r?\n/);
  const res = parseWtcCompact(lines);
  console.log(JSON.stringify(res.SUMMARY, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
