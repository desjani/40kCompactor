import fs from 'fs/promises';
import { parseWtcCompact, parseGwAppV2 } from '../modules/parsers.js';

async function main(){
  const w = await fs.readFile('./WTCCompactSample.txt','utf8');
  const g = await fs.readFile('./GWAPPSample.txt','utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwAppV2(g.split(/\r?\n/));
  const names = ['Khorne Berzerkers','Eightbound','Jakhals','Chaos Spawn','Maulerfiend'];
  function findUnit(list, name){
    return (list||[]).find(u=>u && u.name && u.name.toLowerCase().includes(name.toLowerCase()));
  }
  for (const n of names){
    console.log('\n===', n, 'WTC ===');
    console.log(JSON.stringify(findUnit(pa['OTHER DATASHEETS'], n)||null, null, 2));
    console.log('===', n, 'GW ===');
    console.log(JSON.stringify(findUnit(pb['OTHER DATASHEETS'], n)||null, null, 2));
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
