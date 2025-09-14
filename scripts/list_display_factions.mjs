import fm from '../modules/family_map.js';

const normalize = (s) => {
  if (!s) return '';
  try {
    return s.toString().normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
      .replace(/[^\w\s'\-]/g, '')
      .trim();
  } catch (e) {
    return s.toString().trim();
  }
};

const out = new Set();
for (const [k,v] of Object.entries(fm)) {
  out.add(`${v} - ${normalize(k)}`);
}
console.log(Array.from(out).join('\n'));
