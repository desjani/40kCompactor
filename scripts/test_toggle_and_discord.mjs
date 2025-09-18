// Phase 3: tiny guard test for toggle scoping and Discord fences
// Contract:
// - Combine/Hide toggles should not affect Full Text outputs
// - Discord outputs should be fenced with ```ansi or ```
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectFormat, parseGwApp, parseNrGw, parseNrNr, parseWtcCompact, parseWtc, parseLf } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function loadSample() {
  // Use the existing GW App sample as a stable baseline
  const p = path.resolve(__dirname, '..', 'GWAPPSample.txt');
  return fs.readFileSync(p, 'utf8');
}

function run() {
  const txt = loadSample();
  const fmt = detectFormat(txt);

  // Parse according to detected format
  let parsed;
  switch (fmt) {
    case 'GW_APP':
      parsed = parseGwApp(txt.split(/\r?\n/));
      break;
    case 'NR_GW':
      parsed = parseNrGw(txt.split(/\r?\n/));
      break;
    case 'NRNR':
      parsed = parseNrNr(txt.split(/\r?\n/));
      break;
    case 'WTC_COMPACT':
      parsed = parseWtcCompact(txt.split(/\r?\n/));
      break;
    case 'WTC':
      parsed = parseWtc(txt.split(/\r?\n/));
      break;
    case 'LF':
      parsed = parseLf(txt.split(/\r?\n/));
      break;
    default:
      throw new Error(`Unexpected format: ${fmt}`);
  }

  const abbr = buildAbbreviationIndex(parsed);

  // Full Text baseline (no toggle impact expected). We intentionally vary
  // hideSubunits and combineIdenticalUnits, but Full Text should ignore them.
  const fullA = generateOutput(parsed, /*useAbbreviations*/ false, abbr, /*hideSubunits*/ false, /*skippable*/ {});
  const fullB = generateOutput(parsed, /*useAbbreviations*/ false, abbr, /*hideSubunits*/ true, /*skippable*/ {}, /*applyHeaderColor*/ true, /*combineIdenticalUnits*/ true);

  assert(typeof fullA?.plainText === 'string' && fullA.plainText.length > 0, 'Full Text A should be non-empty');
  assert(typeof fullB?.plainText === 'string' && fullB.plainText.length > 0, 'Full Text B should be non-empty');
  assert(fullA.plainText.length === fullB.plainText.length, 'Full Text should be identical length regardless of toggles');
  assert(fullA.plainText === fullB.plainText, 'Full Text content should be identical regardless of toggles');

  // Discord fencing for compact. Produce both ANSI (when available) and plain variants.
  const ansiDiscord = generateDiscordText(parsed, /*plain*/ false, /*useAbbreviations*/ true, abbr, /*hideSubunits*/ false, /*skippable*/ {}, /*combineIdenticalUnits*/ true);
  const plainDiscord = generateDiscordText(parsed, /*plain*/ true, /*useAbbreviations*/ true, abbr, /*hideSubunits*/ false, /*skippable*/ {}, /*combineIdenticalUnits*/ true);

  function isFenced(s) {
    return typeof s === 'string' && s.startsWith('```') && s.endsWith('```');
  }

  assert(isFenced(ansiDiscord), 'ANSI Discord text should be fenced');
  assert(isFenced(plainDiscord), 'Plain Discord text should be fenced');

  console.log('Phase 3 tiny test passed.');
}

run();
