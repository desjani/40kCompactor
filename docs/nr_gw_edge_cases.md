NR_GW Parser: Edge cases and rule proposals

Goal: catalog format quirks in NR_GW lists and propose deterministic parser rules we can implement and test.

1) Header variations
- + lines with 'FACTION KEYWORD', 'DETACHMENT', 'TOTAL ARMY POINTS' (already handled).
- + ENHANCEMENT: may include '(on CharN: ...)' or '(on <unit name>)'.
- Non-breaking spaces (U+00A0) appear inside header values (e.g., 'Retaliation\u00A0Cadre').
- Proposal: normalize spaces, map curly apostrophes to straight, and support both CharN and name-targeted enhancements.

2) Section markers
- NR_GW uses explicit GW-style section headers (CHARACTER, OTHER DATASHEETS, etc.) but may still include a + header block above.
- Proposal: detect header block then delegate to GW body parsing (current approach).

3) Enhancement placement
- Enhancements may appear in the + header or as a bullet under a Character with or without the 'Enhancement:' prefix (e.g., 'Starflare Ignition System (+20 pts)' or 'Enhancement: Helm of Brazen Ire').
- Proposal: treat bullets that end with '(NN pts)' or '(+NN pts)' as enhancements; support both explicit 'Enhancement:' prefix and header-specified '&' or '+ ENHANCEMENT:' entries.

4) Nested bullets / indent variations
- Deeply nested bullets may use '•' for levels or spaces with child lines that don't start with bullets.
- Some lines use an additional indent level with no bullet (e.g., '    1x Fusion blaster').
- Proposal: when blockIsComplex detect a currentSubunit and attach any bullets/indented lines with greater indent to that subunit; treat plain indented lines under a bullet as subitems of the nearest higher bullet.

5) Inline subunit lists vs colon-separated wargear
- Some formats place wargear inline after a colon on the same line (WTC-Compact style) while NR_GW/GW place them on bullets underneath.
- Proposal: support both; for inline lists, add items to the unit directly; for bullet lists, create subunits where appropriate.

6) Quantity semantics
- Lines like '• 2x Stealth Shas'ui' or '• 2x Battlesuit fists' or '    1 with Shield Drone' indicate counts.
- Proposal: honor leading quantity prefixes, and accept 'N with ...' patterns on indented bullets (attach to last subunit if present, otherwise unit).

7) Repeated subunit names & aggregation
- Multiple repeated '3x Stealth Battlesuits' blocks appear; later step should optionally aggregate same-named subunits into a single unit with combined items.
- Proposal: implement post-pass aggregation for subunits when all names match unit top-name (or when safe), summing quantities and merging inner items.

8) Warlord / special-name handling
- Literal 'Warlord' lines must be treated as 'special' type not wargear to prevent abbreviation.
- Proposal: keep parser forcing 'Warlord' type to 'special' and ensure abbreviation builder skips it.

9) Nonstandard punctuation and diacritics
- Curly apostrophes (’), accents, and unusual quotes appear frequently.
- Proposal: normalize apostrophes and remove diacritics when doing key matches (FAMILY_MAP, unit name compares).

10) Points parsing
- Points sometimes include commas or are in parenthesis attached to list titles.
- Proposal: robust number extraction by stripping non-digits when parsing points.

11) Targets for header enhancements
- Header enh may specify target by Char index 'Char3' or by a unit name present in body.
- Proposal: prefer CharN mapping if present; otherwise find best name match; fallback to attach to the single unit if only one found.

12) Tests to add
- A suite of small examples exercising: header-only enhancement, CharN header enhancement, name-target header enhancement, enhancement as bullet (with and without prefix), repeated subunit aggregation, nested bullets with plain indented lines, 'N with ...' under bullets.

"Next steps"
- Implement aggregation pass (merge same-named subunits) with tests.
- Improve nested bullet attach heuristics where child-lines (without bullets) should roll into parent bullets.
- Add small sample files for each edge case and expand the NR_GW test suite.


