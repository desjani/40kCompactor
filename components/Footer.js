import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Footer() {
  return (
    h('footer', { class: 'app-footer' },
      h('p', null, 'For feedback or questions, reach out to ', h('a', { href: 'https://discord.com/users/Desjani', target: '_blank' }, '@Desjani'), ' on Discord.')
    )
  );
}