import { test } from 'node:test';
import assert from 'node:assert';
import { detectFormat, parseV11List } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateOutput } from '../modules/renderers.js';
import { readSample } from './helpers.mjs';

test('Generic V11 format: detection, parsing, abbreviations, rendering', () => {
    const lines = readSample('V11Sample.txt');

    assert.strictEqual(detectFormat(lines), 'V11_GENERIC');

    const parsed = parseV11List(lines);
    assert.strictEqual(parsed.edition, '11th');
    assert.strictEqual(parsed.metadata.title, '11th Edition Army List');
    assert.strictEqual(parsed.metadata.faction, 'Space Marines');
    assert.strictEqual(parsed.metadata.pointsTotal, 1990);
    assert.strictEqual(parsed.units.length, 4);

    const abbrIndex = buildAbbreviationIndex(parsed);
    assert.strictEqual(abbrIndex.__flat_abbr['relic weapon'], 'RW');

    const htmlOut = generateOutput(parsed, true, abbrIndex, false, {}, false, false, false, false);
    assert.ok(htmlOut.plainText.includes('Captain in Terminator Armour (E: AA (+10), RW, SB) [95]'));
});
