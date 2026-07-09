import fs from 'fs/promises';
import { parseWtcCompact, parseGwApp } from '../modules/parsers.js';

function norm(s){ return (s||'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/["'()]/g,'').trim(); }

async function main(){
  const w = await fs.readFile(new URL('../samples/WTCCompactSample.txt', import.meta.url),'utf8');
  const g = await fs.readFile(new URL('../samples/GWAPPSample.txt', import.meta.url),'utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwApp(g.split(/\r?\n/));

  const sections = ['CHARACTER','OTHER DATASHEETS'];
  for (const sec of sections){
    const A = pa[sec]||[];
    const B = pb[sec]||[];
    console.log('---',sec,'---');
    console.log('WTC order:');
    A.forEach((u,i)=> console.log(i, '|', u.name));
    console.log('\nGW order:');
    B.forEach((u,i)=> console.log(i, '|', u.name));

    // build index of B
    const bIndex = new Map();
    B.forEach((u,i)=> bIndex.set(norm(u.name), i));

    console.log('\nMismatches (WTC index -> GW index for same name):');
    let outOfOrder = [];
    A.forEach((u,i)=>{
      const key = norm(u.name);
      const gi = bIndex.has(key) ? bIndex.get(key) : -1;
      if (gi === -1) {
        outOfOrder.push({ wIndex:i, wName:u.name, reason:'not found in GW'});
      } else if (gi !== i) {
        outOfOrder.push({ wIndex:i, wName:u.name, gwIndex:gi, gwName: B[gi] ? B[gi].name : undefined });
      }
    });
    if (outOfOrder.length===0) console.log('No order mismatches found.');
    else {
      outOfOrder.forEach(o=>{
        if (o.reason) console.log(`${o.wIndex} -> ? : ${o.wName} (${o.reason})`);
        else console.log(`${o.wIndex} -> ${o.gwIndex} : ${o.wName}  |  GW entry at ${o.gwIndex} = ${o.gwName}`);
      });
    }
    console.log('\n');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
