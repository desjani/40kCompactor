import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Input() {
  return (
    h('div', null,
      h('label', { for: 'inputText', class: 'io-label' }, 'Paste List here (GW App or WTC-Compact)'),
      h('textarea', { id: 'inputText', class: 'io-box', autofocus: true }),
      h('div', { class: 'column-footer', style: 'flex-direction: column; align-items: center;' },
        h('div', { class: 'button-group' },
            h('button', { id: 'resetButton', class: 'btn btn-danger' }, 'Clear List'),
            h('button', { id: 'parseButton', class: 'btn btn-primary', style: 'display:none;' }, 'Compact this list')
          ),
        h('div', { id: 'inputCharCount', class: 'char-count', style: 'margin-top: 0.5rem;' })
      ),
      h('div', { style: 'margin-top: 1rem; text-align: center;' },
        h('label', { for: 'roszInput', class: 'btn btn-secondary' }, 'Upload .rosz File'),
        h('input', { type: 'file', id: 'roszInput', style: 'display: none;' })
      )
    )
  );
}