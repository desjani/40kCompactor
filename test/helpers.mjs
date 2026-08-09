import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, '..');
export const samplesDir = path.join(repoRoot, 'samples');

export const skippableWargear = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'skippable_wargear.json'), 'utf8')
);

// Reads a sample file from samples/ and returns it as an array of lines,
// the same shape every parser expects as input.
export function readSample(name) {
    const text = fs.readFileSync(path.join(samplesDir, name), 'utf8');
    return text.split(/\r?\n/);
}

// Curly apostrophes/quotes differ between export tools (New Recruit vs GW App vs
// War Organ); normalize them to straight equivalents for comparison purposes only.
export function normalizeApostrophes(s) {
    return (s || '').replace(/[‘’‛′]/g, "'");
}

// Reduces a parsed unit to a comparable shape for cross-format equivalence
// checks. Wargear is FLATTENED: every item across the unit's own wargear and
// all of its subunits is merged into one per-unit name->quantity multiset,
// deliberately discarding subunit-grouping shape. This matters because how a
// unit's models get split into subunits is a structural convention that
// differs by source format (e.g. New Recruit's GW-style keeps a "5 with X" +
// "2 with Y" split as separate subunits, Tournament format may fold them
// differently) even when the two sides agree on every model's actual loadout
// - see session notes on Khorne Berzerkers parsing identically once wargear
// is summed, despite different subunit shapes. Names are apostrophe-
// normalized and lowercased; fields known to be inert (unit.quantity,
// unit.category - neither is read by any renderer) are intentionally excluded.
export function normalizeUnitForComparison(unit) {
    const normName = (s) => normalizeApostrophes(s).toLowerCase();
    const totals = new Map();
    const addAll = (arr) => {
        for (const w of (arr || [])) {
            const key = normName(w.name);
            totals.set(key, (totals.get(key) || 0) + w.quantity);
        }
    };
    addAll(unit.wargear);
    for (const sub of (unit.subunits || [])) addAll(sub.wargear);
    const wargear = [...totals.entries()].map(([name, qty]) => `${name}x${qty}`).sort();
    return {
        name: normName(unit.name),
        points: unit.points,
        isWarlord: !!unit.isWarlord,
        wargear,
        enhancements: (unit.enhancements || []).map(e => normName(e.name)).sort()
    };
}

// Flattens GW App's "Attached Unit N" wrapper objects into their individual
// leader/bodyguard parts, so attached-unit lists can be compared against formats
// that don't (yet) represent attachment (New Recruit, War Organ).
export function flattenAttached(units) {
    return units.flatMap(u => (u.isAttached && Array.isArray(u.attachedParts)) ? u.attachedParts : [u]);
}

// Sorted, normalized unit list ready for deep-equal / JSON-string comparison
// across two parses of the "same" army from different source formats.
export function comparableUnitSet(units) {
    return flattenAttached(units)
        .map(normalizeUnitForComparison)
        .map(u => JSON.stringify(u))
        .sort();
}
