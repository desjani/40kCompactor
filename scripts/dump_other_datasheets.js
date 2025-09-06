import fs from 'fs/promises';
import { parseWtcCompact, parseGwApp } from '../modules/parsers.js';

async function main(){
  const w = await fs.readFile('./WTCCompactSample.txt','utf8');
  const g = await fs.readFile('./GWAPPSample.txt','utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwApp(g.split(/\r?\n/));

  console.log('WTC OTHER DATASHEETS:');
  (pa['OTHER DATASHEETS']||[]).forEach(u => {
    console.log('-', u.name, u.quantity, JSON.stringify((u.items||[]).map(it=>({name:it.name, quantity: it.quantity}))))
  });

  console.log('\nGW OTHER DATASHEETS:');
  (pb['OTHER DATASHEETS']||[]).forEach(u => {
    console.log('-', u.name, u.quantity, JSON.stringify((u.items||[]).map(it=>({name:it.name, quantity: it.quantity}))))
  });
}

main().catch(e=>{ console.error(e); process.exit(1); });
