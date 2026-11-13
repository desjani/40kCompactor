import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseWarmind } from '../modules/parsers.js';
import { readSample, skippableWargear } from './helpers.mjs';

function loadWorldEaters() {
    const lines = readSample('Warmind-Sample-WE.txt');
    return parseWarmind(lines, skippableWargear);
}

test('Warmind: format is detected via the "Built with Warmind" footer', () => {
    const lines = readSample('Warmind-Sample-WE.txt');
    assert.strictEqual(detectFormat(lines), 'WARMIND_V11');
});

test('Warmind: format is detected from the "Total: X / Y pts · A/B DP" line alone, without the footer', () => {
    const lines = readSample('Warmind-Sample-WE.txt').filter(l => !/warmind/i.test(l));
    assert.strictEqual(detectFormat(lines), 'WARMIND_V11');
});

test('Warmind: parses header metadata (faction, detachments, battle size, points, DP, disposition)', () => {
    const data = loadWorldEaters();
    assert.strictEqual(data.edition, '11th');
    assert.strictEqual(data.metadata.armyName, 'Test');
    assert.strictEqual(data.metadata.faction, 'World Eaters');
    assert.deepStrictEqual(data.metadata.detachments, ['Berzerker Warband', 'Vessels of Wrath']);
    assert.strictEqual(data.metadata.battleSize, 'Strike Force');
    assert.strictEqual(data.metadata.pointsLimit, 2000);
    assert.strictEqual(data.metadata.totalPoints, 2000);
    assert.strictEqual(data.metadata.detachmentPoints, 3);
    assert.strictEqual(data.metadata.detachmentPointsLimit, 3);
    assert.strictEqual(data.metadata.isLegal, true);
    assert.deepStrictEqual(data.metadata.forceDispositions, ['Priority Assets']);
});

test('Warmind: parses a standalone character with a single wargear item and the Warlord tag', () => {
    const data = loadWorldEaters();
    const angron = data.units.find(u => u.name === 'Angron');
    assert.ok(angron, 'Should find Angron');
    assert.strictEqual(angron.points, 330);
    assert.strictEqual(angron.category, 'Characters');
    assert.strictEqual(angron.isWarlord, true);
    assert.deepStrictEqual(angron.wargear, [
        { name: 'Samni’arius and Spinegrinder', quantity: 1, skippable: true }
    ]);
});

test('Warmind: parses a squad with ×N quantity and ×N wargear multipliers', () => {
    const data = loadWorldEaters();
    const jakhals = data.units.filter(u => u.name === 'Jakhals');
    assert.strictEqual(jakhals.length, 2);
    const squad = jakhals[0];
    assert.strictEqual(squad.points, 65);
    assert.strictEqual(squad.quantity, 10);
    assert.strictEqual(squad.category, 'Infantry');
    assert.deepStrictEqual(squad.wargear, [
        { name: 'Autopistol', quantity: 9, skippable: true },
        { name: 'Icon of Khorne', quantity: 1, skippable: false },
        { name: 'Chainblades', quantity: 8, skippable: false },
        { name: 'Mauler Chainblade', quantity: 1, skippable: false },
        { name: 'Skullsmasher and Mangler', quantity: 1, skippable: false }
    ]);
});

test('Warmind: merges a "└ Leads:" line into an Attached Units wrapper with Leader/Bodyguard roles', () => {
    const data = loadWorldEaters();
    const moe = data.units.find(u => u.name === 'Master of Executions');
    assert.ok(moe, 'Should find the Master of Executions attachment group');
    assert.strictEqual(moe.isAttached, true);
    assert.strictEqual(moe.points, 265); // 95 + 170
    assert.strictEqual(moe.attachedParts.length, 2);

    const leader = moe.attachedParts[0];
    assert.strictEqual(leader.name, 'Master of Executions');
    assert.strictEqual(leader.role, 'Leader');
    assert.strictEqual(leader.points, 95);
    assert.deepStrictEqual(leader.wargear, [
        { name: 'Bolt Pistol', quantity: 1, skippable: true },
        { name: 'Axe of Dismemberment', quantity: 1, skippable: true }
    ]);
    assert.strictEqual(leader.enhancements.length, 1);
    assert.strictEqual(leader.enhancements[0].name, 'Berzerker Glaive');
    assert.strictEqual(leader.enhancements[0].points, 35);

    const bodyguard = moe.attachedParts[1];
    assert.strictEqual(bodyguard.name, 'Khorne Berzerkers');
    assert.strictEqual(bodyguard.role, 'Bodyguard');
    assert.strictEqual(bodyguard.points, 170);
    assert.strictEqual(bodyguard.quantity, 10);
    assert.deepStrictEqual(bodyguard.wargear, [
        { name: 'Bolt Pistol', quantity: 7, skippable: true },
        { name: 'Icon of Khorne', quantity: 1, skippable: false },
        { name: 'Plasma Pistol', quantity: 3, skippable: false },
        { name: 'Chainblade', quantity: 8, skippable: true },
        { name: 'Khornate Eviscerator', quantity: 2, skippable: false }
    ]);
});

test('Warmind: a character leading a non-Battleline squad (Slaughterbound -> Exalted Eightbound) also merges correctly', () => {
    const data = loadWorldEaters();
    const group = data.units.find(u => u.isAttached && u.attachedParts.some(p => p.name === 'Exalted Eightbound'));
    assert.ok(group, 'Should find the Slaughterbound/Exalted Eightbound attachment group');
    assert.strictEqual(group.points, 240); // 110 + 130

    const leader = group.attachedParts[0];
    assert.strictEqual(leader.name, 'Slaughterbound');
    assert.strictEqual(leader.enhancements[0].name, 'Battle-lust');
    assert.strictEqual(leader.enhancements[0].points, 20);

    const bodyguard = group.attachedParts[1];
    assert.strictEqual(bodyguard.name, 'Exalted Eightbound');
    assert.strictEqual(bodyguard.quantity, 3);
    assert.deepStrictEqual(bodyguard.wargear, [
        { name: 'Chainblades', quantity: 3, skippable: true }
    ]);
});

test('Warmind: maps ALL-CAPS category headers to canonical categories', () => {
    const data = loadWorldEaters();
    const byName = (name) => data.units.find(u => u.name === name);
    assert.strictEqual(byName('Lord Invocatus').category, 'Characters');
    assert.strictEqual(byName('Goremongers').category, 'Infantry');
    assert.strictEqual(byName('Chaos Rhino').category, 'Dedicated Transports');

    const moe = data.units.find(u => u.name === 'Master of Executions');
    assert.strictEqual(moe.attachedParts[0].category, 'Battleline');
});

test('Warmind: unaffected by two characters leading identically-named squads ("Khorne Berzerkers" ×2)', () => {
    const data = loadWorldEaters();
    const groups = data.units.filter(u => u.isAttached && u.attachedParts.some(p => p.name === 'Khorne Berzerkers'));
    assert.strictEqual(groups.length, 2);
    assert.strictEqual(groups[0].attachedParts[0].name, 'Master of Executions');
    assert.strictEqual(groups[1].attachedParts[0].name, 'Khârn the Betrayer');
});

test('Warmind: counts all top-level units/attachment-groups from the sample', () => {
    const data = loadWorldEaters();
    // The sample's own footer says "17 units" (Warmind counts each attached
    // part separately); at this parser's grouping level that's 14 entries:
    // 4 standalone characters, 3 Leader+Bodyguard attachment groups, 2
    // standalone squad lines appearing twice each, and 2 Chaos Rhinos.
    assert.strictEqual(data.units.length, 14);
});
