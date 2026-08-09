import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseGwAppV11 } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';
import { generateCardHtml, estimateCardWidth } from '../modules/cardRenderer.js';
import { readSample, skippableWargear } from './helpers.mjs';

function loadTau() {
    const lines = readSample('Test-TAU-GWAPP-English');
    return parseGwAppV11(lines, skippableWargear);
}

function loadWorldEaters() {
    const lines = readSample('Test-WE-GWAPP-English');
    return parseGwAppV11(lines, skippableWargear);
}

test('GW App: parses metadata and Attached Units (leader/bodyguard roles, warlord, enhancement)', () => {
    const data = loadTau();
    assert.strictEqual(data.metadata.armyName, 'R.U.D.E.');
    assert.strictEqual(data.metadata.faction, 'T’au Empire');
    assert.strictEqual(data.metadata.totalPoints, 2000);
    assert.strictEqual(data.metadata.detachmentPoints, 3);
    assert.deepStrictEqual(data.metadata.forceDispositions, ['Purge the Foe']);

    const attached1 = data.units.find(u => u.name === 'Attached Unit 1');
    assert.ok(attached1, 'Should parse Attached Unit 1');
    assert.strictEqual(attached1.isAttached, true);
    assert.strictEqual(attached1.attachedParts.length, 2);
    assert.strictEqual(attached1.points, 195); // 70 (Farsight) + 125 (Sunforge)

    const farsight = attached1.attachedParts[0];
    assert.strictEqual(farsight.name, 'Commander Farsight');
    assert.strictEqual(farsight.role, 'Leader');
    assert.strictEqual(farsight.isWarlord, true);
    assert.deepStrictEqual(farsight.wargear, [
        { name: 'Dawn Blade', quantity: 1, skippable: true },
        { name: 'High-intensity plasma rifle', quantity: 1, skippable: true }
    ]);

    const sunforge = attached1.attachedParts[1];
    assert.strictEqual(sunforge.name, 'Crisis Sunforge Battlesuits');
    assert.strictEqual(sunforge.role, 'Bodyguard');
    assert.strictEqual(sunforge.subunits.length, 2);
    assert.strictEqual(sunforge.subunits[0].name, 'Crisis Sunforge Shas’vre');
    assert.strictEqual(sunforge.subunits[0].quantity, 1);

    const attached2 = data.units.find(u => u.name === 'Attached Unit 2');
    const enforcer = attached2.attachedParts[0];
    assert.strictEqual(enforcer.enhancements.length, 1);
    assert.strictEqual(enforcer.enhancements[0].name, 'Starflare Ignition System');
});

test('GW App: comma-separated multiple Force Dispositions, thousands-separated points, and lowercase "Attached unit" headers', () => {
    const lines = readSample('GWAPP-Sample-Alternate.txt');
    assert.strictEqual(detectFormat(lines), 'GW_APP_V11');

    const parsed = parseGwAppV11(lines, skippableWargear);
    assert.strictEqual(parsed.metadata.totalPoints, 1990);
    assert.deepStrictEqual(parsed.metadata.detachments, ['Advanced Acquisition Cadre', 'Retaliation Cadre']);
    assert.deepStrictEqual(parsed.metadata.forceDispositions, ['Purge the Foe', 'Reconnaissance']);

    const attached1 = parsed.units.find(u => u.name === 'Attached Unit 1');
    assert.ok(attached1, 'Should parse lowercase "Attached unit 1" header');
    assert.strictEqual(attached1.attachedParts.length, 2);
});

test('GW App: Imperial Knights list parses correctly (single-model units, enhancements)', () => {
    const lines = readSample('GWAPP-Sample-ImperialKnights');
    assert.strictEqual(detectFormat(lines), 'GW_APP_V11');

    const parsed = parseGwAppV11(lines, skippableWargear);
    assert.strictEqual(parsed.metadata.armyName, 'QC');
    assert.strictEqual(parsed.metadata.faction, 'Imperial Knights');

    const castigator = parsed.units.find(u => u.name === 'Cerastus Knight Castigator');
    assert.ok(castigator);
    assert.deepStrictEqual(castigator.wargear, [
        { name: 'Castigator bolt cannon', quantity: 1, skippable: true },
        { name: 'Tempest warblade', quantity: 1, skippable: true }
    ]);

    const lancer = parsed.units.find(u => u.name === 'Cerastus Knight Lancer');
    assert.ok(lancer);
    assert.strictEqual(lancer.enhancements[0].name, 'Pennant of Silvered Fury');
});

