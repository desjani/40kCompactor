import { detectV11Format } from './parsers/v11_detector.js';
import { parseV11List } from './parsers/v11_parser.js';
import { parseGwAppV11 } from './parsers/gwapp_v11.js';
import { parseWarOrganV11 } from './parsers/war_organ_parser.js';

export { parseV11List, parseGwAppV11, parseWarOrganV11 };

export function detectFormat(lines) {
    return detectV11Format(lines);
}
