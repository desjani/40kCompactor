const r = require('./wtc_parsed.json');
const c = require('./wtccompact_parsed.json');
const groups = (root, name) => (root['OTHER DATASHEETS'] || []).filter(u => u && u.name && u.name.toLowerCase().includes(name));
const names = ['crisis fireknife battlesuits','crisis starscythe battlesuits','crisis sunforge battlesuits','stealth battlesuits'];
const diffs = {};
function normKey(n){ return n.replace(/^\d+x\s*/i,'').toLowerCase(); }
names.forEach(name => {
  const A = groups(r, name);
  const B = groups(c, name);
  const max = Math.max(A.length, B.length);
  for(let i=0;i<max;i++){
    const a = A[i] || {items:[]};
    const b = B[i] || {items:[]};
    const amap = {};
    (a.items||[]).forEach(s => { (s.items||[]).forEach(it => { amap[normKey(it.name)] = (amap[normKey(it.name)]||0) + (parseInt(it.quantity) || 1); }); });
    const bmap = {};
    (b.items||[]).forEach(s => { (s.items||[]).forEach(it => { bmap[normKey(it.name)] = (bmap[normKey(it.name)]||0) + (parseInt((it.quantity||'1').toString().replace(/x$/i,'')) || 1); }); });
    Object.keys(Object.assign({}, amap, bmap)).forEach(k => { const aV = amap[k] || 0; const bV = bmap[k] || 0; if(aV !== bV){ const key = `${name}|${i}|${k}`; diffs[key] = (diffs[key]||0) + Math.abs(aV-bV); } });
  }
});
const arr = Object.entries(diffs).sort((a,b)=>b[1]-a[1]);
if(arr.length===0){
  console.log('No diffs found');
} else {
  arr.slice(0,50).forEach(([k,v])=> console.log(k+' => '+v));
}
