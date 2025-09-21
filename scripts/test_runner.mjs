import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex, makeAbbrevForName } from '../modules/abbreviations.js';
import { generateOutput } from '../modules/renderers.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

async function runTests() {
  const txt = await fs.readFile(new URL('../samples/WTCCompactSample.txt', import.meta.url), 'utf8');
  const parsed = parseWtcCompact(txt.split(/\r?\n/));
  const abbr = buildAbbreviationIndex(parsed);

  // Pick a wargear item that exists in the parsed data and won't be hidden by parser rules,
  // then ensure its generated abbreviation matches the dynamic abbreviation index entry.
  console.log('Test: dynamic wargear abbreviation aligns with generator');
  const flat = abbr.__flat_abbr || {};
  function findFirstWargear(nodes) {
    const stack = Array.isArray(nodes) ? [...nodes] : [nodes];
    while (stack.length) {
      const n = stack.shift();
      if (!n) continue;
      if (Array.isArray(n)) { stack.push(...n); continue; }
      if (n.items && Array.isArray(n.items)) {
        for (const it of n.items) {
          if (!it) continue;
          if (it.type === 'subunit' && Array.isArray(it.items)) stack.push(it);
          if (it.type !== 'wargear') continue;
          const nm = String(it.name || '').trim();
          const key = nm.toLowerCase();
          if (nm && key !== 'warlord' && flat[key]) {
            return nm;
          }
        }
      }
    }
    return null;
  }
  const candidate = findFirstWargear([parsed.CHARACTER, parsed['OTHER DATASHEETS']]);
  assert(candidate, 'no suitable wargear candidate found for abbreviation test');
  const expectedAbbr = makeAbbrevForName(candidate);
  const actualAbbr = flat[candidate.toLowerCase()];
  console.log(`  picked wargear -> '${candidate}', expected=${expectedAbbr}, actual=${actualAbbr}`);
  assert(typeof actualAbbr === 'string' && actualAbbr.length >= 2, 'abbreviation should be present and non-trivial');
  // They should generally match; allow case where collision resolution extends the base token
  assert(actualAbbr.startsWith(expectedAbbr), `abbrev mismatch for '${candidate}': expected startsWith ${expectedAbbr} but got ${actualAbbr}`);

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

function run(urlOrPath) {
  const p = typeof urlOrPath === 'string' ? urlOrPath : fileURLToPath(urlOrPath);
  const r = spawnSync(process.execPath, [p], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(new URL('./test_toggle_and_discord.mjs', import.meta.url));
