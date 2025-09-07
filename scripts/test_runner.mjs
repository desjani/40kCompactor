import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex, makeAbbrevForName } from '../modules/abbreviations.js';
import { generateOutput } from '../modules/renderers.js';

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

async function runTests() {
  const txt = await fs.readFile('./WTCCompactSample.txt','utf8');
  const parsed = parseWtcCompact(txt.split(/\r?\n/));
  const abbr = buildAbbreviationIndex(parsed);

  console.log('Test: abbreviation for Ectoplasma Cannon should be EC');
  const flat = abbr.__flat_abbr || {};
  const ecto = flat['ectoplasma cannon'] || flat['Ectoplasma Cannon'.toLowerCase()];
  console.log('  got ->', ecto);
  assert(ecto === 'EC', `expected EC but got ${ecto}`);

  console.log('Test: makeAbbrevForName fallback produces EC for Ectoplasma Cannon');
  const fallback = makeAbbrevForName('Ectoplasma Cannon');
  console.log('  got ->', fallback);
  assert(fallback === 'EC', `expected EC but got ${fallback}`);

  console.log('Test: Full Text includes enhancement points and space before points');
  const full = generateOutput(parsed, false, abbr, false, {});
  const pt = full.plainText;
  console.log('--- Full Text snippet ---');
  console.log(pt.split('\n').slice(0,40).join('\n'));
  // Look for any occurrence of ' (+NN)' or '(+NN pts)' with a space before the parenthesis
  const ptMatches = pt.match(/\s\(\+[0-9]+(?:\s*pts)?\)/g);
  console.log('  found point parentheticals ->', ptMatches ? ptMatches.length : 0);
  assert(ptMatches && ptMatches.length >= 1, 'no enhancement points parenthetical found in full text');
  // ensure at least one has a space before the parenthesis (we matched with leading space)
  const spaced = ptMatches && ptMatches.every(m => m.startsWith(' '));
  assert(spaced, 'expected a space before the points parenthetical in full text');

  console.log('\nAll tests passed.');
}

runTests().catch(e=>{ console.error(e.message || e); process.exit(1); });
