import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

import { detectFormat, parseV11List, parseGwAppV11, parseWarOrganV11 } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateDiscordText, generateOutput } from '../modules/renderers.js';
import { generateCardHtml, estimateCardWidth } from '../modules/cardRenderer.js';
import { getCanonicalFactionName } from '../modules/utils.js';

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

    // Verify compact attached units format when hideSubunits = false, wargearShowMode = 'hide-all'
    const htmlOutHideAllWargear = generateOutput(parsedTau, true, abbrIndex, false, {}, false, false, false, false, false, false, 'hide-all');
    assert.ok(!htmlOutHideAllWargear.plainText.includes('FB'), 'Should hide all wargear in hide-all mode (e.g. Fusion Blaster)');
    assert.ok(!htmlOutHideAllWargear.plainText.includes('DB'), 'Should hide all wargear in hide-all mode (e.g. Dawn Blade)');


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
    const uncombinedWe = generateOutput(parsedWe, false, weAbbr, false, {}, false, false, false, false, false, false);
    assert.ok(uncombinedWe.plainText.includes('• 2 Chaos Spawn'), 'Uncombined Chaos Spawn should show model count without x');
    assert.ok(!uncombinedWe.plainText.includes('• 2x Chaos Spawn'), 'Uncombined Chaos Spawn unit header should not show x');

    const combinedWe = generateOutput(parsedWe, false, weAbbr, false, {}, false, true, false, false, false, false);
    assert.ok(combinedWe.plainText.includes('2x Chaos Rhino'), 'Should combine identical Chaos Rhinos');
    assert.ok(combinedWe.plainText.includes('2x2 Chaos Spawn'), 'Should combine identical Chaos Spawns');

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
    assert.ok(combinedMock.plainText.includes('2x Khârn the Betrayer'), 'Should render 2x for combined leader in text mode');
    assert.ok(combinedMock.plainText.includes('2x10 Khorne Berzerkers'), 'Should render 2x10 for combined bodyguard in text mode');

    // HTML/Card rendering combining check
    const cardHtml = generateCardHtml(mockList, { combineIdenticalUnits: true });
    assert.ok(cardHtml.includes('2x Khârn the Betrayer'), 'HTML should render 2x Khârn the Betrayer');
    assert.ok(cardHtml.includes('2x10 Khorne Berzerkers'), 'HTML should render 2x10 Khorne Berzerkers');

    // Dynamic width & Inline wargear in abbreviated mode checks
    console.log('Testing dynamic card width estimation...');
    const narrowWidth = estimateCardWidth(mockList, { useAbbreviations: true });
    assert.ok(narrowWidth < 580, `Estimated width for abbreviated list should be narrow: ${narrowWidth}`);

    console.log('Testing inline wargear layout for abbreviated mode...');
    const weAbbrMock = {
        metadata: { faction: 'World Eaters' },
        units: [
            {
                name: 'Khorne Berzerkers',
                quantity: 10,
                points: 180,
                wargear: [
                    { name: 'Khorne Berzerker Chainblade', quantity: 10, skippable: false },
                    { name: 'Bolt Pistol', quantity: 10, skippable: true }
                ]
            }
        ]
    };
    const abbrCardHtml = generateCardHtml(weAbbrMock, { useAbbreviations: true });
    assert.ok(abbrCardHtml.includes('Khorne Berzerkers'), 'Should render unit name');
    assert.ok(abbrCardHtml.includes('10x KBC'), 'Should render wargear as inline bubble');
    assert.ok(!abbrCardHtml.includes('padding: 3px 8px;'), 'Should not render separate detail badges in abbreviated mode');
    console.log('✓ Dynamic width and inline abbreviated layout tests passed');

    console.log('✓ GW App v11 rendering tests passed');
}

