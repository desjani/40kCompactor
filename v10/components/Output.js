import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Output({ id, label, buttonLabel, children }) {
  return (
    h('div', null,
      h('label', { for: id, class: 'io-label' }, label),
      h('div', { id: id, class: 'io-box' }),
      h('div', { class: 'column-footer', style: 'flex-direction: column; align-items: center;' },
        h('button', { id: `copy${id}Button`, class: 'btn btn-copy' }, buttonLabel),
        h('div', { id: `${id}CharCount`, class: 'char-count', style: 'margin-top: 0.5rem;' })
      ),
      children
    )
  );
}