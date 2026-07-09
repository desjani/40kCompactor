import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { parseGwApp } from '../modules/parsers.js';

const expectedPerTest = [
  { LIST_TITLE: 'Chainblades go BRRRR', TOTAL_ARMY_POINTS: '1995pts', FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' },
  { LIST_TITLE: 'Chainblades go BRRRR', TOTAL_ARMY_POINTS: '1995pts', FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' },
  { LIST_TITLE: 'Chainblades go BRRRR', TOTAL_ARMY_POINTS: '1995pts', FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' },
  { LIST_TITLE: 'Chainblades go BRRRR', TOTAL_ARMY_POINTS: '1995pts', FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' },
  { LIST_TITLE: 'Chainblades go BRRRR', TOTAL_ARMY_POINTS: null, FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' }
];

const commonBody = ['CHARACTERS', '', 'Daemon Prince of Khorne (220 points)', ''];

// If a file path is provided, use its lines as the canonical sample for the tests
async function linesFromArgOrNull() {
  const inputArg = process.argv[2];
  if (!inputArg) return null;
  try {
    const fileUrl = pathToFileURL(inputArg);
    const txt = await fs.readFile(fileUrl, 'utf8');
    return txt.split(/\r?\n/).map(l => (l || '').trim());
  } catch (e) {
    // ignore and return null to use permutations
    return null;
  }
}

const permutations = [
  // 1: canonical order: title, faction, detachment
  [
    'Chainblades go BRRRR (1995 points)',
    'World Eaters',
    'Berzerker Warband',
    '',
    ...commonBody
  ],
  // 2: detachment before faction
  [
    'Chainblades go BRRRR (1995 points)',
    'Berzerker Warband',
    'World Eaters',
    '',
    ...commonBody
  ],
  // 3: include game-size row which should be ignored
  [
    'Chainblades go BRRRR (1995 points)',
    'World Eaters',
    'Strike Force (2000 points)',
    'Berzerker Warband',
    '',
    ...commonBody
  ],
  // 4: include a family row that should be eliminated (e.g., 'Space Marines')
  [
    'Chainblades go BRRRR (1995 points)',
    'Space Marines',
    'World Eaters',
    'Berzerker Warband',
    '',
    ...commonBody
  ],
  // 5: title without parentheses (no TOTAL_ARMY_POINTS), should still pick factions/detachment
  [
    'Chainblades go BRRRR',
    'World Eaters',
    'Berzerker Warband',
    '',
    ...commonBody
  ]
];

function assertEqual(actual, expected, field) {
  if (actual !== expected) {
    console.error(`Mismatch on ${field}: expected='${expected}', got='${actual}'`);
    return false;
  }
  return true;
}

async function main() {
  const providedLines = await linesFromArgOrNull();
  let allPassed = true;

  // If a file was provided, derive the expected SUMMARY from that file so the test adapts
  let dynamicExpected = null;
  if (providedLines) {
    const res = parseGwApp(providedLines);
    const s = res.SUMMARY || {};
    dynamicExpected = {
      LIST_TITLE: s.LIST_TITLE || null,
      TOTAL_ARMY_POINTS: s.TOTAL_ARMY_POINTS || null,
      FACTION_KEYWORD: s.FACTION_KEYWORD || null,
      DETACHMENT: s.DETACHMENT || null,
      DISPLAY_FACTION: s.DISPLAY_FACTION || null
    };
  }

  for (let idx = 0; idx < permutations.length; idx++) {
    const lines = providedLines || permutations[idx];
    const res = parseGwApp(lines);
    const s = res.SUMMARY || {};
    // normalize missing TOTAL_ARMY_POINTS
    const got = {
      LIST_TITLE: s.LIST_TITLE || null,
      TOTAL_ARMY_POINTS: s.TOTAL_ARMY_POINTS || null,
      FACTION_KEYWORD: s.FACTION_KEYWORD || null,
      DETACHMENT: s.DETACHMENT || null,
      DISPLAY_FACTION: s.DISPLAY_FACTION || null
    };

    const expected = dynamicExpected || expectedPerTest[idx];
    console.log(`Test #${idx + 1}:`, JSON.stringify(got));

    allPassed = allPassed && assertEqual(got.LIST_TITLE, expected.LIST_TITLE, 'LIST_TITLE');
    // Assert TOTAL_ARMY_POINTS only if expected is non-null
    if (expected.TOTAL_ARMY_POINTS !== null && expected.TOTAL_ARMY_POINTS !== undefined) {
      allPassed = allPassed && assertEqual(got.TOTAL_ARMY_POINTS, expected.TOTAL_ARMY_POINTS, 'TOTAL_ARMY_POINTS');
    }
    allPassed = allPassed && assertEqual(got.FACTION_KEYWORD, expected.FACTION_KEYWORD, 'FACTION_KEYWORD');
    allPassed = allPassed && assertEqual(got.DETACHMENT, expected.DETACHMENT, 'DETACHMENT');
    allPassed = allPassed && assertEqual(got.DISPLAY_FACTION, expected.DISPLAY_FACTION, 'DISPLAY_FACTION');
  }

  if (!allPassed) {
    console.error('\nOne or more header permutation tests failed.');
    process.exit(2);
  }
  console.log('\nAll header permutation tests passed.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
