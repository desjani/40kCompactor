import { test } from 'node:test';
import assert from 'node:assert';
import { getCanonicalFactionName } from '../modules/utils.js';

const cases = [
    ["sternenreich der t'au", "T'au Empire"],
    ['impero tau', "T'au Empire"],
    ["empire t'au", "T'au Empire"],
    ['démons du chaos', 'Chaos Daemons'],
    ['chaosdaemonen', 'Chaos Daemons'],
    ['demonios del caos', 'Chaos Daemons'],
    ['weisse narben', 'White Scars'],
    ['cicatrices blanches', 'White Scars'],
    ['grey knights', 'Grey Knights'],
    ['cavalieri grigi', 'Grey Knights'],
    ['weltraumwolfe', 'Space Wolves'],
    ['loups spatiaux', 'Space Wolves'],
    ['sisters of battle', 'Adepta Sororitas'],
    ['schwestern des kampfes', 'Adepta Sororitas'],
];

for (const [input, expected] of cases) {
    test(`getCanonicalFactionName("${input}") -> "${expected}"`, () => {
        assert.strictEqual(getCanonicalFactionName(input), expected);
    });
}
