import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function ColorOptions() {
  return (
    h('div', { class: 'color-options-container', style: 'margin-top: 1rem; text-align: center;' },
      h('div', { class: 'color-options' },
        h('label', null, h('input', { type: 'radio', name: 'colorMode', value: 'none', checked: true }), ' No Color'),
        h('label', null, h('input', { type: 'radio', name: 'colorMode', value: 'custom' }), ' Custom Colors')
      ),
      h('div', { id: 'customColorPickers', style: 'display: none; margin-top: 0.5rem; text-align: center;' },
        h('div', { style: 'margin-bottom: 0.5rem;' },
          h('label', null, 'Unit: ',
            h('select', { id: 'unitColor' },
              h('option', { value: '#FFFFFF', selected: true }, 'White'),
              h('option', { value: '#808080' }, 'Grey'),
              h('option', { value: '#FF0000' }, 'Red'),
              h('option', { value: '#00FF00' }, 'Green'),
              h('option', { value: '#FFFF00' }, 'Yellow'),
              h('option', { value: '#0000FF' }, 'Blue'),
              h('option', { value: '#FF00FF' }, 'Magenta'),
              h('option', { value: '#00FFFF' }, 'Cyan')
            )
          )
        ),
        h('div', { style: 'margin-bottom: 0.5rem;' },
          h('label', null, 'Subunit: ',
            h('select', { id: 'subunitColor' },
              h('option', { value: '#FFFFFF' }, 'White'),
              h('option', { value: '#808080', selected: true }, 'Grey'),
              h('option', { value: '#FF0000' }, 'Red'),
              h('option', { value: '#00FF00' }, 'Green'),
              h('option', { value: '#FFFF00' }, 'Yellow'),
              h('option', { value: '#0000FF' }, 'Blue'),
              h('option', { value: '#FF00FF' }, 'Magenta'),
              h('option', { value: '#00FFFF' }, 'Cyan')
            )
          )
        ),
        h('div', null,
          h('label', null, 'Points/Header: ',
            h('select', { id: 'pointsColor' },
              h('option', { value: '#FFFFFF' }, 'White'),
              h('option', { value: '#808080' }, 'Grey'),
              h('option', { value: '#FF0000' }, 'Red'),
              h('option', { value: '#00FF00' }, 'Green'),
              h('option', { value: '#FFFF00', selected: true }, 'Yellow'),
              h('option', { value: '#0000FF' }, 'Blue'),
              h('option', { value: '#FF00FF' }, 'Magenta'),
              h('option', { value: '#00FFFF' }, 'Cyan')
            )
          )
        )
      )
    )
  );
}