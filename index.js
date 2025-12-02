import { detectFormat, parseGwApp, parseWtcCompact, parseWtc, parseNrGw, parseNrNr, parseLf } from './modules/parsers.js';
import { generateDiscordText, buildFactionColorMap } from './modules/renderers.js';
import { buildAbbreviationIndex } from './modules/abbreviations.js';

export {
    detectFormat,
    parseGwApp,
    parseWtcCompact,
    parseWtc,
    parseNrGw,
    parseNrNr,
    parseLf,
    generateDiscordText,
    buildFactionColorMap,
    buildAbbreviationIndex
};
