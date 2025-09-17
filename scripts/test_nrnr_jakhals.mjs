import fs from 'fs';
import assert from 'assert';
import { detectFormat, parseNrNr } from '../modules/parsers.js';

const text = fs.readFileSync(new URL('../NRNRsample.txt', import.meta.url), 'utf8');
const lines = text.split(/\r?\n/);
const fmt = detectFormat(lines);
console.log('Detected format:', fmt);
assert.strictEqual(fmt, 'NRNR', `Expected detectFormat -> NRNR but got ${fmt}`);

const parsed = parseNrNr(lines);
const unit = (parsed['OTHER DATASHEETS']||[]).find(u=>/Jakhals/i.test(u.name));
assert(unit, 'Jakhals unit not found');

const subs = (unit.items||[]).filter(it=>it.type==='subunit');
const jakhals = subs.filter(s=>/^Jakhal$/i.test(s.name));
const dishonoured = subs.find(s=>/Dishonoured/i.test(s.name));
const leader = subs.find(s=>/Pack Leader/i.test(s.name));

assert.strictEqual(jakhals.length, 1, `Expected aggregated single 'Jakhal' subunit but got ${jakhals.length}`);
assert.strictEqual(jakhals[0].quantity, '8x', `Expected 'Jakhal' quantity 8x but got ${jakhals[0].quantity}`);

const wargear = jakhals[0].items||[];
const auto = wargear.find(i=>/Autopistol/i.test(i.name));
const blades = wargear.find(i=>/Chainblades/i.test(i.name));
const icon = wargear.find(i=>/Icon of Khorne/i.test(i.name));
const mauler = wargear.find(i=>/Mauler chainblade/i.test(i.name));

assert.strictEqual(auto?.quantity, '8x', `Expected Autopistol 8x but got ${auto?.quantity}`);
assert.strictEqual(blades?.quantity, '7x', `Expected Chainblades 7x but got ${blades?.quantity}`);
assert.strictEqual(icon?.quantity, '1x', `Expected Icon of Khorne 1x but got ${icon?.quantity}`);
assert.strictEqual(mauler?.quantity, '1x', `Expected Mauler chainblade 1x but got ${mauler?.quantity}`);

assert.strictEqual(dishonoured?.quantity, '1x', `Expected Dishonoured 1x but got ${dishonoured?.quantity}`);
assert.strictEqual(leader?.quantity, '1x', `Expected Jakhal Pack Leader 1x but got ${leader?.quantity}`);

console.log('NRNR Jakhals aggregation and quantities test passed.');
