#!/usr/bin/env node
/*
 Validate that all supported formats detect, parse, and render without errors.
 Checks: detection matches expected; generateOutput returns non-empty HTML/plain;
 generateDiscordText returns non-empty strings (with code fences when plain=false);
 and key toggle permutations (hideSubunits, combineIdenticalUnits) do not throw.
 Exits non-zero on any failure and prints a concise summary.
*/

import fs from 'fs';
import path from 'path';
import url from 'url';
import * as parsers from '../modules/parsers.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const samples = [
  { file: 'samples/WTCCompactSample.txt', expect: 'WTC_COMPACT' },
  { file: 'samples/WTCSample.txt',        expect: 'WTC' },
  { file: 'samples/GWAPPSample.txt',      expect: 'GW_APP' },
  { file: 'samples/GWAPPSample2.txt',     expect: 'GW_APP' },
  { file: 'samples/NRGWSample.txt',       expect: 'NR_GW' },
  { file: 'samples/NRNRsample.txt',       expect: 'NRNR' },
  { file: 'samples/LFSample.txt',         expect: 'LF' },
];

const renderCombos = [
  { hide: false, combine: false },
  { hide: true,  combine: false },
  { hide: true,  combine: true },
  { hide: false, combine: true },
];

function ok(cond, msg, ctx, failures) {
  if (!cond) failures.push({ msg, ctx });
}

function safeRead(file) {
  const p = path.join(repoRoot, file);
  return fs.readFileSync(p, 'utf8');
}

function parserFor(format) {
  switch (format) {
    case 'GW_APP': return parsers.parseGwApp;
    case 'WTC_COMPACT': return parsers.parseWtcCompact;
    case 'WTC': return parsers.parseWtc;
    case 'NR_GW': return parsers.parseNrGw;
    case 'NRNR': return parsers.parseNrNr;
    case 'LF': return parsers.parseLf;
    default: return null;
  }
}

function short(s, n = 80) {
  s = String(s || '');
  return s.length <= n ? s : s.slice(0, n) + '…';
}

async function main() {
  const failures = [];
  const results = [];
  for (const sample of samples) {
    const text = safeRead(sample.file);
    const lines = text.split(/\r?\n/);
    const detected = parsers.detectFormat(lines);
    ok(detected === sample.expect, `detectFormat mismatch: expected ${sample.expect}, got ${detected}`, { file: sample.file }, failures);

    const parseFn = parserFor(detected);
    ok(typeof parseFn === 'function', `no parser for format ${detected}`, { file: sample.file }, failures);
    if (!parseFn) continue;

    let data;
    try {
      data = parseFn(lines);
    } catch (e) {
      failures.push({ msg: `parser threw for ${sample.file}: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file } });
      continue;
    }

    // Extended (Full Text) — by convention we ignore toggles in app; but here we just test basic render.
    try {
      const ext = generateOutput(data, /*useAbbrev*/ false, { __flat_abbr: {} }, /*hide*/ false, /*skippable*/ {}, /*applyHeaderColor*/ false, /*combine*/ false);
      ok(ext && typeof ext.html === 'string' && ext.html.length > 20, 'extended html empty', { file: sample.file }, failures);
      ok(ext && typeof ext.plainText === 'string' && ext.plainText.length > 20, 'extended plainText empty', { file: sample.file }, failures);
    } catch (e) {
      failures.push({ msg: `generateOutput extended threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file } });
    }

    // Compact variations
    for (const combo of renderCombos) {
      try {
        const cmp = generateOutput(data, /*useAbbrev*/ true, { __flat_abbr: {} }, combo.hide, /*skippable*/ {}, /*applyHeaderColor*/ true, combo.combine);
        ok(cmp && typeof cmp.html === 'string' && cmp.html.length > 20, 'compact html empty', { file: sample.file, combo }, failures);
        ok(cmp && typeof cmp.plainText === 'string' && cmp.plainText.length > 20, 'compact plainText empty', { file: sample.file, combo }, failures);
      } catch (e) {
        failures.push({ msg: `generateOutput compact threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
    }

  // Discord preview text: ANSI is fenced with ```ansi; Plain variant is NOT fenced per current behavior.
    const combosShort = [ renderCombos[0], renderCombos[2] ];
    for (const combo of combosShort) {
      try {
        const t1 = generateDiscordText(data, /*plain*/ false, /*useAbbrev*/ true, { __flat_abbr: {} }, combo.hide, /*skippable*/ {}, combo.combine);
        ok(typeof t1 === 'string' && t1.length > 20 && t1.startsWith('```') && t1.trim().endsWith('```'), 'discord (ansi) invalid fences/empty', { file: sample.file, combo, len: t1.length, head: short(t1) }, failures);
      } catch (e) {
        failures.push({ msg: `generateDiscordText (ansi) threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
      try {
    const t2 = generateDiscordText(data, /*plain*/ true, /*useAbbrev*/ true, { __flat_abbr: {} }, combo.hide, /*skippable*/ {}, combo.combine);
    ok(typeof t2 === 'string' && t2.length > 20 && !t2.trim().startsWith('```'), 'discord (plain) should be unfenced non-empty text', { file: sample.file, combo, len: t2.length, head: short(t2) }, failures);
      } catch (e) {
        failures.push({ msg: `generateDiscordText (plain) threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
    }

    results.push({ file: sample.file, detected, status: 'OK' });
  }

  // Report
  if (failures.length) {
    console.error('Validation FAILED:', failures.length, 'issues');
    failures.forEach((f, i) => console.error(`#${i+1}`, f.msg, f.ctx ? JSON.stringify(f.ctx) : ''));
    process.exit(1);
  } else {
    console.log('Validation PASSED for all samples.');
    results.forEach(r => console.log(` - ${r.file}: ${r.detected} ✓`));
  }
}

main().catch(e => { console.error('Fatal error:', e && (e.stack || e.message) || e); process.exit(1); });
