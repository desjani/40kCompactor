import { detectV11Format } from './parsers/v11_detector.js';
import { parseV11List } from './parsers/v11_parser.js';
import { parseGwAppV11 } from './parsers/gwapp_v11.js';
import { parseWarOrganV11 } from './parsers/war_organ_parser.js';
import { parseNRTournament } from './parsers/nr_tournament_parser.js';
import { parseNRGW } from './parsers/nr_gw_parser.js';

export { parseV11List, parseGwAppV11, parseWarOrganV11, parseNRTournament, parseNRGW };

export function detectFormat(lines) {
    return detectV11Format(lines);
}

const PARSERS_BY_FORMAT = {
    V11_GENERIC: parseV11List,
    GW_APP_V11: parseGwAppV11,
    WAR_ORGAN_V11: parseWarOrganV11,
    NR_TOURNAMENT: parseNRTournament,
    NR_GW: parseNRGW
};

// Single entry point: detects the export format and runs the matching parser.
// Accepts raw text or an array of lines. Returns { format, list }, where list
// is null when the format is UNKNOWN.
export function parseList(input, skippableWargearMap = {}) {
    const lines = Array.isArray(input) ? input : String(input ?? '').split(/\r?\n/);
    const format = detectFormat(lines);
    const parser = PARSERS_BY_FORMAT[format];
    return { format, list: parser ? parser(lines, skippableWargearMap) : null };
}
