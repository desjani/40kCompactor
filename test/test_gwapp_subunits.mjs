import { parseGwApp } from '../modules/parsers.js';
import assert from 'assert';

const deathwingSample = `
Deathwing Knights (250 points)
  • 1x Watcher in the Dark
  • 1x Knight Master
    • 1x Great weapon of the Unforgiven
  • 4x Deathwing Knight
    • 4x Mace of absolution
`.trim().split('\n');

console.log('Testing Deathwing Knights parsing...');
const parsed = parseGwApp(deathwingSample);
const unit = parsed['OTHER DATASHEETS'][0];

assert.strictEqual(unit.name, 'Deathwing Knights');
// Quantity should be 5x (1 Knight Master + 4 Deathwing Knights), Watcher is wargear
assert.strictEqual(unit.quantity, '5x');

const watcher = unit.items.find(i => i.name === 'Watcher in the Dark');
assert.ok(watcher, 'Watcher in the Dark should be found');
assert.strictEqual(watcher.type, 'wargear', 'Watcher in the Dark should be wargear');

const master = unit.items.find(i => i.name === 'Knight Master');
assert.ok(master, 'Knight Master should be found');
assert.strictEqual(master.type, 'subunit', 'Knight Master should be a subunit');

console.log('PASS: Deathwing Knights parsed correctly.');
