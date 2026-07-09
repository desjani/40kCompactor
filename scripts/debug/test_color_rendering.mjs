import factionColors from '../modules/faction_colors.js';

const ansiPalette = [
    { hex: '#000000', code: 30 }, { hex: '#FF0000', code: 31 }, { hex: '#00FF00', code: 32 },
    { hex: '#FFFF00', code: 33 }, { hex: '#0000FF', code: 34 }, { hex: '#FF00FF', code: 35 },
    { hex: '#00FFFF', code: 36 }, { hex: '#FFFFFF', code: 37 }, { hex: '#808080', code: 30 }
];

const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
};

const findClosestAnsi = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 37;
    let best = 37;
    let bestD = Infinity;
    for (const c of ansiPalette) {
        const cr = hexToRgb(c.hex);
        const d = Math.pow(rgb.r - cr.r, 2) + Math.pow(rgb.g - cr.g, 2) + Math.pow(rgb.b - cr.b, 2);
        if (d < bestD) { bestD = d; best = c.code; }
    }
    return best;
};

const canonical = (hex) => {
    if (!hex) return null;
    const h = hex.toString().toLowerCase();
    if (h === '#000000' || h === '#808080') return 30;
    const p = ansiPalette.find(p => p.hex.toLowerCase() === h);
    return p ? p.code : findClosestAnsi(hex);
};

console.log('Faction color rendering report');
console.log('Allowed palette:', ansiPalette.map(p=>p.hex).join(' '));
console.log('');

let failures = 0;
for (const [faction, set] of Object.entries(factionColors)) {
    const u = set.unit || null;
    const s = set.subunit || null;
    const w = set.wargear || null;
    const p = set.points || null;
    const cu = canonical(u);
    const cs = canonical(s);
    const cw = canonical(w);
    const cp = canonical(p);

    const issues = [];
    // Uniqueness: Unit != Subunit, Subunit != Wargear, Wargear != Points
    if (cu === cs) issues.push('Unit==Subunit');
    if (cs === cw) issues.push('Subunit==Wargear');
    if (cw === cp) issues.push('Wargear==Points');

    if (issues.length) failures++;

    console.log(`${faction}`);
    console.log(`  unit:    ${u} -> ANSI ${cu}`);
    console.log(`  subunit: ${s} -> ANSI ${cs}`);
    console.log(`  wargear: ${w} -> ANSI ${cw}`);
    console.log(`  points:  ${p} -> ANSI ${cp}`);
    if (issues.length) console.log('  !! issues: ' + issues.join(', '));
    console.log('');
}

if (failures === 0) {
    console.log('All faction entries map to distinct ANSI codes per the uniqueness constraints.');
} else {
    console.log(`Found ${failures} faction(s) with uniqueness issues. See above.`);
    process.exit(2);
}
