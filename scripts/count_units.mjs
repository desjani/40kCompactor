import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
(async()=>{
  const txt = await fs.readFile(new URL('../samples/WTCCompactSample.txt', import.meta.url),'utf8');
  const parsed = parseWtcCompact(txt.split(/\r?\n/));
  console.log('CHARACTER', (parsed.CHARACTER||[]).length, 'OTHER DATASHEETS', (parsed['OTHER DATASHEETS']||[]).length);
})().catch(e=>{ console.error(e); process.exit(1); });
