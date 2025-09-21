import fs from 'fs';
import { parseGwApp, parseWtcCompact } from '../modules/parsers.js';
import FAMILY_MAP from '../modules/family_map.js';

function assert(condition, msg) { if (!condition) { console.error('ASSERT FAILED:', msg); process.exit(2); } }

// Load the provided GW App sample
const gwText = fs.readFileSync(new URL('../samples/GWAPPSample.txt', import.meta.url), 'utf8');
const gwLines = gwText.split(/\r?\n/);
const gwResult = parseGwApp(gwLines);
console.log('GW APP SUMMARY:', JSON.stringify(gwResult.SUMMARY, null, 2));
assert(gwResult.SUMMARY, 'GW parser must produce SUMMARY');
assert(typeof gwResult.SUMMARY.DISPLAY_FACTION === 'string' && gwResult.SUMMARY.DISPLAY_FACTION.length > 0, 'GW DISPLAY_FACTION must be present');
assert(typeof gwResult.SUMMARY.FACTION_KEY === 'string' && gwResult.SUMMARY.FACTION_KEY.length > 0, 'GW FACTION_KEY must be present');
assert(typeof gwResult.SUMMARY.LIST_TITLE === 'string' && gwResult.SUMMARY.LIST_TITLE.length > 0, 'GW LIST_TITLE should be present for GW App');
// If family map contains the faction keyword, DISPLAY_FACTION should be 'Family - FACTION_KEYWORD'
if (gwResult.SUMMARY.FACTION_KEYWORD) {
	const fk = gwResult.SUMMARY.FACTION_KEYWORD;
	const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === fk.toString().toLowerCase());
	if (familyKey) {
		const expected = `${FAMILY_MAP[familyKey]} - ${fk}`;
		assert(gwResult.SUMMARY.DISPLAY_FACTION === expected, `GW DISPLAY_FACTION should be '${expected}'`);
	}
}

// Use provided WTC compact sample file shipped in the workspace
const wtcRaw = fs.readFileSync(new URL('../samples/WTCCompactSample.txt', import.meta.url), 'utf8');
const wtcSample = wtcRaw.split(/\r?\n/);
const wtcResult = parseWtcCompact(wtcSample);
console.log('WTC COMPACT SUMMARY:', JSON.stringify(wtcResult.SUMMARY, null, 2));
assert(wtcResult.SUMMARY, 'WTC parser must produce SUMMARY');
assert(typeof wtcResult.SUMMARY.DISPLAY_FACTION === 'string' && wtcResult.SUMMARY.DISPLAY_FACTION.length > 0, 'WTC DISPLAY_FACTION must be present');
assert(typeof wtcResult.SUMMARY.FACTION_KEY === 'string' && wtcResult.SUMMARY.FACTION_KEY.length > 0, 'WTC FACTION_KEY must be present');
assert(typeof wtcResult.SUMMARY.LIST_TITLE === 'string', 'WTC LIST_TITLE should be a string (may be empty)');
if (wtcResult.SUMMARY.FACTION_KEYWORD) {
	const fk = wtcResult.SUMMARY.FACTION_KEYWORD;
	const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === fk.toString().toLowerCase());
	if (familyKey) {
		const expected = `${FAMILY_MAP[familyKey]} - ${fk}`;
		assert(wtcResult.SUMMARY.DISPLAY_FACTION === expected, `WTC DISPLAY_FACTION should be '${expected}'`);
	}
}

console.log('All summary normalization checks passed.');
process.exit(0);
