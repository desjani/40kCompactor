// Cross-format equivalence: the user rebuilt the same two armies (T'au Empire,
// World Eaters) independently in every export tool we support, so we can
// assert that parsing the "same" army from different source formats produces
// equivalent wargear totals. This caught real bugs this session (unmerged
// duplicate wargear across multiple detail lines, undercounted subunit
// wargear, missing Battleline category, a format-detection collision) that no
// single-format fixture test would have surfaced, because each parser looked
// internally self-consistent in isolation.
//
// Strictness varies by pair, based on empirical verification (see inline
// notes): pairs produced by the SAME tool (only format or language changed)
// must match exactly. Pairs built independently in DIFFERENT tools may
// legitimately differ on a handful of units - GW App's own export omits some
// default/implied wargear (a drone's built-in weapon) that other tools list
// explicitly, War Organ writes some compound names with "&" instead of "and"
// and pluralizes some default wargear differently, and a human building the
// "same" army twice by hand can pick a different but equally valid wargear
// option for one model. Those are documented in KNOWN_CROSS_TOOL_DIFFERENCES
// below; anything NOT on that list must still match exactly, so a real
// regression in a previously-clean unit still fails the build.
import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseNRGW, parseNRWTCCompact, parseGwAppV11, parseWarOrganV11 } from '../modules/parsers.js';
import { readSample, comparableUnitSet } from './helpers.mjs';

const parserByFormat = {
    NR_GW: parseNRGW,
    NR_WTC_COMPACT: parseNRWTCCompact,
    GW_APP_V11: parseGwAppV11,
    WAR_ORGAN_V11: parseWarOrganV11
};

function parseSample(file) {
    const lines = readSample(file);
    const format = detectFormat(lines);
    const parser = parserByFormat[format];
    if (!parser) throw new Error(`No parser mapped for detected format ${format} (file: ${file})`);
    return parser(lines);
}

function unitNameFromComparable(entry) {
    return JSON.parse(entry).name;
}

// Diffs two unit lists (already reduced via comparableUnitSet) and returns the
// set of unit names that differ in either direction.
function diffUnitNames(unitsA, unitsB) {
    const setA = new Set(comparableUnitSet(unitsA));
    const setB = new Set(comparableUnitSet(unitsB));
    const names = new Set();
    for (const entry of setA) if (!setB.has(entry)) names.add(unitNameFromComparable(entry));
    for (const entry of setB) if (!setA.has(entry)) names.add(unitNameFromComparable(entry));
    return names;
}

function assertExactMatch(unitsA, unitsB, label) {
    const diffNames = diffUnitNames(unitsA, unitsB);
    assert.strictEqual(diffNames.size, 0, `${label}: expected an exact match, but these units differ: ${[...diffNames].join(', ')}`);
}

// Units known to legitimately differ between independently-built lists in
// different tools. Verified by hand against each tool's raw export text -
// each is a real content or source-text-convention difference, not a bug.
const KNOWN_CROSS_TOOL_DIFFERENCES = new Set([
    "the twin lance",           // GW App omits "Twin pulse blaster" (drone's built-in weapon) from its export
    "pathfinder team",          // GW App omits "Drone burst cannon" (drone's built-in weapon) from its export
    "crisis sunforge battlesuits", // one model uses Gun Drone in one list, Marker Drone in the other - a real loadout choice
    "maulerfiend",              // Magma cutter vs Lasher tendrils - a real loadout choice; also War Organ pluralizes "Magma cutters"
    "khorne berzerkers",        // War Organ pluralizes "Khornate eviscerator" text differently in one case
    "chaos predator destructor", // War Organ writes "Heavy bolters" (plural) where others write "Heavy bolter"
    "jakhals",                  // War Organ writes "skullsmasher & mangler" where others write "and"
    "slaughterbound"            // War Organ writes "lacerator & daemonic claw" where others write "and"
]);

