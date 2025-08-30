import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Debug() {
  return (
    h('div', null,
      h('div', { style: 'text-align: center; margin-top: 1.5rem;' },
        h('button', { id: 'toggleDebugButton', class: 'btn', style: 'background-color: black; color: white; border: 1px solid #444;' }, 'Show Debug Log')
      ),
      h('div', { id: 'debugContainer', class: 'changelog-section', style: 'margin-top: 0.5rem; display: none;' },
        h('div', { class: 'changelog-entry' },
          h('h4', null, 'Debug Log'),
          h('div', { id: 'debugOutput', class: 'io-box', style: 'max-height: 200px; overflow-y: auto; background-color: #282c34; color: #abb2bf; font-family: monospace; font-size: 0.75rem; line-height: 1.4;' })
        )
      )
    )
  );
}