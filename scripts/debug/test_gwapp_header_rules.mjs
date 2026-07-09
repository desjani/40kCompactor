import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import FAMILY_MAP from '../modules/family_map.js';

async function main() {
  const inputArg = process.argv[2];
  const fileUrl = inputArg ? pathToFileURL(inputArg) : new URL('../samples/GWAPPSample.txt', import.meta.url);
  const txt = await fs.readFile(fileUrl, 'utf8');
  const rawLines = txt.split(/\r?\n/);
  // Normalize lines and find header block (lines before first section header)
  const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i;
  const lines = rawLines.map(l => (l || '').trim());

  // LIST_TITLE is always the very first non-empty line
  const firstNonEmptyIndex = lines.findIndex(l => l !== '');
  if (firstNonEmptyIndex === -1) {
    console.error('No non-empty lines in input');
    process.exit(2);
  }
  const listTitleLine = lines[firstNonEmptyIndex];

  // Extract LIST_TITLE (text before parentheses) and TOTAL_ARMY_POINTS from that line
  const listTitleMatch = listTitleLine.match(/^(.*?)\s*\((\s*\d+\s*(?:pts|points)\s*)\)\s*$/i);
  let LIST_TITLE = listTitleLine;
  let TOTAL_ARMY_POINTS = '';
  if (listTitleMatch) {
    LIST_TITLE = listTitleMatch[1].trim();
    const ptsRaw = listTitleMatch[2].replace(/\s+/g, '');
    // Normalize to NNNNpts
    const digits = (ptsRaw.match(/(\d+)/) || [])[1] || '';
    if (digits) TOTAL_ARMY_POINTS = `${digits}pts`;
  }

  // Collect header candidate rows: lines after LIST_TITLE up to first section header
  const headerCandidates = [];
  for (let i = firstNonEmptyIndex + 1; i < lines.length; i++) {
    const t = lines[i];
    if (!t) continue; // skip blanks
    if (sectionHeaderRegex.test(t.toUpperCase())) break;
    headerCandidates.push(t);
  }

  // Rule: ignore rows that are game-size indicators when they contain the keywords and a parenthetical
  const gameSizeKeywords = ['Combat Patrol', 'Incursion', 'Strike Force', 'Onslaught'];
  function isGameSizeIndicator(s) {
    if (!s) return false;
    if (!/\(/.test(s)) return false; // must include parenthetical
    for (const k of gameSizeKeywords) if (new RegExp(k, 'i').test(s)) return true;
    return false;
  }

  // Eliminate any rows that match any of the family values in FAMILY_MAP
  const familyValues = new Set(Object.values(FAMILY_MAP).map(v => (v || '').toString().toLowerCase()));

  const filtered = headerCandidates.filter(r => {
    if (!r) return false;
    if (isGameSizeIndicator(r)) return false;
    if (familyValues.has(r.toLowerCase())) return false;
    return true;
  });

  // Now we expect two rows: one that matches skippable_wargear top-level keys (faction), the other is detachment
  const skippableJson = JSON.parse(await fs.readFile(new URL('../skippable_wargear.json', import.meta.url), 'utf8'));
  const skippableKeys = Object.keys(skippableJson || {}).map(k => k.toString().toLowerCase());

  let faction = null;
  let detachment = null;

  for (const r of filtered) {
    if (skippableKeys.includes(r.toLowerCase())) {
      faction = r;
    } else {
      // If a line contains a '(' and not a game size (but we've filtered game sizes), strip parenthetical text for matching
      detachment = r;
    }
  }

  // If we found a faction but not detachment and filtered contains two rows, pick the non-faction as detachment
  if (!detachment && filtered.length === 2) {
    detachment = filtered.find(r => r.toLowerCase() !== (faction || '').toLowerCase());
  }

  // Build DISPLAY_FACTION using FAMILY_MAP: prefer 'Family - Faction' when available
  let displayFaction = null;
  if (faction) {
    // case-insensitive lookup into FAMILY_MAP
    const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === faction.toLowerCase());
    const family = familyKey ? FAMILY_MAP[familyKey] : null;
    displayFaction = family ? `${family} - ${faction}` : `${faction}${detachment ? ' - ' + detachment : ''}`;
  } else if (detachment) {
    displayFaction = detachment;
  }

  const SUMMARY = {
    LIST_TITLE,
    TOTAL_ARMY_POINTS,
    FACTION_KEYWORD: faction || null,
    DETACHMENT: detachment || null,
    DISPLAY_FACTION: displayFaction
  };

  console.log(JSON.stringify(SUMMARY, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