test('GW App rendering: mandatory (skippable) wargear toggle rolls up correctly with subunits hidden', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);

    const mandatoryHidden = generateOutput(data, true, abbrIndex, true, skippableWargear, false, false, false, false, false, false);
    assert.ok(mandatoryHidden.plainText.includes('[B1] 3 Crisis Sunforge Battlesuits (3x GD, 3x SD) [125]'));

    const mandatoryShown = generateOutput(data, true, abbrIndex, true, skippableWargear, false, false, false, false, false, true);
    assert.ok(mandatoryShown.plainText.includes('[B1] 3 Crisis Sunforge Battlesuits (6x FB, 3x BF, 3x GD, 3x SD) [125]'));
});

test('GW App rendering: subunits with 100% skippable wargear are hidden even when hideSubunits is false', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);

    const out = generateOutput(data, true, abbrIndex, false, skippableWargear, false, false, false, false, false, false);
    assert.ok(!out.plainText.includes('Ri’Lantar'), 'Ri’Lantar subunit should be hidden (100% skippable wargear)');
    assert.ok(!out.plainText.includes('Ri’Locai'), 'Ri’Locai subunit should be hidden (100% skippable wargear)');
    assert.ok(out.plainText.includes('Crisis Sunforge Shas’vre'), 'Crisis Sunforge Shas’vre subunit should still be shown');

    const cardHtml = generateCardHtml(data, { hideSubunits: false, useAbbreviations: true, wargearAbbrMap: abbrIndex });
    assert.ok(!cardHtml.includes('Ri’Lantar'), 'Ri’Lantar subunit should be hidden in card HTML too');
    assert.ok(cardHtml.includes('Crisis Sunforge Shas’vre'), 'Crisis Sunforge Shas’vre subunit should still be shown in card HTML');
});

test('GW App rendering: abbreviateHeader and abbreviateUnitNames options', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);

    const abbrHeaderOut = generateOutput(data, true, abbrIndex, false, {}, false, false, false, false, true, false);
    assert.ok(abbrHeaderOut.plainText.includes('RC'), 'Detachment should be abbreviated to RC');
    assert.ok(abbrHeaderOut.plainText.includes('PtF'), 'Force disposition should be abbreviated to PtF');

    const abbrUnitNamesOut = generateOutput(data, true, abbrIndex, false, {}, false, false, false, false, false, false, undefined, true);
    assert.ok(abbrUnitNamesOut.plainText.includes('CF'), 'Commander Farsight should be abbreviated to CF');
});

test('GW App rendering: custom abbreviations apply despite straight/curly apostrophe mismatch', () => {
    const data = loadTau();
    const customAbbrs = {
        "crisis sunforge shas'ui": "Shas'ui",
        "crisis sunforge shas'vre": "Shas'vre"
    };
    const customAbbrIndex = buildAbbreviationIndex(data, customAbbrs);
    const out = generateOutput(data, true, customAbbrIndex, false, {}, false, false, false, false, false, false, undefined, true);
    assert.ok(out.plainText.includes("Shas'ui"), 'Should use custom abbreviation despite apostrophe mismatch');
    assert.ok(out.plainText.includes("Shas'vre"), 'Should use custom abbreviation despite apostrophe mismatch');
});

test('GW App rendering: hide-all wargear mode hides every wargear abbreviation', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);
    const out = generateOutput(data, true, abbrIndex, false, {}, false, false, false, false, false, false, 'hide-all');
    assert.ok(!out.plainText.includes('FB'), 'Should hide Fusion Blaster in hide-all mode');
    assert.ok(!out.plainText.includes('DB'), 'Should hide Dawn Blade in hide-all mode');
});

test('GW App rendering: hideBrackets option strips brackets/parentheses', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);
    const out = generateOutput(data, true, abbrIndex, false, {}, false, false, false, false, false, false, undefined, false, true);
    assert.ok(out.plainText.includes('L1W Commander Farsight'), 'Should hide brackets around leader/warlord tags');
    assert.ok(!out.plainText.includes('[L1]'));
});

