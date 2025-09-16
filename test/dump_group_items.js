const a = require('./wtc_parsed.json');
const b = require('./wtccompact_parsed.json');
function groups(root, name) { return (root['OTHER DATASHEETS'] || []).filter(u => u && u.name && u.name.toLowerCase().includes(name)); }
function dump(root, name, label) {
  const G = groups(root, name);
  console.log(`${label} groups count: ${G.length}`);
  G.forEach((g, i) => {
    console.log(label, i, 'quantity', g.quantity);
    (g.items || []).forEach((s, si) => {
      const items = (s.items || []).map(it => `${it.quantity} ${it.name}`).join('; ');
      console.log(' ', label, 'sub', si, s.quantity, s.name, items);
    });
  });
}
['crisis sunforge battlesuits','crisis fireknife battlesuits','crisis starscythe battlesuits','stealth battlesuits'].forEach(n => { dump(a, n, 'PARSED'); dump(b, n, 'COMPACT'); });
