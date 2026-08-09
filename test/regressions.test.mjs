// Dedicated regression tests for specific bugs found and fixed this session.
// Each uses a minimal, hand-built reproduction rather than a full sample file,
// so a failure points straight at the broken behavior instead of requiring a
// diff against a 200-line fixture. See cross-format-equivalence.test.mjs for
// the broader consistency checks that originally surfaced these bugs.
import { test } from 'node:test';
import assert from 'node:assert';
import { parseNRWTCCompact, parseNRGW, parseGwAppV11, parseWarOrganV11 } from '../modules/parsers.js';

// --- New Recruit: shared header parser (parseNewRecruitHeader) ---

test('NR header: FORCE DISPOSITION is parsed (was silently dropped)', () => {
    const lines = [
        '+++++++++++++++++++++++++++++++++++++++++++++++',
        '+ FACTION KEYWORD: Chaos - World Eaters',
        '+ DETACHMENT: Berzerker Warband (Relentless Rage)',
        '+ FORCE DISPOSITION: Purge the Foe',
        '+ TOTAL ARMY POINTS: 2000pts',
        '+++++++++++++++++++++++++++++++++++++++++++++++',
        '',
        'Char1: 1x Khârn the Betrayer (115 pts): Gorechild, Plasma pistol'
    ];
    const result = parseNRWTCCompact(lines);
    assert.deepStrictEqual(result.metadata.forceDispositions, ['Purge the Foe']);
});

test('NR header: SECONDARY line no longer clobbers a previously-parsed FORCE DISPOSITION', () => {
    const lines = [
        '+++++++++++++++++++++++++++++++++++++++++++++++',
        '+ FACTION KEYWORD: Chaos - World Eaters',
        '+ DETACHMENT: Berzerker Warband (Relentless Rage)',
        '+ FORCE DISPOSITION: Purge the Foe',
        '+ TOTAL ARMY POINTS: 2000pts',
        '+ SECONDARY: - Bring It Down: (5x2) - Assassination: 4 Characters',
        '+++++++++++++++++++++++++++++++++++++++++++++++',
        '',
        'Char1: 1x Khârn the Betrayer (115 pts): Gorechild, Plasma pistol'
    ];
    const result = parseNRWTCCompact(lines);
    assert.deepStrictEqual(result.metadata.forceDispositions, ['Purge the Foe']);
});

// --- New Recruit Tournament format (nr_wtc_compact_parser.js) ---

test('NR Tournament: wargear split across multiple "N with ..." detail lines under one subunit is merged, not duplicated', () => {
    const lines = [
        '+++', '+ FACTION KEYWORD: Chaos - World Eaters', '+ TOTAL ARMY POINTS: 2000pts', '+++',
        '10x Khorne Berzerkers (170 pts)',
        '• 9x Khorne Berzerker',
        '    5 with Bolt pistol, Chainblade',
        '    2 with Bolt pistol, Khornate eviscerator',
        '    2 with Chainblade, Plasma pistol',
        '• 1x Khorne Berzerker Champion: Chainblade, Plasma pistol'
    ];
    const result = parseNRWTCCompact(lines);
    const unit = result.units.find(u => u.name === 'Khorne Berzerkers');
    const rankAndFile = unit.subunits.find(s => s.name === 'Khorne Berzerker');
    const byName = Object.fromEntries(rankAndFile.wargear.map(w => [w.name, w.quantity]));
    assert.deepStrictEqual(byName, { 'Bolt pistol': 7, 'Chainblade': 7, 'Khornate eviscerator': 2, 'Plasma pistol': 2 });
});

test('NR Tournament: inline "subunit: N with X, Y" multiplies every item by the model count, not just the first', () => {
    const lines = [
        '+++', '+ FACTION KEYWORD: Xenos - T\'au Empire', '+ TOTAL ARMY POINTS: 2000pts', '+++',
        '3x Crisis Fireknife Battlesuits (100 pts)',
        '• 2x Crisis Fireknife Shas\'ui: 2 with Gun Drone, Shield Drone, Battlesuit fists, 2x Plasma rifle'
    ];
    const result = parseNRWTCCompact(lines);
    const unit = result.units.find(u => u.name === 'Crisis Fireknife Battlesuits');
    const shasui = unit.subunits.find(s => s.name === "Crisis Fireknife Shas'ui");
    const byName = Object.fromEntries(shasui.wargear.map(w => [w.name, w.quantity]));
    assert.deepStrictEqual(byName, { 'Gun Drone': 2, 'Shield Drone': 2, 'Battlesuit fists': 2, 'Plasma rifle': 4 });
});

