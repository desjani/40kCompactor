import { parseWtcCompact } from './modules/parsers.js';

const sample = `+ FACTION KEYWORD: Chaos - World Eaters
+ TOTAL ARMY POINTS: 1000
+++ 
5x Infiltrator Squad (100 pts)
• 4x Infiltrator
    2 with Infiltrator Squad, Bolt Pistol, Close combat weapon, Marksman Bolt Carbine
    1 with Infiltrator Comms Array, Infiltrator Squad, Bolt Pistol, Close combat weapon, Marksman Bolt Carbine
    1 with Helix Gauntlet, Infiltrator Squad, Bolt Pistol, Close combat weapon, Marksman Bolt Carbine
`;

const lines = sample.split(/\r?\n/);
const parsed = parseWtcCompact(lines);
console.log(JSON.stringify(parsed, null, 2));
