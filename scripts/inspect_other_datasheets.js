import fs from 'fs/promises';
import { parseWtcCompact, parseGwApp } from '../modules/parsers.js';

function short(o){
  return JSON.stringify(o, (k,v)=>{
    if (k==='items') return Array.isArray(v) ? v.map(it=>({name:it.name,quantity:it.quantity,type:it.type,items: Array.isArray(it.items)? it.items.map(x=>x.name):undefined,nameshort:it.nameshort||''})) : v;
    return v;
  },2);
}

async function main(){
  const w = await fs.readFile(new URL('../samples/WTCCompactSample.txt', import.meta.url),'utf8');
  const g = await fs.readFile(new URL('../samples/GWAPPSample.txt', import.meta.url),'utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwApp(g.split(/\r?\n/));
  const A = pa['OTHER DATASHEETS']||[];
  const B = pb['OTHER DATASHEETS']||[];
  console.log('WTC OTHER DATASHEETS count', A.length);
  console.log('GW  OTHER DATASHEETS count', B.length);
  for (let i=0;i<Math.max(A.length,B.length);i++){
    console.log('\n=== INDEX',i,'===');
    console.log('WTC:');
    if (A[i]) console.log(short(A[i])); else console.log(' <missing>');
    console.log('\nGW:');
    if (B[i]) console.log(short(B[i])); else console.log(' <missing>');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
