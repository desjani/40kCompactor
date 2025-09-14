// Minimal wrapper: re-export parser functions from their files.
import { parseWtcCompact } from './parsers/wtc.js';
import { parseGwAppV2 as parseGwApp } from './parsers/gwapp.js';
import { parseNrGw } from './parsers/nrgw.js';

export { parseWtcCompact, parseGwApp, parseNrGw };

export function detectFormat(lines) {
    const first25 = Array.isArray(lines) ? lines.slice(0, 25) : [];
    const hasPlusHeader = first25.some(line => /^\s*\+\s*FACTION KEYWORD:/i.test(line) || /^\s*\+\s*DETACHMENT:/i.test(line));
    const hasGwSections = first25.some(line => /^(?:CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i.test((line||'').trim().toUpperCase()));

    if (hasPlusHeader && hasGwSections) return 'NR_GW';
    if (first25.some(line => /^\s*\+\s*FACTION KEYWORD:/i.test(line))) return 'WTC_COMPACT';
    if (hasGwSections) return 'GW_APP';
    return 'UNKNOWN';
}

