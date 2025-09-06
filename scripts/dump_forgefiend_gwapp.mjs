import fs from 'fs';
import { parseGwApp } from '../modules/parsers.js';
const src = fs.readFileSync(new URL('../source.txt', import.meta.url));
const lines = src.toString().split(/\r?\n/);
const parsed = parseGwApp(lines);
for (const sectionKey of Object.keys(parsed || {})) {
	if (sectionKey === 'SUMMARY') continue;
	const section = parsed[sectionKey];
	if (!Array.isArray(section)) continue;
	for (const unit of section) {
		if (!unit || !unit.name) continue;
		if ((unit.name||'').toLowerCase().includes('forgefiend')) {
			console.log(JSON.stringify(unit, null, 2));
		}
	}
}
