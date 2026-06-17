import { h } from 'https://unpkg.com/preact@10.5.15/dist/preact.module.js';

export function Changelog() {
  return (
    h('div', { class: 'changelog-section' },
      h('div', { class: 'changelog-entry roadmap' },
        h('h4', null, 'Roadmap'),
        h('ul', null,
          h('li', null, '.ROSZ file format support'),
          h('li', null, 'Mobile-friendly version'),
          h('li', null, 'Individual faction abbreviation rule adjustments'),
          h('li', null, 'Ongoing bugfixes and performance improvements')
        )
      ),
      h('div', { class: 'changelog-entry' },
        h('h4', null, 'Changelog'),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, "Version 1.2.0 - I'm winning the format war, dammit!"),
          h('p', null, 'Introduced the Autoparser to automatically detect list formats; added support for ListForge (Detailed); and shipped various bugfixes and parser improvements.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, "Version 1.1.1: Thats not a wargear, that's my wife!"),
          h('p', null, 'Minor parser and rendering fixes.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 0.0.4: T\'au Season!'),
          h('p', null, 'Numerous parser fixes and abbreviation updates for T\'au Empire lists. Improved wargear filtering to prevent redundant items from appearing in the compact list.')
        ),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 0.0.3: Fixes, Formatting, and more!'),
          h('p', null, 'Implemented a new inline compact format for easier reading. Added more \'Copy for Discord\' options for greater flexibility. Numerous parser fixes for both GW App and WTC-Compact formats to improve reliability.')
        ),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 0.0.2: Support for GW App and WTC-Compact formats'),
          h('p', null, 'The parser now supports both major list formats, with improved reliability for complex nested units and wargear. Abbreviation logic is now consistent across both formats.')
        ),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 0.0.1: Initial Beta Release'),
          h('p', null, 'The first version is live! Basic list parsing and abbreviation for most major factions is included. More features and polish to come.')
        )
      )
    )
  );
}