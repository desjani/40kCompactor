import fs from 'fs';
import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
const skippable = JSON.parse(fs.readFileSync(new URL('../skippable_wargear.json', import.meta.url)).toString());

const src = fs.readFileSync(new URL('../source.txt', import.meta.url));
const lines = src.toString().split(/\r?\n/);
const parsed = parseWtcCompact(lines);
const abbr = buildAbbreviationIndex(parsed, skippable);

const key = 'ectoplasma cannon';
console.log('Abbreviation map entry for:', key);
console.log(abbr.__flat_abbr[key] || '(not found)');

console.log('\nAll generated abbreviations (sorted):');
const entries = Object.entries(abbr.__flat_abbr).sort((a,b)=>a[0].localeCompare(b[0]));
for (const [k,v] of entries) {
	console.log(k.padEnd(40), '->', v);
}

console.log('\nEntries with abbreviation starting with EC:');
for (const [k,v] of entries) {
	if (v && v.toUpperCase().startsWith('EC')) console.log(k.padEnd(40), '->', v);
}

// Diagnostic: show parsed units and immediate items for Forgefiend and any Ectoplasma occurrences
console.log('\nParsed units containing "Forgefiend" or items with "Ectoplasma":');
for (const sectionKey of Object.keys(parsed || {})) {
	if (sectionKey === 'SUMMARY') continue;
	const section = parsed[sectionKey];
	if (!Array.isArray(section)) continue;
	for (const unit of section) {
		if (!unit || !unit.name) continue;
		const nameLower = (unit.name || '').toString().toLowerCase();
		if (nameLower.includes('forgefiend') || (unit.items || []).some(i=> (i.name||'').toString().toLowerCase().includes('ectoplasma'))) {
			console.log('\nUnit:', unit.name, 'qty=', unit.quantity, 'points=', unit.points, 'typeItems=', (unit.items||[]).length);
			(unit.items||[]).forEach(it => {
				console.log('  - item:', it.name, 'type=', it.type, 'quantity=', it.quantity, 'nameshort=', it.nameshort || '(none)');
				if (it.items && Array.isArray(it.items)) {
					it.items.forEach(sub => console.log('    > subitem:', sub.name, 'type=', sub.type, 'quantity=', sub.quantity));
				}
			});
		}
	}
}
