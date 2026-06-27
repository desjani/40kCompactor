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
          h('h5', null, 'Version 1.6.1 - Asset Cache-Busting and Timing Fix'),
          h('p', null, 'Implemented dynamic cache-busting for CSS, JS modules, and JSON configurations using a runtime import map based on build metadata. Resolved a timing race condition to ensure reliable UI initialization.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.6.0 - Unit Abbreviation and Bracket Options'),
          h('p', null, 'Added a new option to abbreviate unit and subunit names in compact text and image card layouts, with isolated abbreviation namespaces to prevent conflicts. Added an option to hide brackets and parentheses. Fixed quote and apostrophe normalization for custom abbreviations.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.5.0 - 11th Edition Format Update'),
          h('p', null, 'Transitioned the primary entrypoints to use the new 11th Edition parsers (GW App v11 and War Organ v11) and cleaned up deprecated legacy scripts.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.4.1 - Bot Logging Update'),
          h('p', null, 'Added logging for joined guilds on bot startup.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.4.0 - Show Subunits Update'),
          h('p', null, 'Reversed subunits toggle behavior to show subunits by default across CLI, Web, and Mobile UIs. Updated Discord Bot command descriptions, placeholders, and error messages, and version-locked the V10 legacy code.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.3.0 - The Great Wargear Cleanout'),
          h('p', null, 'Completed a comprehensive analysis of Wahapedia faction unit datasheets and updated skippable wargear definitions for 35 factions.')),
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