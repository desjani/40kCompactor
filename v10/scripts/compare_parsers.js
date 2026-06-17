import fs from 'fs/promises';
import { parseWtcCompact, parseGwAppV2 } from '../modules/parsers.js';

async function main(){
  const w = await fs.readFile(new URL('../samples/WTCCompactSample.txt', import.meta.url),'utf8');
  const g = await fs.readFile(new URL('../samples/GWAPPSample.txt', import.meta.url),'utf8');
  const pa = parseWtcCompact(w.split(/\r?\n/));
  const pb = parseGwAppV2(g.split(/\r?\n/));

  console.log('CHARACTER counts -> WTC:', (pa.CHARACTER||[]).length, 'GW:', (pb.CHARACTER||[]).length);
  console.log('OTHER DATASHEETS -> WTC:', (pa['OTHER DATASHEETS']||[]).length, 'GW:', (pb['OTHER DATASHEETS']||[]).length);

  const diffs = [];

  // Helper: push comparison tasks but treat OTHER DATASHEETS specially by matching
  // entries by normalized name instead of by array index (order-insensitive).
  function enqueueCompare(a, b, path) {
    // If both are arrays, and they contain objects with 'name', match by normalized name
    if (Array.isArray(a) && Array.isArray(b)) {
      const hasNamedObjects = a.some(x => x && typeof x === 'object' && 'name' in x) && b.some(x => x && typeof x === 'object' && 'name' in x);
      if (hasNamedObjects) {
        const used = new Set();
        const normalize = s => (String(s||'')).toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
        for (let i = 0; i < a.length; i++) {
          const an = a[i];
          const aname = normalize(an && an.name);
          let foundIdx = -1;
          for (let j = 0; j < b.length; j++) {
            if (used.has(j)) continue;
            const bname = normalize(b[j] && b[j].name);
            if (aname && bname && aname === bname) { foundIdx = j; break; }
          }
          if (foundIdx === -1) {
            const bj = i < b.length ? i : -1;
            q.push({ a: an, b: bj === -1 ? undefined : b[bj], path: path + '[' + i + ']' });
            if (bj !== -1) used.add(bj);
          } else {
            q.push({ a: an, b: b[foundIdx], path: path + '[' + (an && an.name ? an.name : i) + ']' });
            used.add(foundIdx);
          }
        }
        for (let j = 0; j < b.length; j++) if (!used.has(j)) q.push({ a: undefined, b: b[j], path: path + '[UNMATCHED:' + (b[j] && b[j].name ? b[j].name : j) + ']' });
        return;
      }
    }

    q.push({ a, b, path });
  }

  const q = [];
  enqueueCompare(pa, pb, '');

  while(q.length && diffs.length<200){
    const {a,b,path} = q.shift();
    if (typeof a !== typeof b){ diffs.push(path+ ' type ' + typeof a + ' != ' + typeof b); continue; }
    if (typeof a !== 'object' || a === null){
      // Treat string comparisons as case-insensitive to ignore casing noise
      if (typeof a === 'string' && typeof b === 'string') {
        // Normalize casing and strip trailing parenthetical points like '(+20 pts)'
        const stripPoints = s => String(s||'').replace(/\s*\(\+?\d+\s*(pts?|points)\)\s*$/i, '').trim().toLowerCase();
        const sa = stripPoints(a);
        const sb = stripPoints(b);
        if (sa !== sb) diffs.push(path + ' : ' + String(a) + ' != ' + String(b));
      } else {
        if (a !== b) diffs.push(path + ' : ' + String(a) + ' != ' + String(b));
      }
      continue;
    }
    const keys = new Set([...Object.keys(a||{}), ...Object.keys(b||{})]);
    for(const k of keys){
      // Skip LIST_TITLE differences on purpose (semantic toleration)
      if (k === 'LIST_TITLE') continue;
      // If the key points to OTHER DATASHEETS arrays, handle specially
      if (k === 'OTHER DATASHEETS' && Array.isArray(a[k]) && Array.isArray(b[k])) {
        enqueueCompare(a[k], b[k], k);
        continue;
      }
      q.push({ a: a? a[k]: undefined, b: b? b[k]: undefined, path: path? path + '.' + k : k });
    }
  }

  console.log('diff count', diffs.length);
  console.log(diffs.slice(0,80).join('\n'));

  if (diffs.length > 0){
    console.log('\nWTC SUMMARY:\n', JSON.stringify(pa.SUMMARY||{}, null, 2));
    console.log('\nGW SUMMARY:\n', JSON.stringify(pb.SUMMARY||{}, null, 2));
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