test('GW App rendering: Discord ANSI color output (faction and custom modes)', () => {
    const data = loadTau();
    const abbrIndex = buildAbbreviationIndex(data);

    const factionColorsOut = generateDiscordText(data, false, true, abbrIndex, false, {}, false, { colorMode: 'faction' });
    assert.ok(/\[1;3\dm\[L1\]/.test(factionColorsOut), 'Should color the [L1] attached tag with an ANSI faction color code');

    const customColorsOut = generateDiscordText(data, false, true, abbrIndex, false, {}, false, {
        colorMode: 'custom',
        colors: { attached: '#00FF00' }
    });
    assert.ok(customColorsOut.includes('1;32m[L1]'), 'Should color the [L1] tag green (32) for a custom #00FF00 color');

    const discordHideBrackets = generateDiscordText(data, false, true, abbrIndex, false, {}, false, { hideBrackets: true });
    assert.ok(discordHideBrackets.includes('L1W Commander Farsight'));
    assert.ok(!discordHideBrackets.includes('[L1]'));
});

test('GW App rendering: combining identical units (normal and attached)', () => {
    const weData = loadWorldEaters();
    const weAbbr = buildAbbreviationIndex(weData);

    const uncombined = generateOutput(weData, false, weAbbr, false, skippableWargear, false, false, false, false, false, false);
    assert.ok(uncombined.plainText.includes('• 2 Chaos Spawn'), 'Uncombined Chaos Spawn should show model count without x');
    assert.ok(!uncombined.plainText.includes('• 2x Chaos Spawn'));

    const combined = generateOutput(weData, false, weAbbr, false, skippableWargear, false, true, false, false, false, false);
    assert.ok(combined.plainText.includes('2x Chaos Rhino'), 'Should combine identical Chaos Rhinos');
    assert.ok(combined.plainText.includes('2x2 Chaos Spawn'), 'Should combine identical Chaos Spawns');

    // Attached-unit combining, using a minimal hand-built mock (isolates the combining
    // logic from any one source format's parsing quirks).
    const mockList = {
        metadata: { faction: 'World Eaters' },
        units: [
            {
                name: 'Attached Unit 1', isAttached: true, points: 295,
                attachedParts: [
                    { name: 'Khârn the Betrayer', quantity: 1, points: 115 },
                    { name: 'Khorne Berzerkers', quantity: 10, points: 180 }
                ]
            },
            {
                name: 'Attached Unit 2', isAttached: true, points: 295,
                attachedParts: [
                    { name: 'Khârn the Betrayer', quantity: 1, points: 115 },
                    { name: 'Khorne Berzerkers', quantity: 10, points: 180 }
                ]
            }
        ]
    };
    const combinedMock = generateOutput(mockList, false, {}, false, {}, false, true, false, false, false, false);
    assert.ok(combinedMock.plainText.includes('2x Khârn the Betrayer'));
    assert.ok(combinedMock.plainText.includes('2x10 Khorne Berzerkers'));

    const cardHtml = generateCardHtml(mockList, { combineIdenticalUnits: true });
    assert.ok(cardHtml.includes('2x Khârn the Betrayer'));
    assert.ok(cardHtml.includes('2x10 Khorne Berzerkers'));
});

test('GW App card rendering: dynamic width estimation and inline abbreviated wargear layout', () => {
    const mockList = {
        metadata: { faction: 'World Eaters' },
        units: [{
            name: 'Attached Unit 1', isAttached: true, points: 295,
            attachedParts: [
                { name: 'Khârn the Betrayer', quantity: 1, points: 115 },
                { name: 'Khorne Berzerkers', quantity: 10, points: 180 }
            ]
        }]
    };
    const narrowWidth = estimateCardWidth(mockList, { useAbbreviations: true });
    assert.ok(narrowWidth < 580, `Estimated width for an abbreviated list should be narrow: ${narrowWidth}`);

    const wargearMock = {
        metadata: { faction: 'World Eaters' },
        units: [{
            name: 'Khorne Berzerkers', quantity: 10, points: 180,
            wargear: [
                { name: 'Khorne Berzerker Chainblade', quantity: 10, skippable: false },
                { name: 'Bolt Pistol', quantity: 10, skippable: true }
            ]
        }]
    };
    const abbrCardHtml = generateCardHtml(wargearMock, { useAbbreviations: true });
    assert.ok(abbrCardHtml.includes('Khorne Berzerkers'));
    assert.ok(abbrCardHtml.includes('10x KBC'), 'Should render wargear as an inline abbreviated bubble');
    assert.ok(!abbrCardHtml.includes('padding: 3px 8px;'), 'Should not render separate detail badges in abbreviated mode');
});
