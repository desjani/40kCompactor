import { parseWtcCompact } from '../modules/parsers.js';

const expected = { LIST_TITLE: '', TOTAL_ARMY_POINTS: '1995pts', FACTION_KEYWORD: 'World Eaters', DETACHMENT: 'Berzerker Warband', DISPLAY_FACTION: 'Chaos - World Eaters' };

const commonBody = ['','Char1: 1x Daemon Prince of Khorne (220 pts): Warlord',''];

const permutations = [
  // 1: canonical block order
  [
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    '+ FACTION KEYWORD: Chaos - World Eaters',
    '+ DETACHMENT: Berzerker Warband',
    '+ TOTAL ARMY POINTS: 1995pts',
    '+ WARLORD: Char2: Daemon Prince of Khorne',
    '& Berzerker Glaive (on Char2: Master of Executions)',
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    ...commonBody
  ],
  // 2: detachment before faction
  [
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    '+ DETACHMENT: Berzerker Warband',
    '+ FACTION KEYWORD: Chaos - World Eaters',
    '+ TOTAL ARMY POINTS: 1995pts',
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    ...commonBody
  ],
  // 3: include ignored keys and different spacing
  [
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    '+ NUMBER OF UNITS: 16',
    '+ FACTION KEYWORD: Chaos - World Eaters',
    '+ SECONDARY: - Bring It Down: (7x2)',
    '+ DETACHMENT: Berzerker   Warband',
    '+ TOTAL ARMY POINTS: 1995pts',
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    ...commonBody
  ],
  // 4: enhancements and & mixed in
  [
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    '& Favoured of Khorne (on Char3: Slaughterbound)',
    '+ FACTION KEYWORD: Chaos - World Eaters',
    '& Berzerker Glaive (on Char2: Master of Executions)',
    '+ DETACHMENT: Berzerker Warband',
    '+ TOTAL ARMY POINTS: 1995pts',
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    ...commonBody
  ],
  // 5: different casing and multiple dashes
  [
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    '+ faction keyword: Imperium - Chaos - World Eaters',
    '+ detachment: Berzerker Warband',
    '+ total army points: 1995pts',
    '+++++++++++++++++++++++++++++++++++++++++++++++',
    ...commonBody
  ]
];

function assertEqual(actual, expectedVal, field) {
  if (actual !== expectedVal) {
    console.error(`Mismatch on ${field}: expected='${expectedVal}', got='${actual}'`);
    return false;
  }
  return true;
}

let allPassed = true;
for (let idx = 0; idx < permutations.length; idx++) {
  const lines = permutations[idx];
  const res = parseWtcCompact(lines);
  const s = res.SUMMARY || {};
  const got = {
    LIST_TITLE: (s.LIST_TITLE === undefined || s.LIST_TITLE === null) ? '' : s.LIST_TITLE,
    TOTAL_ARMY_POINTS: s.TOTAL_ARMY_POINTS || null,
    FACTION_KEYWORD: s.FACTION_KEYWORD || null,
    DETACHMENT: s.DETACHMENT || null,
    DISPLAY_FACTION: s.DISPLAY_FACTION || null
  };
  console.log(`Test #${idx+1}:`, JSON.stringify(got));

  allPassed = allPassed && assertEqual(got.LIST_TITLE, expected.LIST_TITLE, 'LIST_TITLE');
  allPassed = allPassed && assertEqual(got.TOTAL_ARMY_POINTS, expected.TOTAL_ARMY_POINTS, 'TOTAL_ARMY_POINTS');
  allPassed = allPassed && assertEqual(got.FACTION_KEYWORD, expected.FACTION_KEYWORD, 'FACTION_KEYWORD');
  allPassed = allPassed && assertEqual(got.DETACHMENT && got.DETACHMENT.replace(/\s+/g,' '), expected.DETACHMENT, 'DETACHMENT');
  allPassed = allPassed && assertEqual(got.DISPLAY_FACTION, expected.DISPLAY_FACTION, 'DISPLAY_FACTION');
}

if (!allPassed) {
  console.error('\nOne or more WTC header permutation tests failed.');
  process.exit(2);
}
console.log('\nAll WTC header permutation tests passed.');
process.exit(0);
