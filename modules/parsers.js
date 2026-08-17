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
