// Fixtures using War Organ's real canonical-category export style (ALL-CAPS
// CHARACTER/BATTLELINE/DEDICATED TRANSPORTS headers), distinct from the
// randomized-attachment-group-name style covered by the newer Test-* samples
// and regression tests. Kept because it's the only coverage we have for
// War Organ's Format 2 (indented tree) parsing path.
import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseWarOrganV11 } from '../modules/parsers.js';
import { readSample } from './helpers.mjs';

test('War Organ SOB1 (Format 1: flat "with" style)', () => {
    const lines = readSample('WO-Sample-SOB1.txt');
    assert.strictEqual(detectFormat(lines), 'WAR_ORGAN_V11');

    const parsed = parseWarOrganV11(lines);
    assert.strictEqual(parsed.edition, '11th');
    assert.strictEqual(parsed.metadata.title, 'Nundams Wing');
    assert.strictEqual(parsed.metadata.pointsTotal, 1985);
    assert.strictEqual(parsed.metadata.faction, 'Adepta Sororitas');
    assert.strictEqual(parsed.metadata.battleSize, 'Strike Force');
    assert.strictEqual(parsed.metadata.pointsLimit, 2000);
    assert.deepStrictEqual(parsed.metadata.detachments, ['Chorus of Condemnation', 'Champions of Faith']);

    const canoness = parsed.units.find(u => u.name === 'Canoness With Jump Pack' && u.points === 85);
    assert.ok(canoness, 'Should find 85-point Canoness');
    assert.strictEqual(canoness.category, 'Characters');
    assert.strictEqual(canoness.wargear.length, 1);
    assert.strictEqual(canoness.wargear[0].name, 'Blessed halberd');
    assert.strictEqual(canoness.enhancements.length, 1);
    assert.strictEqual(canoness.enhancements[0].name, 'Eyes of the oracle');
    assert.strictEqual(canoness.enhancements[0].points, 10);

    const sacresants = parsed.units.find(u => u.name === 'Celestian Sacresants');
    assert.ok(sacresants, 'Should find Celestian Sacresants');
    assert.strictEqual(sacresants.subunits.length, 2);
    assert.strictEqual(sacresants.subunits[0].name, 'Sacresant Superior');
    assert.strictEqual(sacresants.subunits[0].quantity, 1);
    assert.ok(sacresants.subunits[0].wargear.some(w => w.name === 'Spear of the faithful'));
    assert.strictEqual(sacresants.subunits[1].name, 'Celestian Sacresants');
    assert.strictEqual(sacresants.subunits[1].quantity, 9);
});

test('War Organ SOB2 (Format 2: indented tree, canonical ALL-CAPS category headers)', () => {
    const lines = readSample('WO-Sample-SOB2.txt');
    assert.strictEqual(detectFormat(lines), 'WAR_ORGAN_V11');

    const parsed = parseWarOrganV11(lines);
    assert.strictEqual(parsed.metadata.title, 'Nundams Wing');
    assert.strictEqual(parsed.metadata.pointsTotal, 1985);
    assert.strictEqual(parsed.metadata.faction, 'Adepta Sororitas');

    const canoness = parsed.units.find(u => u.name === 'Canoness With Jump Pack' && u.points === 85);
    assert.ok(canoness, 'Should find 85-point Canoness in SOB2');
    assert.strictEqual(canoness.category, 'Characters');
    assert.strictEqual(canoness.wargear.length, 1);
    assert.strictEqual(canoness.wargear[0].name, 'Blessed halberd');
    assert.strictEqual(canoness.enhancements.length, 1);
    assert.strictEqual(canoness.enhancements[0].name, 'Eyes of The Oracle');

    const sacresants = parsed.units.find(u => u.name === 'Celestian Sacresants');
    assert.ok(sacresants, 'Should find Celestian Sacresants in SOB2');
    assert.strictEqual(sacresants.category, 'Other Datasheets');
    assert.strictEqual(sacresants.subunits.length, 2);
    assert.strictEqual(sacresants.subunits[0].name, 'Sacresant Superior');
    assert.strictEqual(sacresants.subunits[0].quantity, 1);
    assert.ok(sacresants.subunits[0].wargear.some(w => w.name === 'Spear of The Faithful'));
    assert.strictEqual(sacresants.subunits[1].name, 'Celestian Sacresants');
    assert.strictEqual(sacresants.subunits[1].quantity, 9);
});

test('War Organ AM1 (Format 1: flat "with" style)', () => {
    const lines = readSample('WO-Sample-AM1.txt');
    assert.strictEqual(detectFormat(lines), 'WAR_ORGAN_V11');

    const parsed = parseWarOrganV11(lines);
    assert.strictEqual(parsed.metadata.title, 'Fire Teams');
    assert.strictEqual(parsed.metadata.pointsTotal, 2000);
    assert.strictEqual(parsed.metadata.faction, 'Astra Militarum');

    const commander = parsed.units.find(u => u.name === 'Leman Russ Commander');
    assert.ok(commander, 'Should find Leman Russ Commander in AM1');
    assert.strictEqual(commander.points, 260);
    assert.strictEqual(commander.enhancements.length, 1);
    assert.strictEqual(commander.enhancements[0].name, 'Grand strategist');
    assert.strictEqual(commander.enhancements[0].points, 25);
    assert.ok(commander.wargear.some(w => w.name === 'Multi-meltas' && w.quantity === 2));
});

test('War Organ AM2 (Format 2: indented tree, canonical ALL-CAPS category headers)', () => {
    const lines = readSample('WO-Sample-AM2.txt');
    assert.strictEqual(detectFormat(lines), 'WAR_ORGAN_V11');

    const parsed = parseWarOrganV11(lines);
    assert.strictEqual(parsed.metadata.title, 'Fire Teams');
    assert.strictEqual(parsed.metadata.pointsTotal, 2000);
    assert.strictEqual(parsed.metadata.faction, 'Astra Militarum');

    const commander = parsed.units.find(u => u.name === 'Leman Russ Commander');
    assert.ok(commander, 'Should find Leman Russ Commander in AM2');
    assert.strictEqual(commander.category, 'Characters');
    assert.strictEqual(commander.enhancements.length, 1);
    assert.strictEqual(commander.enhancements[0].name, 'Grand Strategist');
    assert.ok(commander.wargear.some(w => w.name === 'Multi-meltas' && w.quantity === 2));

    const cmdSquad = parsed.units.find(u => u.name === 'Militarum Tempestus Command Squad' && u.points === 100);
    assert.ok(cmdSquad, 'Should find 100-point Tempestus Command Squad in AM2');
    assert.strictEqual(cmdSquad.category, 'Characters');
    assert.strictEqual(cmdSquad.isWarlord, true);
    assert.strictEqual(cmdSquad.enhancements.length, 1);
    assert.strictEqual(cmdSquad.enhancements[0].name, 'Bombast-class Vox-array');
    assert.strictEqual(cmdSquad.subunits.length, 2);
    assert.strictEqual(cmdSquad.subunits[0].name, 'Tempestor Prime');
    assert.strictEqual(cmdSquad.subunits[0].quantity, 1);
    assert.ok(cmdSquad.subunits[0].wargear.some(w => w.name === 'Tempestus Dagger'));
    assert.strictEqual(cmdSquad.subunits[1].name, 'Tempestus Scions');
    assert.strictEqual(cmdSquad.subunits[1].quantity, 4);
});
