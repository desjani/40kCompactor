// Simple micro-benchmark for abbreviation lookups in generateOutput
// Measures time to run generateOutput N times with a realistic-ish parsed object.

global.window = global.window || {};
global.document = global.document || { getElementById: () => null, querySelector: () => null };
global.AnsiUp = class { toHtml(s){ return s; } };

const { generateOutput } = await import('../modules/renderers.js');
const { loadAbbreviationRules } = await import('../modules/abbreviations.js');

// Create a small but slightly varied parsed dataset
const sample = {
  SUMMARY: { DISPLAY_FACTION: 'Test Faction' },
  "OTHER DATASHEETS": []
};
for (let u = 0; u < 50; u++) {
  const items = [];
  for (let i = 0; i < 8; i++) {
    items.push({ quantity: '1x', name: `Wargear ${i}`, nameshort: `W${i}`, type: 'wargear' });
  }
  sample['OTHER DATASHEETS'].push({ quantity: '1x', name: `Unit ${u}`, points: 100, items });
}

// Use a small synthetic DB where half the items are NULL
const wargearDb = Object.create(null);
for (let i = 0; i < 8; i++) {
  const key = `wargear ${i}`;
  wargearDb[key] = (i % 2 === 0) ? 'NULL' : `A${i}`;
}

const ITER = 2000;
const t0 = Date.now();
for (let i = 0; i < ITER; i++) {
  generateOutput(sample, true, wargearDb, false, {});
}
const t1 = Date.now();
console.log(`Ran ${ITER} iterations in ${t1 - t0} ms (${((t1 - t0)/ITER).toFixed(3)} ms/iter)`);
