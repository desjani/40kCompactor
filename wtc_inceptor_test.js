import { parseWtcCompact } from './modules/parsers.js';

const sample = `+ FACTION KEYWORD: Imperium - Adeptus Astartes
+++ 
3x Inceptor Squad (120 pts)
• 2x Inceptor: 2 with Close combat weapon, Assault Bolters
• 1x Inceptor Sergeant: Close combat weapon, Assault Bolters
`;

const lines = sample.split(/\r?\n/);
const parsed = parseWtcCompact(lines);
console.log(JSON.stringify(parsed, null, 2));
