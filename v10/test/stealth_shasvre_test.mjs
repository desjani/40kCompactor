import assert from 'assert';
import fs from 'fs';
import { parseWtc } from '../modules/parsers/wtc.js';

const txt = fs.readFileSync(new URL('../WTCSample.txt', import.meta.url), 'utf8');
const lines = txt.split(/\r?\n/);
const res = parseWtc(lines);

function findStealthShasvre(result) {
    const others = result['OTHER DATASHEETS'] || [];
    for (const u of others) {
        if (!u || !u.name) continue;
        if (/stealth battlesuits/i.test(u.name)) {
            const subs = (u.items || []).filter(it => it && it.type === 'subunit');
            for (const s of subs) {
                if (/shas'vre/i.test(s.name)) return s;
            }
        }
    }
    return null;
}

const shasvre = findStealthShasvre(res);
assert(shasvre, 'Stealth Shas\'vre subunit not found');

const names = (shasvre.items || []).map(i => (i && i.name || '').toLowerCase());
assert(names.includes('battlesuit support system'), 'missing Battlesuit support system');
assert(names.includes('homing beacon') || names.includes('homing beacon'), 'missing Homing beacon');
assert(names.includes('marker drone'), 'missing Marker Drone');
assert(names.includes('shield drone'), 'missing Shield Drone');

console.log('stealth_shasvre_test: PASS');
