import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

import { detectFormat, parseV11List, parseGwAppV11 } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateDiscordText, generateOutput } from '../modules/renderers.js';
import { generateCardHtml } from '../modules/cardRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const skippablePath = path.join(__dirname, '../skippable_wargear.json');
const skippableWargear = JSON.parse(fs.readFileSync(skippablePath, 'utf8'));

console.log('Running 11th Edition Compactor Test Suite...');

// Helper to run generic parser tests
function runGenericTests() {
    console.log('\n--- Running Generic v11 Parser Tests ---');
    const samplePath = path.join(__dirname, '../samples/V11Sample.txt');
    const sampleText = fs.readFileSync(samplePath, 'utf8');
    const lines = sampleText.split(/\r?\n/);

    const detected = detectFormat(lines);
    assert.strictEqual(detected, 'V11_GENERIC', 'Should detect generic sample list');
    console.log('✓ Detection passed');

    const parsed = parseV11List(lines, skippableWargear);
    assert.strictEqual(parsed.edition, '11th');
    assert.strictEqual(parsed.metadata.title, '11th Edition Army List');
    assert.strictEqual(parsed.metadata.faction, 'Space Marines');
    assert.strictEqual(parsed.metadata.pointsTotal, 1990);
    assert.strictEqual(parsed.units.length, 4);
    console.log('✓ Parsing passed');

    const abbrIndex = buildAbbreviationIndex(parsed);
    assert.strictEqual(abbrIndex.__flat_abbr['relic weapon'], 'RW');
    console.log('✓ Abbreviations passed');

    const htmlOut = generateOutput(parsed, true, abbrIndex, false, {}, false, false, false, false);
    assert.ok(htmlOut.plainText.includes('Captain in Terminator Armour (E: AA (+10), RW, SB) [95]'));
    console.log('✓ Rendering passed');
}

