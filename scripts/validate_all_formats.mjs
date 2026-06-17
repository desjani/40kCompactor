#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import * as parsers from '../modules/parsers.js';
import { generateOutput, generateDiscordText } from '../modules/renderers.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const samples = [
  { file: 'samples/V11Sample.txt', expect: 'V11_GENERIC' },
  { file: 'samples/GWAPP-Sample-Tau.txt', expect: 'GW_APP_V11' },
  { file: 'samples/GWAPP-Sample-WorldEaters.txt', expect: 'GW_APP_V11' },
  { file: 'samples/GWAPP-Sample-ImperialKnights', expect: 'GW_APP_V11' }
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

async function main() {
  const failures = [];
  const results = [];
  for (const sample of samples) {
    const text = safeRead(sample.file);
    const lines = text.split(/\r?\n/);
    const detected = parsers.detectFormat(lines);
    ok(detected === sample.expect, `detectFormat mismatch: expected ${sample.expect}, got ${detected}`, { file: sample.file }, failures);

    let data;
    try {
      const parser = {
        V11_GENERIC: parsers.parseV11List,
        GW_APP_V11: parsers.parseGwAppV11
      }[detected];
      if (!parser) throw new Error(`No parser found for format ${detected}`);
      data = parser(lines);
    } catch (e) {
      failures.push({ msg: `parser threw for ${sample.file}: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file } });
      continue;
    }

    try {
      const ext = generateOutput(data, false, { __flat_abbr: {} }, false, {});
      ok(ext && typeof ext.html === 'string' && ext.html.length > 20, 'extended html empty', { file: sample.file }, failures);
      ok(ext && typeof ext.plainText === 'string' && ext.plainText.length > 20, 'extended plainText empty', { file: sample.file }, failures);
    } catch (e) {
      failures.push({ msg: `generateOutput extended threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file } });
    }

    for (const combo of renderCombos) {
      try {
        const cmp = generateOutput(data, true, { __flat_abbr: {} }, combo.hide, {}, true, combo.combine);
        ok(cmp && typeof cmp.html === 'string' && cmp.html.length > 20, 'compact html empty', { file: sample.file, combo }, failures);
        ok(cmp && typeof cmp.plainText === 'string' && cmp.plainText.length > 20, 'compact plainText empty', { file: sample.file, combo }, failures);
      } catch (e) {
        failures.push({ msg: `generateOutput compact threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
    }

    for (const combo of renderCombos) {
      try {
        const t1 = generateDiscordText(data, false, true, { __flat_abbr: {} }, combo.hide, {}, combo.combine);
        ok(typeof t1 === 'string' && t1.length > 20 && t1.startsWith('```') && t1.trim().endsWith('```'), 'discord (ansi) invalid fences/empty', { file: sample.file, combo }, failures);
      } catch (e) {
        failures.push({ msg: `generateDiscordText (ansi) threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
      try {
        const t2 = generateDiscordText(data, true, true, { __flat_abbr: {} }, combo.hide, {}, combo.combine);
        ok(typeof t2 === 'string' && t2.length > 20 && !t2.trim().startsWith('```'), 'discord (plain) should be unfenced non-empty text', { file: sample.file, combo }, failures);
      } catch (e) {
        failures.push({ msg: `generateDiscordText (plain) threw: ${e && (e.stack || e.message) || e}`, ctx: { file: sample.file, combo } });
      }
    }

    results.push({ file: sample.file, detected, status: 'OK' });
  }

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
