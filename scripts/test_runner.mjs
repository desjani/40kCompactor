import fs from 'fs/promises';
import { parseWtcCompact, parseGwApp, parseWtc, parseNrGw, parseNrNr, parseLf } from '../modules/parsers.js';
import { buildAbbreviationIndex, makeAbbrevForName } from '../modules/abbreviations.js';
import { generateOutput } from '../modules/renderers.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

async function runTests() {
  // Helper to pick a few wargear names from parsed nodes
  function findWargearNames(nodes, max = 3) {
    const names = [];
    const stack = Array.isArray(nodes) ? [...nodes] : [nodes];
    while (stack.length && names.length < max) {
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
          if (nm && key !== 'warlord') names.push(nm);
          if (names.length >= max) break;
        }
      }
    }
    return names;
  }

  const cases = [
    { name: 'WTC-Compact', file: '../samples/WTCCompactSample.txt', parse: parseWtcCompact, checkEnhancementSpacing: true },
    { name: 'WTC',         file: '../samples/WTCSample.txt',        parse: parseWtc },
    { name: 'GW_APP',      file: '../samples/GWAPPSample.txt',      parse: parseGwApp },
    { name: 'NR_GW',       file: '../samples/NRGWSample.txt',       parse: parseNrGw },
    { name: 'NRNR',        file: '../samples/NRNRsample.txt',       parse: parseNrNr },
    { name: 'LF',          file: '../samples/LFSample.txt',         parse: parseLf },
  ];

  for (const c of cases) {
    const txt = await fs.readFile(new URL(c.file, import.meta.url), 'utf8');
    const parsed = c.parse(txt.split(/\r?\n/));
    const abbr = buildAbbreviationIndex(parsed);
    const flat = abbr.__flat_abbr || {};

    console.log(`Test: ${c.name} dynamic wargear abbreviation aligns with generator`);
    const picks = findWargearNames([parsed.CHARACTER, parsed['OTHER DATASHEETS']], 3);
    // If no wargear found (edge sample), skip gracefully
    if (picks.length === 0) {
      console.log('  no wargear found in sample; skipping abbreviation checks');
    } else {
      for (const candidate of picks) {
        const expectedAbbr = makeAbbrevForName(candidate);
        const actualAbbr = flat[candidate.toLowerCase()];
        console.log(`  '${candidate}' -> expected startsWith ${expectedAbbr}, actual=${actualAbbr}`);
        assert(typeof actualAbbr === 'string' && actualAbbr.length >= 2, `abbreviation missing for '${candidate}'`);
        assert(actualAbbr.startsWith(expectedAbbr), `abbrev mismatch for '${candidate}': expected startsWith ${expectedAbbr} but got ${actualAbbr}`);
      }
    }

    // Enhancement spacing test only where applicable
    if (c.checkEnhancementSpacing) {
      console.log('Test: Full Text includes enhancement points and space before points');
      const full = generateOutput(parsed, false, abbr, false, {});
      const pt = full.plainText;
      console.log('--- Full Text snippet ---');
      console.log(pt.split('\n').slice(0,40).join('\n'));
      const ptMatches = pt.match(/\s\(\+[0-9]+(?:\s*pts)?\)/g);
      console.log('  found point parentheticals ->', ptMatches ? ptMatches.length : 0);
      assert(ptMatches && ptMatches.length >= 1, 'no enhancement points parenthetical found in full text');
      const spaced = ptMatches && ptMatches.every(m => m.startsWith(' '));
      assert(spaced, 'expected a space before the points parenthetical in full text');
    }
  }

  // Pick a wargear item that exists in the parsed data and won't be hidden by parser rules,
  // then ensure its generated abbreviation matches the dynamic abbreviation index entry.
  console.log('Test: makeAbbrevForName fallback produces EC for Ectoplasma Cannon');
  const fallback = makeAbbrevForName('Ectoplasma Cannon');
  console.log('  got ->', fallback);
  assert(fallback === 'EC', `expected EC but got ${fallback}`);

  // Targeted regression test for grouped abbreviation collisions (e.g., Hand/Heavy Flamer -> HaFl/HeFl)
  console.log('Test: grouped collision expansion for Hand/Heavy Flamer');
  const gwTxt = await fs.readFile(new URL('../samples/GWAPPSample2.txt', import.meta.url), 'utf8');
  const gwParsed = parseGwApp(gwTxt.split(/\r?\n/));
  const gwAbbr = buildAbbreviationIndex(gwParsed);
  const flat2 = gwAbbr.__flat_abbr || {};
  const hf1 = flat2['hand flamer'];
  const hf2 = flat2['heavy flamer'];
  console.log(`  Hand flamer -> ${hf1}, Heavy flamer -> ${hf2}`);
  assert(hf1 === 'HaFl', `expected Hand flamer => HaFl but got ${hf1}`);
  assert(hf2 === 'HeFl', `expected Heavy flamer => HeFl but got ${hf2}`);

  // Synthetic multi-way conflict test: Heavy/Heavier/Heaviest Flamer
  console.log('Test: multi-way iterative expansion resolves 3-way conflicts');
  const synthParsed = {
    CHARACTER: [
      { name: 'Synthetic Unit', items: [
        { type: 'wargear', name: 'Heavy Flamer' },
        { type: 'wargear', name: 'Heavier Flamer' },
        { type: 'wargear', name: 'Heaviest Flamer' },
      ] }
    ],
    'OTHER DATASHEETS': []
  };
  const synthAbbr = buildAbbreviationIndex(synthParsed);
  const sflat = synthAbbr.__flat_abbr || {};
  const a = sflat['heavy flamer'];
  const b = sflat['heavier flamer'];
  const c = sflat['heaviest flamer'];
  console.log(`  Heavy=${a}, Heavier=${b}, Heaviest=${c}`);
  assert(!!a && !!b && !!c, 'expected abbreviations for all three');
  assert(a === 'HeavyFlame', `expected Heavy => HeavyFlame but got ${a}`);
  assert(b === 'HeavierFlamer', `expected Heavier => HeavierFlamer but got ${b}`);
  assert(c === 'HeaviesFlamer', `expected Heaviest => HeaviesFlamer but got ${c}`);

  console.log('\nAll tests passed.');
}

runTests().catch(e=>{ console.error(e.message || e); process.exit(1); });

function run(urlOrPath) {
  const p = typeof urlOrPath === 'string' ? urlOrPath : fileURLToPath(urlOrPath);
  const r = spawnSync(process.execPath, [p], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(new URL('./test_toggle_and_discord.mjs', import.meta.url));