// Helper to run GW App parser tests
function runGwAppTests() {
    console.log('\n--- Running GW App v11 Parser Tests ---');
    
    // 1. T'au Empire List
    console.log('Testing T\'au Empire GW App list...');
    const tauPath = path.join(__dirname, '../samples/GWAPP-Sample-Tau.txt');
    const tauText = fs.readFileSync(tauPath, 'utf8');
    const tauLines = tauText.split(/\r?\n/);

    const detectedTau = detectFormat(tauLines);
    assert.strictEqual(detectedTau, 'GW_APP_V11');

    const parsedTau = parseGwAppV11(tauLines, skippableWargear);
    assert.strictEqual(parsedTau.metadata.armyName, 'Retaliation + AAC Mass suits');
    assert.strictEqual(parsedTau.metadata.faction, 'T’au Empire');
    assert.strictEqual(parsedTau.metadata.totalPoints, 2000);
    assert.deepStrictEqual(parsedTau.metadata.detachments, ['Advanced Acquisition Cadre', 'Retaliation Cadre']);
    assert.strictEqual(parsedTau.metadata.detachmentPoints, 3);
    assert.deepStrictEqual(parsedTau.metadata.forceDispositions, ['Purge the Foe']);

    // Check attached unit group
    const attached1 = parsedTau.units.find(u => u.name === 'Attached Unit 1');
    assert.ok(attached1, 'Should parse Attached Unit 1');
    assert.strictEqual(attached1.isAttached, true);
    assert.strictEqual(attached1.attachedParts.length, 2);
    assert.strictEqual(attached1.points, 205); // 80 (Farsight) + 125 (Sunforge)

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
    assert.strictEqual(sunforge.subunits[0].wargear.length, 4);

    // 2. World Eaters List
    console.log('Testing World Eaters GW App list...');
    const wePath = path.join(__dirname, '../samples/GWAPP-Sample-WorldEaters.txt');
    const weText = fs.readFileSync(wePath, 'utf8');
    const weLines = weText.split(/\r?\n/);

    const detectedWe = detectFormat(weLines);
    assert.strictEqual(detectedWe, 'GW_APP_V11');

    const parsedWe = parseGwAppV11(weLines, skippableWargear);
    assert.strictEqual(parsedWe.metadata.armyName, 'Khaaaarn!');
    assert.strictEqual(parsedWe.metadata.totalPoints, 1995);
    assert.strictEqual(parsedWe.metadata.faction, 'World Eaters');
    
    const daemonPrince = parsedWe.units.find(u => u.name === 'Daemon Prince of Khorne');
    assert.ok(daemonPrince);
    assert.strictEqual(daemonPrince.isWarlord, true);
    assert.strictEqual(daemonPrince.enhancements.length, 1);
    assert.strictEqual(daemonPrince.enhancements[0].name, 'Favoured of Khorne');
    assert.deepStrictEqual(daemonPrince.wargear, [
        { name: 'Hellforged weapons', quantity: 1, skippable: true },
        { name: 'Infernal cannon', quantity: 1, skippable: true }
    ]);

    // 3. Imperial Knights List
    console.log('Testing Imperial Knights GW App list...');
    const ikPath = path.join(__dirname, '../samples/GWAPP-Sample-ImperialKnights');
    const ikText = fs.readFileSync(ikPath, 'utf8');
    const ikLines = ikText.split(/\r?\n/);

    const detectedIk = detectFormat(ikLines);
    assert.strictEqual(detectedIk, 'GW_APP_V11');

    const parsedIk = parseGwAppV11(ikLines, skippableWargear);
    assert.strictEqual(parsedIk.metadata.armyName, 'QC');
    assert.strictEqual(parsedIk.metadata.faction, 'Imperial Knights');
    
    const castigator = parsedIk.units.find(u => u.name === 'Cerastus Knight Castigator');
    assert.ok(castigator);
    assert.deepStrictEqual(castigator.wargear, [
        { name: 'Castigator bolt cannon', quantity: 1, skippable: true },
        { name: 'Tempest warblade', quantity: 1, skippable: true }
    ]);

    const lancer = parsedIk.units.find(u => u.name === 'Cerastus Knight Lancer');
    assert.ok(lancer);
    assert.strictEqual(lancer.enhancements[0].name, 'Pennant of Silvered Fury');

    console.log('✓ GW App v11 parsing tests passed');

    // 4. Rendering Tests for GW App list
    console.log('Testing GW App list rendering output...');
    const abbrIndex = buildAbbreviationIndex(parsedTau);
    const htmlOut = generateOutput(parsedTau, true, abbrIndex, false, {}, false, false, false, false, false, false);
    
    // Verify compact attached units format (default: showMandatoryWargear = false, hideSubunits = false)
    assert.ok(htmlOut.html.includes('Commander Farsight'), 'HTML output should contain Farsight');
    assert.ok(htmlOut.plainText.includes('Commander Farsight'), 'PlainText output should contain Farsight');
    assert.ok(htmlOut.plainText.includes('[L1][W] Commander Farsight [80]'), 'Should render Leader+Warlord part of attached unit without mandatory wargear');
    assert.ok(htmlOut.plainText.includes('[B1] Crisis Sunforge Battlesuits [125]'), 'Should render Bodyguard part of attached unit without inline wargear');
    assert.ok(htmlOut.plainText.includes('* Crisis Sunforge Shas’vre (2x FB, MD, SD)'), 'Should render subunit 1 inline wargear');
    assert.ok(htmlOut.plainText.includes('* 2 Crisis Sunforge Shas’ui (4x FB, 2x GD, 2x SD)'), 'Should render subunit 2 inline wargear');

    // Verify compact attached units format when showMandatoryWargear = true, hideSubunits = false
    const htmlOutWithMandatory = generateOutput(parsedTau, true, abbrIndex, false, {}, false, false, false, false, false, true);
    assert.ok(htmlOutWithMandatory.plainText.includes('[L1][W] Commander Farsight (DB, HIPR) [80]'), 'Should render Leader+Warlord part with mandatory wargear');
    assert.ok(htmlOutWithMandatory.plainText.includes('[B1] Crisis Sunforge Battlesuits [125]'), 'Should render Bodyguard part without inline wargear');
    assert.ok(htmlOutWithMandatory.plainText.includes('* Crisis Sunforge Shas’vre (BF, 2x FB, MD, SD)'), 'Should render subunit 1 inline wargear with mandatory');
    assert.ok(htmlOutWithMandatory.plainText.includes('* 2 Crisis Sunforge Shas’ui (2x BF, 4x FB, 2x GD, 2x SD)'), 'Should render subunit 2 inline wargear with mandatory');

    // Verify compact attached units format when hideSubunits = true, showMandatoryWargear = false
    const htmlOutHiddenSubunits = generateOutput(parsedTau, true, abbrIndex, true, {}, false, false, false, false, false, false);
    assert.ok(htmlOutHiddenSubunits.plainText.includes('[B1] Crisis Sunforge Battlesuits (6x FB, 3x SD, 2x GD, MD) [125]'), 'Should roll up wargear to unit level and not double-multiply quantities');
    assert.ok(!htmlOutHiddenSubunits.plainText.includes('Crisis Sunforge Shas’vre'), 'Should not show subunit lines');

    // Verify compact attached units format when hideSubunits = true, showMandatoryWargear = true
    const htmlOutHiddenSubunitsWithMandatory = generateOutput(parsedTau, true, abbrIndex, true, {}, false, false, false, false, false, true);
    assert.ok(htmlOutHiddenSubunitsWithMandatory.plainText.includes('[B1] Crisis Sunforge Battlesuits (6x FB, 3x BF, 3x SD, 2x GD, MD) [125]'), 'Should roll up all wargear including mandatory to unit level');

    // Verify extended attached units format (always showing all wargear by passing true as the 11th param)
    const fullOut = generateOutput(parsedTau, false, abbrIndex, false, {}, false, false, false, false, false, true);
    assert.ok(fullOut.plainText.includes('[L1][W] Commander Farsight [80]'), 'Extended should render Leader+Warlord prefix');
    assert.ok(fullOut.plainText.includes('[B1] Crisis Sunforge Battlesuits [125]'), 'Extended should render Bodyguard prefix');

    // Verify abbreviateHeader option
    const abbrHeaderOut = generateOutput(parsedTau, true, abbrIndex, false, {}, false, false, false, false, true, false);
    assert.ok(abbrHeaderOut.plainText.includes('AAC & RC'), 'Header detachments should be abbreviated to AAC & RC');
    assert.ok(abbrHeaderOut.plainText.includes('PtF'), 'Header force dispositions should be abbreviated to PtF');
    console.log('✓ GW App v11 header abbreviation option passed');

    // 5. Discord Text Colors Test
    console.log('Testing Discord ANSI color output...');
    const factionColorsOut = generateDiscordText(parsedTau, false, true, abbrIndex, false, {}, false, { colorMode: 'faction' });
    assert.ok(factionColorsOut.includes('1;35m[L1]'), 'Should color Farsight attached tag with faction attached color (magenta = 35)');

    const customColorsOut = generateDiscordText(parsedTau, false, true, abbrIndex, false, {}, false, {
        colorMode: 'custom',
        colors: { attached: '#00FF00' } // Green = 32
    });
    assert.ok(customColorsOut.includes('1;32m[L1]'), 'Should color Farsight attached tag with custom attached color (green = 32)');
    console.log('✓ Discord ANSI color output tests passed');

    // 6. Unit Combining Tests (both normal and attached)
    console.log('Testing Unit Combining option (including attached units)...');
    
    // Normal unit combining check on World Eaters list
    const weAbbr = buildAbbreviationIndex(parsedWe);
    const combinedWe = generateOutput(parsedWe, false, weAbbr, false, {}, false, true, false, false, false, false);
    assert.ok(combinedWe.plainText.includes('2x1 Chaos Rhino'), 'Should combine identical Chaos Rhinos');
    assert.ok(combinedWe.plainText.includes('2x1 Chaos Spawn'), 'Should combine identical Chaos Spawns');

    // Attached unit combining check using mocked identical attached units
    const mockList = {
        metadata: { faction: 'World Eaters' },
        units: [
            {
                name: 'Attached Unit 1',
                isAttached: true,
                points: 295,
                attachedParts: [
                    { name: 'Khârn the Betrayer', quantity: 1, points: 115 },
                    { name: 'Khorne Berzerkers', quantity: 10, points: 180 }
                ]
            },
            {
                name: 'Attached Unit 2',
                isAttached: true,
                points: 295,
                attachedParts: [
                    { name: 'Khârn the Betrayer', quantity: 1, points: 115 },
                    { name: 'Khorne Berzerkers', quantity: 10, points: 180 }
                ]
            }
        ]
    };
    const combinedMock = generateOutput(mockList, false, {}, false, {}, false, true, false, false, false, false);
    assert.ok(combinedMock.plainText.includes('2x1 Khârn the Betrayer'), 'Should render 2x1 for combined leader in text mode');
    assert.ok(combinedMock.plainText.includes('2x10 Khorne Berzerkers'), 'Should render 2x10 for combined bodyguard in text mode');

    // HTML/Card rendering combining check
    const cardHtml = generateCardHtml(mockList, { combineIdenticalUnits: true });
    assert.ok(cardHtml.includes('2x1 Khârn the Betrayer'), 'HTML should render 2x1 Khârn the Betrayer');
    assert.ok(cardHtml.includes('2x10 Khorne Berzerkers'), 'HTML should render 2x10 Khorne Berzerkers');
    console.log('✓ Unit combining tests passed');

    console.log('✓ GW App v11 rendering tests passed');
}

runGenericTests();
runGwAppTests();
console.log('\nAll 11th Edition tests completed and PASSED!');