test('NR Tournament: unit-header inline wargear with a repeated item name is merged, not duplicated', () => {
    const lines = [
        '+++', '+ FACTION KEYWORD: Chaos - World Eaters', '+ TOTAL ARMY POINTS: 2000pts', '+++',
        '1x Chaos Rhino (75 pts): Armoured tracks, Combi-bolter, Havoc launcher, Combi-bolter'
    ];
    const result = parseNRWTCCompact(lines);
    const unit = result.units.find(u => u.name === 'Chaos Rhino');
    const byName = Object.fromEntries(unit.wargear.map(w => [w.name, w.quantity]));
    assert.deepStrictEqual(byName, { 'Armoured tracks': 1, 'Combi-bolter': 2, 'Havoc launcher': 1 });
});

// --- New Recruit GW-style format (nr_gw_parser.js) ---

test('NR GW-style: the same wargear name repeated across separate bullet lines is merged, not duplicated', () => {
    const lines = [
        '+++', '+ FACTION KEYWORD: Xenos - T\'au Empire', '+ TOTAL ARMY POINTS: 2000pts', '+++',
        '',
        'OTHER DATASHEETS',
        '',
        'Pathfinder Team (85 pts)',
        '• 1x Pathfinder Shas\'ui',
        '    • 1x Close combat weapon',
        '    • 1x Drone burst cannon',
        '    • 2x Gun Drone, Recon drone',
        '    • 1x Drone burst cannon'
    ];
    const result = parseNRGW(lines);
    const unit = result.units.find(u => u.name === 'Pathfinder Team');
    const shasui = unit.subunits.find(s => s.name === "Pathfinder Shas'ui");
    const byName = Object.fromEntries(shasui.wargear.map(w => [w.name, w.quantity]));
    assert.strictEqual(byName['Drone burst cannon'], 2);
});

// --- GW App (gwapp_v11.js) ---

test('GW App: Battleline section header is recognized (was missing from the category dictionary entirely, in every language)', () => {
    const lines = [
        'Flood of Chainblades (2000 points)', '', 'World Eaters', 'Strike Force (2000 points)', '',
        'BATTLELINE', '',
        'Khorne Berzerkers (170 points)',
        '  • 9x Khorne Berzerker',
        '    • 7x Bolt pistol'
    ];
    const result = parseGwAppV11(lines);
    const unit = result.units.find(u => u.name === 'Khorne Berzerkers');
    assert.strictEqual(unit.category, 'Battleline');
});

test('GW App: French "Transport Assigné" (singular) is recognized as Dedicated Transports', () => {
    const lines = [
        'Flood of Chainblades (2000 points)', '', 'World Eaters', 'Force de Frappe (2000 points)', '',
        'TRANSPORT ASSIGNÉ', '',
        'Chaos Rhino (75 points)',
        '  • 1x Armoured tracks'
    ];
    const result = parseGwAppV11(lines);
    const unit = result.units.find(u => u.name === 'Chaos Rhino');
    assert.strictEqual(unit.category, 'Dedicated Transports');
});

// --- War Organ (war_organ_parser.js) ---

test('WarOrgan: a randomized attachment-group name that collides with a real category word (e.g. "Character") does not misroute the whole file to Format 2', () => {
    const lines = [
        'Flood of Chainblades [2000 points]',
        'World Eaters',
        'Battle Size: Strike Force (2000 point limit)',
        '',
        'Detachments: Berzerker Warband (3/3 Detachment Points)',
        'Force Disposition: Purge The Foe',
        '',
        'Character', // War Organ's random attachment-group name, NOT the Format 2 "CHARACTER" header
        '',
        '  Slaughterbound (120 points)',
        '    • lacerator & daemonic claw'
    ];
    const result = parseWarOrganV11(lines);
    const unit = result.units.find(u => u.name === 'Slaughterbound');
    assert.ok(unit, 'Slaughterbound should be parsed as a normal unit, not swallowed by Format 2 tree parsing');
    assert.strictEqual(unit.wargear.length, 1);
    assert.strictEqual(unit.wargear[0].name, 'lacerator & daemonic claw');
});

