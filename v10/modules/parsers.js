// Minimal wrapper: re-export parser functions from their files.
import { parseWtcCompact } from './parsers/wtc_compact.js';
import { parseWtc } from './parsers/wtc.js';
import { parseGwAppV2 as parseGwApp } from './parsers/gwapp.js';
import { parseNrGw } from './parsers/nrgw.js';
import { parseNrNr } from './parsers/nrnr.js';
import { detectFormat as detectFormatImpl } from './parsers/detectors.js';
import { parseLf } from './parsers/lf.js';

export { parseWtcCompact, parseGwApp, parseNrGw, parseNrNr, parseWtc, parseLf };

export function detectFormat(lines) {
    // Delegate to the central detector implementation so we have one
    // authoritative source of format heuristics for both tests and UI.
    try {
    const fmt = detectFormatImpl(lines).format;
    if (fmt === 'NRNR') return 'NRNR';
    if (fmt === 'WTC-Compact') return 'WTC_COMPACT';
    if (fmt === 'WTC') return 'WTC';
    if (fmt === 'GWAPP') return 'GW_APP';
    if (fmt === 'NR-GW') return 'NR_GW';
    if (fmt === 'LF') return 'LF';
    return 'UNKNOWN';
    } catch (e) {
        // On error, fall back to legacy lightweight detection used previously
        const first25 = Array.isArray(lines) ? lines.slice(0, 25) : [];
        const hasPlusHeader = first25.some(line => /^\s*\+\s*FACTION KEYWORD:/i.test(line) || /^\s*\+\s*DETACHMENT:/i.test(line));
        const hasGwSections = first25.some(line => /^(?:CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i.test((line||'').trim().toUpperCase()));
        if (hasPlusHeader && hasGwSections) return 'NR_GW';
        if (first25.some(line => /^\s*\+\s*FACTION KEYWORD:/i.test(line))) return 'WTC_COMPACT';
        if (hasGwSections) return 'GW_APP';
        return 'UNKNOWN';
    }
}

