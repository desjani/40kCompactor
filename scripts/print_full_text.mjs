import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';

async function run(){
  const txt = await fs.readFile('./WTCCompactSample.txt','utf8');
  const parsed = parseWtcCompact(txt.split(/\r?\n/));
  const abbr = buildAbbreviationIndex(parsed);
  const skippable = {};

  console.log('--- Full Text (useAbbreviations = false) ---');
  const full = generateOutput(parsed, false, abbr, false, skippable);
  console.log(full.plainText);

  console.log('\n--- Compact Text (useAbbreviations = true) ---\n');
  const compact = generateOutput(parsed, true, abbr, false, skippable);
  console.log(compact.plainText);
}

run().catch(e=>{ console.error(e); process.exit(1); });
