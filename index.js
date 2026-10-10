import { detectFormat, parseList, parseV11List, parseGwAppV11, parseWarOrganV11, parseNRTournament, parseNRGW } from './modules/parsers.js';
import { generateDiscordText, buildFactionColorMap } from './modules/renderers.js';
import { buildAbbreviationIndex } from './modules/abbreviations.js';

export {
    detectFormat,
    parseList,
    parseV11List,
    parseGwAppV11,
    parseWarOrganV11,
    parseNRTournament,
    parseNRGW,
    generateDiscordText,
    buildFactionColorMap,
    buildAbbreviationIndex
};
