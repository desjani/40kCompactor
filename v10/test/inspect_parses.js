const fs = require('fs');
const path = require('path');
const { parseWtc, parseWtcCompact } = require('../modules/parsers.js');
function readSample(name){const p=path.resolve(process.cwd(),name);return fs.existsSync(p)?fs.readFileSync(p,'utf8').split(/\r?\n/):null}
function normKey(n){return String(n||'').toLowerCase().replace(/^\d+x\s*/i,'').replace(/[^a-z0-9 ]/g,'').trim()}
const wtcLines = readSample('WTCSample.txt'); const wtcCompactLines = readSample('WTCCompactSample.txt'); if(!wtcLines||!wtcCompactLines){console.error('samples missing');process.exit(2)}
const wtc = parseWtc(wtcLines); const compact = parseWtcCompact(wtcCompactLines);
function groupMap(root,name){return (root['OTHER DATASHEETS']||[]).filter(u=>u&&u.name&&u.name.toLowerCase().includes(name))}
const groups = ['crisis sunforge battlesuits','crisis fireknife battlesuits','crisis starscythe battlesuits','stealth battlesuits'];
for(const gname of groups){
  console.log('\n=== GROUP:',gname,'===');
  const A=groupMap(wtc,gname); const B=groupMap(compact,gname);
  for(let idx=0; idx<Math.max(A.length,B.length); idx++){
    const a=A[idx]; const b=B[idx];
    console.log('\n-- PARSED group',idx,'qty',a? a.quantity:'-');
    if(a) a.items.forEach(s=>{ const m={}; (s.items||[]).forEach(it=>{const k=normKey(it.name); m[k]=(m[k]||0)+(parseInt(String(it.quantity||'1x').replace(/[^0-9]/g,''),10)||1)}); console.log(' sub',s.name,'qty',s.quantity, m)});
    console.log('\n-- COMPACT group',idx,'qty',b? b.quantity:'-');
    if(b) b.items.forEach(s=>{ const m={}; (s.items||[]).forEach(it=>{const k=normKey(it.name); m[k]=(m[k]||0)+(parseInt(String(it.quantity||'1x').replace(/[^0-9]/g,''),10)||1)}); console.log(' sub',s.name,'qty',s.quantity, m)});
  }
}
