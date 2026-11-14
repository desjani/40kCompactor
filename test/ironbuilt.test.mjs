import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseIronbuilt } from '../modules/parsers.js';
import { generateOutput } from '../modules/renderers.js';
import { readSample, skippableWargear } from './helpers.mjs';

const SAMPLE = 'Ironbuilt-Sample-WE.txt';
const load = () => parseIronbuilt(readSample(SAMPLE), skippableWargear);
const wargearOf = (unit) => Object.fromEntries(unit.wargear.map(w => [w.name, w.quantity]));

test('Ironbuilt: detected via the ironbuilt.app share link', () => {
    assert.strictEqual(detectFormat(readSample(SAMPLE)), 'IRONBUILT_V11');
});

test('Ironbuilt: detected from the "+=====" banner and "── SECTION ───" headers without the link', () => {
    const lines = readSample(SAMPLE).filter(l => !/ironbuilt/i.test(l));
    assert.strictEqual(detectFormat(lines), 'IRONBUILT_V11');
});

test('Ironbuilt: parses the header block', () => {
    const { metadata } = load();
    assert.strictEqual(metadata.armyName, 'Test');
    assert.strictEqual(metadata.faction, 'World Eaters');
    assert.deepStrictEqual(metadata.detachments, ['Berzerker Warband', 'Vessels of Wrath']);
    assert.strictEqual(metadata.detachmentPoints, 3);
    assert.deepStrictEqual(metadata.forceDispositions, ['Purge the Foe']);
    assert.strictEqual(metadata.totalPoints, 2000);
    assert.strictEqual(metadata.pointsLimit, 2000);
});

test('Ironbuilt: [WARLORD] tag, enhancements and section categories', () => {
    const data = load();
    assert.strictEqual(data.units.length, 17);

    const angron = data.units.find(u => u.name === 'Angron');
    assert.strictEqual(angron.isWarlord, true);
    assert.strictEqual(angron.points, 330);
    assert.strictEqual(angron.category, 'Characters');
    assert.strictEqual(data.units.filter(u => u.isWarlord).length, 1);

    const moe = data.units.find(u => u.name === 'Master of Executions');
    assert.deepStrictEqual(moe.enhancements, [{ name: 'Berzerker Glaive', points: 35 }]);

    assert.strictEqual(data.units.find(u => u.name === 'Khorne Berzerkers').category, 'Battleline');
    assert.strictEqual(data.units.find(u => u.name === 'Goremongers').category, 'Infantry');
    assert.strictEqual(data.units.find(u => u.name === 'Chaos Rhino').category, 'Dedicated Transports');
});

test('Ironbuilt: "➤" weapon profiles collapse into one weapon instead of double-counting', () => {
    const data = load();
    assert.deepStrictEqual(wargearOf(data.units.find(u => u.name === 'Angron')), {
        'Samni’arius and Spinegrinder': 1
    });
    assert.deepStrictEqual(wargearOf(data.units.find(u => u.name === 'Khârn the Betrayer')), {
        'Gorechild': 1,
        'Plasma pistol': 1
    });
    assert.deepStrictEqual(wargearOf(data.units.find(u => u.name === 'Khorne Berzerkers')), {
        'Bolt pistol': 7,
        'Chainblade': 8,
        'Khornate eviscerator': 2,
        'Plasma pistol': 3,
        'Icon of Khorne': 1
    });
});

test('Ironbuilt: model lines set the unit size, merging "w/ ..." loadout variants by model name', () => {
    const data = load();
    const berzerkers = data.units.find(u => u.name === 'Khorne Berzerkers');
    assert.strictEqual(berzerkers.quantity, 10);
    assert.deepStrictEqual(berzerkers.subunits.map(s => [s.name, s.quantity]), [
        ['Khorne Berzerker Champion', 1],
        ['Khorne Berzerker', 9]
    ]);

    const jakhals = data.units.find(u => u.name === 'Jakhals');
    assert.strictEqual(jakhals.quantity, 10);
    assert.deepStrictEqual(jakhals.subunits.map(s => [s.name, s.quantity]), [
        ['Jakhal Pack Leader', 1],
        ['Jakhal', 8],
        ['Dishonoured', 1]
    ]);

    const rhino = data.units.find(u => u.name === 'Chaos Rhino');
    assert.strictEqual(rhino.quantity, 1);
    assert.deepStrictEqual(wargearOf(rhino), { 'Combi-bolter': 2, 'Havoc launcher': 1, 'Armoured tracks': 1 });
});

test('Ironbuilt: renders with unit sizes and no footer leakage', () => {
    const out = generateOutput(load(), false, {}, true, skippableWargear, false);
    assert.ok(out.plainText.includes('[W] Angron'));
    assert.ok(out.plainText.includes('10 Khorne Berzerkers'));
    assert.ok(!/ironbuilt\.app|Total:/i.test(out.plainText));
});
