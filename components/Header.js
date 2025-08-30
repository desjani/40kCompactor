import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Header() {
  return (
    h('header', { class: 'header' },
      h('h1', null, 'Warhammer 40k List Compactor'),
      h('p', null, 'Paste your army list below (supports GW App and WTC-Compact formats). The tool will generate an extended version and a compact version. Use the "Copy for Discord" buttons for various colored, pre-formatted outputs ready for pasting.')
    )
  );
}