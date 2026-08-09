import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat } from '../modules/parsers.js';
import { readSample } from './helpers.mjs';

// One entry per sample file we ship: format detection is the first thing that
// runs on any pasted list, so a misdetection here silently routes the whole
// list into the wrong parser (this exact failure mode broke War Organ's World
// Eaters sample this session, when a random attachment-group name collided
// with the Format 2 detection heuristic).
const cases = [
    ['V11Sample.txt', 'V11_GENERIC'],

    ['GWAPP-Sample-Tau.txt', 'GW_APP_V11'],
    ['GWAPP-Sample-WorldEaters.txt', 'GW_APP_V11'],
    ['GWAPP-Sample-ImperialKnights', 'GW_APP_V11'],
    ['GWAPP-Sample-French.txt', 'GW_APP_V11'],
    ['GWAPP-Sample-Alternate.txt', 'GW_APP_V11'],
    ['GWAPP-Sample-DarkAngels.txt', 'GW_APP_V11'],
    ['Test-TAU-GWAPP-English', 'GW_APP_V11'],
    ['Test-TAU-GWAPP-French', 'GW_APP_V11'],
    ['Test-WE-GWAPP-English', 'GW_APP_V11'],
    ['Test-WE-GWAPP-French', 'GW_APP_V11'],

    ['WO-Sample-SOB1.txt', 'WAR_ORGAN_V11'],
    ['WO-Sample-SOB2.txt', 'WAR_ORGAN_V11'],
    ['WO-Sample-AM1.txt', 'WAR_ORGAN_V11'],
    ['WO-Sample-AM2.txt', 'WAR_ORGAN_V11'],
    ['Test-TAU-WARORGAN-English', 'WAR_ORGAN_V11'],
    ['Test-WE-WARORGAN-English', 'WAR_ORGAN_V11'],

    ['NR-WTCCompact-Sample-Tau.txt', 'NR_WTC_COMPACT'],
    ['NR-WTCCompact-Sample-WorldEaters.txt', 'NR_WTC_COMPACT'],
    ['NR-WTC-Sample-Tau.txt', 'NR_WTC'],
    ['NR-WTC-Sample-WorldEaters.txt', 'NR_WTC'],
    ['NR-GW-Sample-Tau.txt', 'NR_GW'],
    ['NR-GW-Sample-WorldEaters.txt', 'NR_GW'],
    // "Tournament" is New Recruit's current export name for what the codebase
    // still calls WTC-Compact internally (confirmed this session: live Tournament
    // exports route through NR_WTC_COMPACT, not the standalone NR_WTC parser).
    ['Test-TAU-NRTournament-English', 'NR_WTC_COMPACT'],
    ['Test-WE-NRTournament-English', 'NR_WTC_COMPACT'],
    ['Test-TAU-NRGW-English', 'NR_GW'],
    ['Test-WE-NRGW-English', 'NR_GW'],
];

for (const [file, expected] of cases) {
    test(`detectFormat: ${file} -> ${expected}`, () => {
        const lines = readSample(file);
        assert.strictEqual(detectFormat(lines), expected);
    });
}

test('detectFormat: empty input returns UNKNOWN', () => {
    assert.strictEqual(detectFormat([]), 'UNKNOWN');
});

test('detectFormat: unrecognized garbage text returns UNKNOWN', () => {
    assert.strictEqual(detectFormat(['just some random text', 'that is not a list', 'at all']), 'UNKNOWN');
});
