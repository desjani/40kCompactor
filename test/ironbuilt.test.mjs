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

const ATTACHED_SAMPLE = 'Ironbuilt-Sample-WE-Attached.txt';
const loadAttached = () => parseIronbuilt(readSample(ATTACHED_SAMPLE), skippableWargear);

test('Ironbuilt: "Attached Unit" groups become leader + bodyguard units', () => {
    const data = loadAttached();
    assert.strictEqual(detectFormat(readSample(ATTACHED_SAMPLE)), 'IRONBUILT_V11');
    assert.strictEqual(data.units.length, 14);
    assert.strictEqual(data.units.reduce((sum, u) => sum + u.points, 0), 2000);

    const attached = data.units.filter(u => u.isAttached);
    assert.deepStrictEqual(attached.map(u => [u.name, u.points, u.attachedParts.map(p => `${p.role}:${p.name}`)]), [
        ['Khârn the Betrayer', 285, ['Leader:Khârn the Betrayer', 'Bodyguard:Khorne Berzerkers']],
        ['Master of Executions', 265, ['Leader:Master of Executions', 'Bodyguard:Khorne Berzerkers']],
        ['Slaughterbound', 240, ['Leader:Slaughterbound', 'Bodyguard:Exalted Eightbound']]
    ]);
    assert.ok(attached.every(u => u.category === 'Attached Units'));

    const [kharn, moe, slaughterbound] = attached;
    assert.strictEqual(kharn.attachedParts[1].quantity, 10);
    assert.deepStrictEqual(moe.attachedParts[0].enhancements, [{ name: 'Berzerker Glaive', points: 35 }]);
    assert.deepStrictEqual(slaughterbound.attachedParts[0].enhancements, [{ name: 'Battle-lust', points: 20 }]);
    assert.strictEqual(slaughterbound.attachedParts[1].quantity, 3);
});

test('Ironbuilt: attached units render with [L]/[B] markers', () => {
    const out = generateOutput(loadAttached(), false, {}, true, skippableWargear, false);
    assert.ok(out.plainText.includes('[L1] Khârn the Betrayer [115]'));
    assert.ok(out.plainText.includes('[B1] 10 Khorne Berzerkers [170]'));
    assert.ok(out.plainText.includes('[B3] 3 Exalted Eightbound [130]'));
});

test('Ironbuilt: renders with unit sizes and no footer leakage', () => {
    const out = generateOutput(load(), false, {}, true, skippableWargear, false);
    assert.ok(out.plainText.includes('[W] Angron'));
    assert.ok(out.plainText.includes('10 Khorne Berzerkers'));
    assert.ok(!/ironbuilt\.app|Total:/i.test(out.plainText));
});
