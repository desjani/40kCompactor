import { ansiPalette, colorNameToHex, generateDiscordText } from '../modules/renderers.js';
import factionColors from '../modules/faction_colors.js';

console.log('Imports successful');
console.log('ansiPalette length:', ansiPalette.length);
console.log('colorNameToHex keys:', Object.keys(colorNameToHex));
console.log('factionColors keys:', Object.keys(factionColors));

const testHex = colorNameToHex['red'];
const entry = ansiPalette.find(p => p.hex.toLowerCase() === testHex.toLowerCase());
console.log('Red code:', entry ? entry.code : 'not found');
import { detectFormat, parseGwApp } from '../modules/parsers.js';
console.log('Parsers imported successfully');