test('WarOrgan: Force Disposition is parsed when present (optional 5th metadata line)', () => {
    const lines = [
        'R.U.D.E [2000 points]', 'Tau Empire', 'Battle Size: Strike Force (2000 point limit)', '',
        'Detachments: Retaliation Cadre (3/3 Detachment Points)',
        'Force Disposition: Purge The Foe',
        '',
        'Darkstrider (60 points)',
        '  • Close combat weapon and Shade'
    ];
    const result = parseWarOrganV11(lines);
    assert.deepStrictEqual(result.metadata.forceDispositions, ['Purge The Foe']);
    // and the body must still parse correctly with the extra line present
    assert.ok(result.units.find(u => u.name === 'Darkstrider'));
});

test('WarOrgan: fixtures WITHOUT a Force Disposition line still parse the body correctly (line is optional, not fixed-position)', () => {
    const lines = [
        'Nundams Wing [1985 points]', 'Adepta Sororitas', 'Battle Size: Strike Force (2000 point limit)', '',
        'Detachments: Chorus of Condemnation, Champions of Faith',
        '',
        'Hospitaller [75 points]',
        '\t• Bolt pistol and Chirurgeon’s tools'
    ];
    const result = parseWarOrganV11(lines);
    assert.deepStrictEqual(result.metadata.forceDispositions, []);
    assert.ok(result.units.find(u => u.name === 'Hospitaller'));
});

test('WarOrgan: detachment name is stripped of its "(N/N Detachment Points)" suffix', () => {
    const lines = [
        'R.U.D.E [2000 points]', 'Tau Empire', 'Battle Size: Strike Force (2000 point limit)', '',
        'Detachments: Retaliation Cadre (3/3 Detachment Points)',
        'Force Disposition: Purge The Foe'
    ];
    const result = parseWarOrganV11(lines);
    assert.strictEqual(result.metadata.detachment, 'Retaliation Cadre');
    assert.deepStrictEqual(result.metadata.detachments, ['Retaliation Cadre']);
});

test('WarOrgan Format 1: subunit wargear quantity is multiplied by the subunit\'s own model count', () => {
    const lines = [
        'Flood of Chainblades [2000 points]', 'World Eaters', 'Battle Size: Strike Force (2000 point limit)', '',
        'Detachments: Berzerker Warband (3/3 Detachment Points)', '',
        'Khorne Berzerkers [170 points]',
        '\t• 4 Khorne Berzerkers with Bolt pistol and Chainblade',
        '\t• 2 Khorne Berzerkers with Bolt pistol and Khornate eviscerator'
    ];
    const result = parseWarOrganV11(lines);
    const unit = result.units.find(u => u.name === 'Khorne Berzerkers');
    const totals = {};
    for (const sub of unit.subunits) {
        for (const w of sub.wargear) totals[w.name] = (totals[w.name] || 0) + w.quantity;
    }
    assert.deepStrictEqual(totals, { 'Bolt pistol': 6, 'Chainblade': 4, 'Khornate eviscerator': 2 });
});

test('WarOrgan Format 1: a drone named after its built-in weapon ("Gun drone with twin pulse carbine") collapses to the base name', () => {
    const lines = [
        'R.U.D.E [2000 points]', 'Tau Empire', 'Battle Size: Strike Force (2000 point limit)', '',
        'Detachments: Retaliation Cadre (3/3 Detachment Points)', '',
        'Crisis Sunforge Battlesuits [125 points]',
        '\t• 1 Crisis Shas\'vre with 2 Fusion blaster, Battlesuit fists and Gun drone with twin pulse carbine and shield drone'
    ];
    const result = parseWarOrganV11(lines);
    const unit = result.units.find(u => u.name === 'Crisis Sunforge Battlesuits');
    const shasvre = unit.subunits[0];
    const names = shasvre.wargear.map(w => w.name);
    assert.ok(names.includes('Gun drone'), `expected a bare "Gun drone" entry, got: ${JSON.stringify(names)}`);
    assert.ok(!names.some(n => n.includes('with')), `no wargear name should retain "with": ${JSON.stringify(names)}`);
});
