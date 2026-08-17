// New Recruit added "attached units" support to two of its export formats in the
// same update: Tournament (NR_TOURNAMENT) encodes it via a "Leading X[N]" hint on
// the character plus an "Attached to <Character>" backlink on the unit; the GW-style
// export (NR_GW) wraps them in an explicit "Attached Units" / "Attached Unit N"
// section identical in spirit to what gwapp_v11.js already parses. Both parsers must
// produce the same { isAttached, attachedParts: [{ role: 'Leader' }, { role:
// 'Bodyguard' }] } shape the renderers already understand from the GW App format.
import { test } from 'node:test';
import assert from 'node:assert';
import { parseNRTournament, parseNRGW } from '../modules/parsers.js';
import { readSample, skippableWargear } from './helpers.mjs';

const STANDALONE_UNITS = [
    ['Chaos Predator Destructor', 130],
    ['Chaos Predator Destructor', 130],
    ['Chaos Rhino', 75],
    ['Chaos Rhino', 75],
    ['Chaos Spawn', 95],
    ['Chaos Spawn', 95],
    ['Eightbound', 125],
    ['Jakhals', 65],
    ['Maulerfiend', 140],
];

function checkParsedWE2(data) {
    const attachedUnits = data.units.filter(u => u.isAttached);
    assert.strictEqual(attachedUnits.length, 4, 'Should merge exactly 4 leader+squad pairs');
    attachedUnits.forEach(u => assert.strictEqual(u.attachedParts.length, 2));

    const findByLeaderName = (name) => attachedUnits.find(u => u.attachedParts[0].name === name);

    const kharn = findByLeaderName('Khârn the Betrayer');
    assert.ok(kharn, 'Khârn should be merged with a squad');
    assert.strictEqual(kharn.attachedParts[0].role, 'Leader');
    assert.strictEqual(kharn.attachedParts[0].isWarlord, true);
    assert.strictEqual(kharn.attachedParts[1].role, 'Bodyguard');
    assert.strictEqual(kharn.attachedParts[1].name, 'Khorne Berzerkers');
    assert.strictEqual(kharn.attachedParts[1].subunits.length, 2);
    assert.strictEqual(kharn.points, 115 + 170);

    const invocatus = findByLeaderName('Lord Invocatus');
    assert.ok(invocatus, 'Lord Invocatus should be merged with a squad');
    assert.ok(!invocatus.attachedParts[0].isWarlord);
    assert.strictEqual(invocatus.points, 100 + 170);

    const executions = findByLeaderName('Master of Executions');
    assert.ok(executions, 'Master of Executions should be merged with a squad');
    assert.deepStrictEqual(
        executions.attachedParts[0].enhancements.map(e => ({ name: e.name, points: e.points })),
        [{ name: 'Berzerker Glaive', points: 35 }]
    );
    assert.strictEqual(executions.points, 95 + 170);

    const slaughterbound = findByLeaderName('Slaughterbound');
    assert.ok(slaughterbound, 'Slaughterbound should be merged with Exalted Eightbound');
    assert.deepStrictEqual(
        slaughterbound.attachedParts[0].enhancements.map(e => ({ name: e.name, points: e.points })),
        [{ name: 'Battle-lust', points: 20 }]
    );
    assert.strictEqual(slaughterbound.attachedParts[1].name, 'Exalted Eightbound');
    assert.strictEqual(slaughterbound.points, 120 + 130);

    const standalone = data.units.filter(u => !u.isAttached);
    assert.strictEqual(standalone.length, STANDALONE_UNITS.length, 'Non-attached units should be untouched');
    const standaloneSet = standalone.map(u => `${u.name}|${u.points}`).sort();
    const expectedSet = STANDALONE_UNITS.map(([name, points]) => `${name}|${points}`).sort();
    assert.deepStrictEqual(standaloneSet, expectedSet);
}

test('NR_TOURNAMENT: "Leading X[N]" / "Attached to" backlinks merge into leader+bodyguard pairs', () => {
    const lines = readSample('Test-WE2-NRTournament-English');
    const data = parseNRTournament(lines, skippableWargear);
    checkParsedWE2(data);
});

test('NR_GW: explicit "Attached Units" / "Attached Unit N" section merges into leader+bodyguard pairs', () => {
    const lines = readSample('Test-WE2-NRGW-English');
    const data = parseNRGW(lines, skippableWargear);
    checkParsedWE2(data);
});
