import fs from 'fs/promises';
import { parseWtcCompact, parseGwAppV2 } from '../modules/parsers.js';

async function main(){
  const w = await fs.readFile('./WTCCompactSample.txt','utf8');
  const g = await fs.readFile('./GWAPPSample.txt','utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwAppV2(g.split(/\r?\n/));

  function findChar(list, name){
    return (list||[]).find(u=>u && u.name && u.name.toLowerCase().includes(name.toLowerCase()));
  }

  const name = 'khârn';
  console.log('\n=== Khârn WTC ===');
  console.log(JSON.stringify(findChar(pa.CHARACTER, name) || null, null, 2));
  console.log('\n=== Khârn GW ===');
  console.log(JSON.stringify(findChar(pb.CHARACTER, name) || null, null, 2));

  // Additionally list any nested wargear names for quick scan
  const kw = findChar(pa.CHARACTER, name);
  const kg = findChar(pb.CHARACTER, name);
  function listWargear(u){
    if (!u) return [];
    const out = [];
    for (const it of u.items||[]) {
      out.push({ name: it.name, type: it.type, quantity: it.quantity, inner: (it.items||[]).map(x=>({name:x.name,type:x.type,qty:x.quantity})) });
    }
    return out;
  }
  console.log('\nWTC wargear list:', JSON.stringify(listWargear(kw), null, 2));
  console.log('\nGW wargear list:', JSON.stringify(listWargear(kg), null, 2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
