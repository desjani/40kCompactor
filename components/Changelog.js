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
          h('h5', null, 'Version 1.6.6 - GW App Force Disposition Fix'),
          h('p', null, 'Fixed force disposition detection for the latest official Warhammer App export format, which dropped the "Force Dispositions:" label and now lists the disposition as a bare line (e.g. "Purge the Foe").')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.6.5 - Wargear Normalization and Subfaction Support'),
          h('p', null, 'Wargear names that only differ by hyphenation (e.g. "Close Combat Weapon" vs "Close-Combat Weapon") are now treated as the same item for quantity merging, skippable-wargear rules, and abbreviations. GW App lists with a subfaction header line (e.g. "Space Marines" / "Dark Angels") now combine into a single faction name and correctly resolve chapter-specific coloring and skippable-wargear overrides, falling back to the parent faction\'s rules when no override exists.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.6.4 - Discord Bot Parser Fix'),
          h('p', null, 'Fixed a bug in the Discord bot where the skippable wargear map was not passed to the list parser, preventing default/skippable wargear from being correctly identified and hidden on subunits.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.6.3 - Release & Cache-Busting Fix'),
          h('p', null, 'Fixed a browser caching issue by automatically updating build metadata and cache-busting keys at release time. Added Khorne Berzerker spelling variants to World Eaters skippable wargear rules.')),
        h('div', { class: 'changelog-version-entry' },
          h('h5', null, 'Version 1.6.2 - Subunit Auto-Hiding Optimization'),
          h('p', null, 'Automatically keep subunits hidden (even with the show subunits option checked) if all of their wargear is hidden or skippable based on the faction\'s skippable wargear definitions.')),
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