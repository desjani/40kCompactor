import fs from 'fs';
import { detectFormat, parseWtcCompact, parseNrGw, parseGwApp } from '../modules/parsers.js';

const samples = [
  ['WTCCompactSample.txt', parseWtcCompact],
  ['NRGWSample.txt', parseNrGw],
  ['GWAPPSample.txt', parseGwApp]
];

const labelMap = {
  'GW_APP': 'GW Official App',
  'WTC_COMPACT': "New Recruit - WTC-Compact",
  'NR_GW': 'New Recruit - GW'
};

for (const [fname, parser] of samples) {
  const text = fs.readFileSync(new URL(`../${fname}`, import.meta.url), 'utf8');
  const lines = text.split(/\r?\n/);
  const fmt = detectFormat(lines);
  const friendly = labelMap[fmt] || fmt;
  console.log(`${fname}: detected -> ${fmt} (${friendly})`);
  const result = parser(lines);
  console.log(`  SUMMARY.DISPLAY_FACTION: ${result.SUMMARY && result.SUMMARY.DISPLAY_FACTION}`);
  console.log(`  TOTAL_ARMY_POINTS: ${result.SUMMARY && result.SUMMARY.TOTAL_ARMY_POINTS}`);
}