function assertMatchAllowingKnownDifferences(unitsA, unitsB, label) {
    const diffNames = diffUnitNames(unitsA, unitsB);
    const unexpected = [...diffNames].filter(name => !KNOWN_CROSS_TOOL_DIFFERENCES.has(name));
    assert.strictEqual(
        unexpected.length, 0,
        `${label}: found unit differences NOT on the known-cross-tool-difference allowlist (a real regression, not an expected content/style difference): ${unexpected.join(', ')}`
    );
}

function crossFormatSuite(armyLabel, files) {
    test(`${armyLabel}: NRGW vs Tournament match exactly (same tool, only format differs)`, () => {
        const a = parseSample(files.nrgw);
        const b = parseSample(files.tournament);
        assertExactMatch(a.units, b.units, 'NRGW vs Tournament');
    });

    test(`${armyLabel}: GW App English vs French match exactly (same tool, only language differs)`, () => {
        const a = parseSample(files.gwappEn);
        const b = parseSample(files.gwappFr);
        assertExactMatch(a.units, b.units, 'GWAPP-English vs GWAPP-French');
    });

    test(`${armyLabel}: NRGW vs GW App agree outside known content differences`, () => {
        const a = parseSample(files.nrgw);
        const b = parseSample(files.gwappEn);
        assertMatchAllowingKnownDifferences(a.units, b.units, 'NRGW vs GWAPP-English');
    });

    test(`${armyLabel}: NRGW vs War Organ agree outside known content differences`, () => {
        const a = parseSample(files.nrgw);
        const b = parseSample(files.warorgan);
        assertMatchAllowingKnownDifferences(a.units, b.units, 'NRGW vs WarOrgan');
    });

    test(`${armyLabel}: total points match across every format`, () => {
        const totals = {
            nrgw: parseSample(files.nrgw).metadata.totalPoints,
            tournament: parseSample(files.tournament).metadata.totalPoints,
            gwappEn: parseSample(files.gwappEn).metadata.totalPoints,
            gwappFr: parseSample(files.gwappFr).metadata.totalPoints,
            warorgan: parseSample(files.warorgan).metadata.totalPoints
        };
        const values = Object.values(totals);
        assert.ok(values.every(v => v === values[0]), `Total points disagree across formats: ${JSON.stringify(totals)}`);
    });

    test(`${armyLabel}: unit count matches across every format`, () => {
        const counts = {
            nrgw: parseSample(files.nrgw).units.length,
            tournament: parseSample(files.tournament).units.length,
            gwappEn: parseSample(files.gwappEn).units.flatMap(u => u.isAttached ? u.attachedParts : [u]).length,
            gwappFr: parseSample(files.gwappFr).units.flatMap(u => u.isAttached ? u.attachedParts : [u]).length,
            warorgan: parseSample(files.warorgan).units.length
        };
        const values = Object.values(counts);
        assert.ok(values.every(v => v === values[0]), `Unit counts disagree across formats: ${JSON.stringify(counts)}`);
    });

    test(`${armyLabel}: Force Disposition is captured in every format that supports it`, () => {
        assert.deepStrictEqual(parseSample(files.nrgw).metadata.forceDispositions, ['Purge the Foe']);
        assert.deepStrictEqual(parseSample(files.tournament).metadata.forceDispositions, ['Purge the Foe']);
        assert.deepStrictEqual(parseSample(files.gwappEn).metadata.forceDispositions, ['Purge the Foe']);
        assert.deepStrictEqual(parseSample(files.warorgan).metadata.forceDispositions, ['Purge The Foe']); // War Organ's own capitalization
    });
}

crossFormatSuite("T'au Empire", {
    nrgw: 'Test-TAU-NRGW-English',
    tournament: 'Test-TAU-NRTournament-English',
    gwappEn: 'Test-TAU-GWAPP-English',
    gwappFr: 'Test-TAU-GWAPP-French',
    warorgan: 'Test-TAU-WARORGAN-English'
});

crossFormatSuite('World Eaters', {
    nrgw: 'Test-WE-NRGW-English',
    tournament: 'Test-WE-NRTournament-English',
    gwappEn: 'Test-WE-GWAPP-English',
    gwappFr: 'Test-WE-GWAPP-French',
    warorgan: 'Test-WE-WARORGAN-English'
});
