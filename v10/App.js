import { h, Component } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { Input } from './components/Input.js';
import { Output } from './components/Output.js';
import { ColorOptions } from './components/ColorOptions.js';
import { Changelog } from './components/Changelog.js';
import { Debug } from './components/Debug.js';

export class App extends Component {
  render() {
    return (
      h('div', { class: 'container' },
        h('div', { class: 'card' },
          h(Header),
          h(Footer),
          h('div', { class: 'grid-container' },
            h(Input),
            h(Output, { id: 'unabbreviatedOutput', label: 'Extended List', buttonLabel: 'Extended Version' }),
            h(Output, { id: 'compactedOutput', label: 'Compact List', buttonLabel: 'Discord (Compact)' },
              h(ColorOptions)
            )
          ),
          h(Changelog),
          h(Debug)
        )
      ),
      h('div', { id: 'copyPopup', class: 'copy-popup' }, 'Copied to Clipboard!')
    );
  }
}
