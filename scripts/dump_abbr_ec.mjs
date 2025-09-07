import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';

async function run(){
  const txt = await fs.readFile('./WTCCompactSample.txt','utf8');
  const parsed = parseWtcCompact(txt.split(/\r?\n/));
  const abbr = buildAbbreviationIndex(parsed);
  const flat = abbr.__flat_abbr || {};
  const entries = Object.entries(flat).sort((a,b)=>a[0].localeCompare(b[0]));
  for (const [k,v] of entries) {
    if (typeof v==='string' && v.startsWith('EC')) console.log(k,'=>',v);
  }
}
run().catch(e=>{console.error(e);process.exit(1);});
