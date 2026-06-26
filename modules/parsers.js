import { detectV11Format } from './parsers/v11_detector.js';
import { parseV11List } from './parsers/v11_parser.js';
import { parseGwAppV11 } from './parsers/gwapp_v11.js';
import { parseWarOrganV11 } from './parsers/war_organ_parser.js';
import { parseNRWTCCompact } from './parsers/nr_wtc_compact_parser.js';
import { parseNRWTC } from './parsers/nr_wtc_parser.js';
import { parseNRGW } from './parsers/nr_gw_parser.js';

export { parseV11List, parseGwAppV11, parseWarOrganV11, parseNRWTCCompact, parseNRWTC, parseNRGW };

export function detectFormat(lines) {
    return detectV11Format(lines);
}
