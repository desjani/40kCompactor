import fs from 'fs/promises';
import { parseWtcCompact } from '../modules/parsers.js';
import { buildAbbreviationIndex, makeAbbrevForName } from '../modules/abbreviations.js';

async function run() {
	const txt = await fs.readFile('./WTCCompactSample.txt','utf8');
	const parsed = parseWtcCompact(txt.split(/\r?\n/));
	const abbr = buildAbbreviationIndex(parsed);
	const flat = abbr && abbr.__flat_abbr ? abbr.__flat_abbr : {};
	const lookup = (k) => flat[k.toLowerCase()] || flat[k] || null;
	const name = 'Ectoplasma Cannon';
	console.log('Abbreviation map has', Object.keys(flat).length, 'entries');
	console.log("Lookup for '"+name+"' ->", lookup(name.toLowerCase()) || lookup(name) || '(not found)');
	console.log("makeAbbrevForName('"+name+"') ->", makeAbbrevForName(name));
	const keys = Object.keys(flat).filter(k => k.includes('ectoplasma'));
	console.log('Keys containing "ectoplasma":', keys.length ? keys : '(none)');
	for (const k of keys) console.log('  ', k, '=>', flat[k]);
}

run().catch(e=>{ console.error(e); process.exit(1); });