// Helper to run French GW App parser tests
function runFrenchTests() {
    console.log('\n--- Running French GW App v11 Parser Tests ---');
    const frenchPath = path.join(__dirname, '../samples/GWAPP-Sample-French.txt');
    const frenchText = fs.readFileSync(frenchPath, 'utf8');
    const frenchLines = frenchText.split(/\r?\n/);

    const detected = detectFormat(frenchLines);
    assert.strictEqual(detected, 'GW_APP_V11', 'Should detect French sample list as GW_APP_V11');

    const parsed = parseGwAppV11(frenchLines, skippableWargear);
    assert.strictEqual(parsed.metadata.armyName, 'v11');
    assert.ok(parsed.metadata.faction.includes('Empire T’au') || parsed.metadata.faction.includes('Empire T\'au'));
    assert.strictEqual(parsed.metadata.totalPoints, 2000);
    assert.strictEqual(parsed.metadata.detachmentPoints, 3);
    assert.ok(parsed.metadata.detachments.includes('Mont’ka') || parsed.metadata.detachments.includes('Mont\'ka'));

    // Check attached units parsing:
    // The list should have Farsight attached to Sunforge. Verify Farsight has role 'Leader' and is Warlord (isWarlord: true), and the Sunforge group has role 'Bodyguard'.
    const attached1 = parsed.units.find(u => u.name === 'Attached Unit 1');
    assert.ok(attached1, 'Should parse Attached Unit 1');
    assert.strictEqual(attached1.isAttached, true);
    assert.strictEqual(attached1.attachedParts.length, 2);

    const farsight = attached1.attachedParts[0];
    assert.strictEqual(farsight.name, 'Commander Farsight');
    assert.strictEqual(farsight.role, 'Leader');
    assert.strictEqual(farsight.isWarlord, true);

    const sunforge = attached1.attachedParts[1];
    assert.strictEqual(sunforge.name, 'Crisis Sunforge Battlesuits');
    assert.strictEqual(sunforge.role, 'Bodyguard');

    // Verify generateOutput rendering output includes tags like [L1][W] and [B1]
    const abbrIndex = buildAbbreviationIndex(parsed);
    const htmlOut = generateOutput(parsed, true, abbrIndex, false, {}, false, false, false, false, false, false);
    
    assert.ok(htmlOut.plainText.includes('[L1][W]'), 'Should contain [L1][W]');
    assert.ok(htmlOut.plainText.includes('[B1]'), 'Should contain [B1]');

    console.log('✓ French GW App v11 parsing tests passed');
}

// Helper to test faction name normalization across languages
function runFactionNormalizationTests() {
    console.log('\n--- Running Faction Normalization Tests ---');
    
    // T'au Empire translations
    assert.strictEqual(getCanonicalFactionName("sternenreich der t'au"), "T'au Empire");
    assert.strictEqual(getCanonicalFactionName("impero tau"), "T'au Empire");
    assert.strictEqual(getCanonicalFactionName("empire t'au"), "T'au Empire");
    
    // Chaos Daemons
    assert.strictEqual(getCanonicalFactionName("démons du chaos"), "Chaos Daemons");
    assert.strictEqual(getCanonicalFactionName("chaosdaemonen"), "Chaos Daemons");
    assert.strictEqual(getCanonicalFactionName("demonios del caos"), "Chaos Daemons");
    
    // White Scars
    assert.strictEqual(getCanonicalFactionName("weisse narben"), "White Scars");
    assert.strictEqual(getCanonicalFactionName("cicatrices blanches"), "White Scars");
    
    // Grey Knights
    assert.strictEqual(getCanonicalFactionName("grey knights"), "Grey Knights");
    assert.strictEqual(getCanonicalFactionName("cavalieri grigi"), "Grey Knights");
    
    // Space Wolves
    assert.strictEqual(getCanonicalFactionName("weltraumwolfe"), "Space Wolves");
    assert.strictEqual(getCanonicalFactionName("loups spatiaux"), "Space Wolves");
    
    // Adepta Sororitas
    assert.strictEqual(getCanonicalFactionName("sisters of battle"), "Adepta Sororitas");
    assert.strictEqual(getCanonicalFactionName("schwestern des kampfes"), "Adepta Sororitas");
    
    console.log('✓ Faction normalization tests passed');
}

// Helper to run Alternate GW App parser tests
function runAlternateGwAppTests() {
    console.log('\n--- Running Alternate GW App v11 Parser Tests ---');
    const altPath = path.join(__dirname, '../samples/GWAPP-Sample-Alternate.txt');
    const altText = fs.readFileSync(altPath, 'utf8');
    const altLines = altText.split(/\r?\n/);

    const detected = detectFormat(altLines);
    assert.strictEqual(detected, 'GW_APP_V11', 'Should detect alternate sample list as GW_APP_V11');

    const parsed = parseGwAppV11(altLines, skippableWargear);
    
    // Assert metadata fields match the alternate file contents
    assert.strictEqual(parsed.metadata.armyName, 'CRISIS SUITS');
    assert.strictEqual(parsed.metadata.totalPoints, 1990);
    assert.strictEqual(parsed.metadata.faction, 'T’au Empire');
    assert.deepStrictEqual(parsed.metadata.detachments, ['Advanced Acquisition Cadre', 'Retaliation Cadre']);
    assert.strictEqual(parsed.metadata.detachmentPoints, 3);
    assert.deepStrictEqual(parsed.metadata.forceDispositions, ['Purge the Foe', 'Reconnaissance']);
    assert.strictEqual(parsed.metadata.battleSize, 'Strike Force');
    assert.strictEqual(parsed.metadata.pointsLimit, 2000);

    // Assert unit parsing is correct (e.g. Commander Farsight has Leader role & Warlord status, Crisis Sunforge has Bodyguard role)
    const attached1 = parsed.units.find(u => u.name === 'Attached Unit 1');
    assert.ok(attached1, 'Should parse Attached Unit 1');
    assert.strictEqual(attached1.isAttached, true);
    assert.strictEqual(attached1.attachedParts.length, 2);
    assert.strictEqual(attached1.points, 215); // 80 + 135

    const farsight = attached1.attachedParts[0];
    assert.strictEqual(farsight.name, 'Commander Farsight');
    assert.strictEqual(farsight.role, 'Leader');
    assert.strictEqual(farsight.isWarlord, true);

    const sunforge = attached1.attachedParts[1];
    assert.strictEqual(sunforge.name, 'Crisis Sunforge Battlesuits');
    assert.strictEqual(sunforge.role, 'Bodyguard');
    assert.strictEqual(sunforge.subunits.length, 2);
    assert.strictEqual(sunforge.subunits[0].name, 'Crisis Sunforge Shas’vre');
    assert.strictEqual(sunforge.subunits[0].quantity, 1);
    assert.ok(sunforge.subunits[0].wargear.some(w => w.name === 'Fusion blaster'));

    console.log('✓ Alternate GW App v11 parsing tests passed');
}

