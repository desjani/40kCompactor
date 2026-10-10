import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { parseList, detectFormat, parseNRTournament } from '../index.js';
import { readSample, samplesDir, skippableWargear } from './helpers.mjs';

// parseList is the single entry point the web UI, CLI and Discord bot share,
// so it must route every shipped sample to the same parser detectFormat picks.
const samples = [
    'GWAPP-Sample-Tau.txt',
    'WO-Sample-SOB1.txt',
    'NR-Tournament-Sample-Tau.txt',
    'NR-GW-Sample-WorldEaters.txt',
    'V11Sample.txt'
];

for (const name of samples) {
    test(`parseList detects and parses ${name}`, () => {
        const lines = readSample(name);
        const { format, list } = parseList(lines, skippableWargear);
        assert.strictEqual(format, detectFormat(lines));
        assert.ok(list, 'expected a parsed list');
        assert.ok(list.units.length > 0, 'expected at least one unit');
    });
}

test('parseList accepts raw text as well as lines', () => {
    const text = fs.readFileSync(path.join(samplesDir, 'NR-Tournament-Sample-Tau.txt'), 'utf8');
    const fromText = parseList(text, skippableWargear);
    assert.strictEqual(fromText.format, 'NR_TOURNAMENT');
    assert.deepStrictEqual(fromText.list, parseNRTournament(text.split(/\r?\n/), skippableWargear));
});

test('parseList returns a null list for unrecognized input', () => {
    assert.deepStrictEqual(parseList('just some words'), { format: 'UNKNOWN', list: null });
    assert.deepStrictEqual(parseList(''), { format: 'UNKNOWN', list: null });
});
