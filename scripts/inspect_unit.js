import fs from 'fs/promises';
import { parseWtcCompact, parseGwApp } from '../modules/parsers.js';

async function show(name){
  const w = await fs.readFile('./WTCCompactSample.txt','utf8');
  const g = await fs.readFile('./GWAPPSample.txt','utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwApp(g.split(/\r?\n/));

  const normalize = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  console.log('--- WTC matches for', name);
  (pa['OTHER DATASHEETS']||[]).filter(u=> normalize(u.name).includes(normalize(name))).forEach(u=> console.log(JSON.stringify(u, null, 2)));
  console.log('\n--- GW matches for', name);
  (pb['OTHER DATASHEETS']||[]).filter(u=> normalize(u.name).includes(normalize(name))).forEach(u=> console.log(JSON.stringify(u, null, 2)));
}

const arg = process.argv[2] || 'Forgefiend';
show(arg).catch(e=>{ console.error(e); process.exit(1); });