// Helper to run War Organ parser tests
function runWarOrganTests() {
    console.log('\n--- Running War Organ 11th Edition Parser Tests ---');

    // 1. SOB1 (Format 1)
    console.log('Testing Sisters of Battle (Format 1)...');
    const sob1Path = path.join(__dirname, '../samples/WO-Sample-SOB1.txt');
    const sob1Text = fs.readFileSync(sob1Path, 'utf8');
    const sob1Lines = sob1Text.split(/\r?\n/);

    const detectedSob1 = detectFormat(sob1Lines);
    assert.strictEqual(detectedSob1, 'WAR_ORGAN_V11', 'Should detect SOB1 as WAR_ORGAN_V11');

    const parsedSob1 = parseWarOrganV11(sob1Lines, skippableWargear);
    assert.strictEqual(parsedSob1.edition, '11th');
    assert.strictEqual(parsedSob1.metadata.title, 'Nundams Wing');
    assert.strictEqual(parsedSob1.metadata.pointsTotal, 1985);
    assert.strictEqual(parsedSob1.metadata.faction, 'Adepta Sororitas');
    assert.strictEqual(parsedSob1.metadata.battleSize, 'Strike Force');
    assert.strictEqual(parsedSob1.metadata.pointsLimit, 2000);
    assert.deepStrictEqual(parsedSob1.metadata.detachments, ['Chorus of Condemnation', 'Champions of Faith']);

    // Check first Canoness Jump Pack
    const canoness1 = parsedSob1.units.find(u => u.name === 'Canoness With Jump Pack' && u.points === 85);
    assert.ok(canoness1, 'Should find 85-point Canoness');
    assert.strictEqual(canoness1.category, 'Characters');
    assert.strictEqual(canoness1.wargear.length, 1);
    assert.strictEqual(canoness1.wargear[0].name, 'Blessed halberd');
    assert.strictEqual(canoness1.enhancements.length, 1);
    assert.strictEqual(canoness1.enhancements[0].name, 'Eyes of the oracle');
    assert.strictEqual(canoness1.enhancements[0].points, 10);

    // Check Celestian Sacresants
    const sacresants1 = parsedSob1.units.find(u => u.name === 'Celestian Sacresants');
    assert.ok(sacresants1, 'Should find Celestian Sacresants');
    assert.strictEqual(sacresants1.subunits.length, 2);
    assert.strictEqual(sacresants1.subunits[0].name, 'Sacresant Superior');
    assert.strictEqual(sacresants1.subunits[0].quantity, 1);
    assert.ok(sacresants1.subunits[0].wargear.some(w => w.name === 'Spear of the faithful'));
    assert.strictEqual(sacresants1.subunits[1].name, 'Celestian Sacresants');
    assert.strictEqual(sacresants1.subunits[1].quantity, 9);

    // 2. SOB2 (Format 2)
    console.log('Testing Sisters of Battle (Format 2)...');
    const sob2Path = path.join(__dirname, '../samples/WO-Sample-SOB2.txt');
    const sob2Text = fs.readFileSync(sob2Path, 'utf8');
    const sob2Lines = sob2Text.split(/\r?\n/);

    const detectedSob2 = detectFormat(sob2Lines);
    assert.strictEqual(detectedSob2, 'WAR_ORGAN_V11', 'Should detect SOB2 as WAR_ORGAN_V11');

    const parsedSob2 = parseWarOrganV11(sob2Lines, skippableWargear);
    assert.strictEqual(parsedSob2.metadata.title, 'Nundams Wing');
    assert.strictEqual(parsedSob2.metadata.pointsTotal, 1985);
    assert.strictEqual(parsedSob2.metadata.faction, 'Adepta Sororitas');

    const canoness2 = parsedSob2.units.find(u => u.name === 'Canoness With Jump Pack' && u.points === 85);
    assert.ok(canoness2, 'Should find 85-point Canoness in SOB2');
    assert.strictEqual(canoness2.category, 'Characters');
    assert.strictEqual(canoness2.wargear.length, 1);
    assert.strictEqual(canoness2.wargear[0].name, 'Blessed halberd');
    assert.strictEqual(canoness2.enhancements.length, 1);
    assert.strictEqual(canoness2.enhancements[0].name, 'Eyes of The Oracle');

    const sacresants2 = parsedSob2.units.find(u => u.name === 'Celestian Sacresants');
    assert.ok(sacresants2, 'Should find Celestian Sacresants in SOB2');
    assert.strictEqual(sacresants2.category, 'Other Datasheets');
    assert.strictEqual(sacresants2.subunits.length, 2);
    assert.strictEqual(sacresants2.subunits[0].name, 'Sacresant Superior');
    assert.strictEqual(sacresants2.subunits[0].quantity, 1);
    assert.ok(sacresants2.subunits[0].wargear.some(w => w.name === 'Spear of The Faithful'));
    assert.strictEqual(sacresants2.subunits[1].name, 'Celestian Sacresants');
    assert.strictEqual(sacresants2.subunits[1].quantity, 9);

    // 3. AM1 (Format 1)
    console.log('Testing Astra Militarum (Format 1)...');
    const am1Path = path.join(__dirname, '../samples/WO-Sample-AM1.txt');
    const am1Text = fs.readFileSync(am1Path, 'utf8');
    const am1Lines = am1Text.split(/\r?\n/);

    const detectedAm1 = detectFormat(am1Lines);
    assert.strictEqual(detectedAm1, 'WAR_ORGAN_V11', 'Should detect AM1 as WAR_ORGAN_V11');

    const parsedAm1 = parseWarOrganV11(am1Lines, skippableWargear);
    assert.strictEqual(parsedAm1.metadata.title, 'Fire Teams');
    assert.strictEqual(parsedAm1.metadata.pointsTotal, 2000);
    assert.strictEqual(parsedAm1.metadata.faction, 'Astra Militarum');

    const commander1 = parsedAm1.units.find(u => u.name === 'Leman Russ Commander');
    assert.ok(commander1, 'Should find Leman Russ Commander in AM1');
    assert.strictEqual(commander1.points, 260);
    assert.strictEqual(commander1.enhancements.length, 1);
    assert.strictEqual(commander1.enhancements[0].name, 'Grand strategist');
    assert.strictEqual(commander1.enhancements[0].points, 25);
    assert.ok(commander1.wargear.some(w => w.name === 'Multi-meltas' && w.quantity === 2));

    // 4. AM2 (Format 2)
    console.log('Testing Astra Militarum (Format 2)...');
    const am2Path = path.join(__dirname, '../samples/WO-Sample-AM2.txt');
    const am2Text = fs.readFileSync(am2Path, 'utf8');
    const am2Lines = am2Text.split(/\r?\n/);

    const detectedAm2 = detectFormat(am2Lines);
    assert.strictEqual(detectedAm2, 'WAR_ORGAN_V11', 'Should detect AM2 as WAR_ORGAN_V11');

    const parsedAm2 = parseWarOrganV11(am2Lines, skippableWargear);
    assert.strictEqual(parsedAm2.metadata.title, 'Fire Teams');
    assert.strictEqual(parsedAm2.metadata.pointsTotal, 2000);
    assert.strictEqual(parsedAm2.metadata.faction, 'Astra Militarum');

    const commander2 = parsedAm2.units.find(u => u.name === 'Leman Russ Commander');
    assert.ok(commander2, 'Should find Leman Russ Commander in AM2');
    assert.strictEqual(commander2.category, 'Characters');
    assert.strictEqual(commander2.enhancements.length, 1);
    assert.strictEqual(commander2.enhancements[0].name, 'Grand Strategist');
    assert.ok(commander2.wargear.some(w => w.name === 'Multi-meltas' && w.quantity === 2));

    const cmdSquad = parsedAm2.units.find(u => u.name === 'Militarum Tempestus Command Squad' && u.points === 100);
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

    console.log('✓ War Organ 11th Edition parsing tests passed');
}

runGenericTests();
runGwAppTests();
runFrenchTests();
runFactionNormalizationTests();
runAlternateGwAppTests();
runWarOrganTests();
console.log('\nAll 11th Edition tests completed and PASSED!');
