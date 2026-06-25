import { detectFormat, parseV11List, parseGwAppV11, parseWarOrganV11 } from './modules/parsers.js';
import { generateDiscordText, buildFactionColorMap } from './modules/renderers.js';
import { buildAbbreviationIndex } from './modules/abbreviations.js';

export {
    detectFormat,
    parseV11List,
    parseGwAppV11,
    parseWarOrganV11,
    generateDiscordText,
    buildFactionColorMap,
    buildAbbreviationIndex
};
