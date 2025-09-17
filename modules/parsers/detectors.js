// detectors.js
// Simple scored-rule detector for parser formats (NRNR-focused)

function firstNLines(textOrLines, n = 40) {
  const lines = Array.isArray(textOrLines) ? textOrLines : String(textOrLines || '').split(/\r?\n/);
  return lines.slice(0, n);
}

// Detect among known parser formats: NRNR, WTC-Compact, GWAPP, NR-GW
export function detectFormat(textOrLines) {
  const lines = Array.isArray(textOrLines) ? textOrLines : String(textOrLines || '').split(/\r?\n/);
  const head = firstNLines(lines, 40);
  const whole = lines.join('\n');

  // Per-format breakdowns
  const formats = {
    NRNR: { score: 0, breakdown: {} , maxScore: 8},
  'WTC-Compact': { score: 0, breakdown: {} , maxScore: 8},
  WTC: { score: 0, breakdown: {}, maxScore: 8 },
    GWAPP: { score: 0, breakdown: {} , maxScore: 7},
    'NR-GW': { score: 0, breakdown: {} , maxScore: 7},
    LF: { score: 0, breakdown: {} , maxScore: 7}
  };

  // Shared regexes
  const bracketedPtsTitle = head.some(l => /-\s*\[\s*\d{2,5}\s*pts?\s*\]$/i.test(l));
  const markdownHeading = head.some(l => /^#{1,3}\s+/.test(l));
  const armyRosterBanner = head.some(l => /^\s*#?\s*\+\+\s*Army Roster\s*\+\+/i.test(l));
  const hasDoubleHashSections = head.some(l => /^\s*##\s+/.test(l));
  const unitLineRe = /(.+?)\s*[\(\[]\s*([0-9]{1,4})\s*(?:pts|points)\s*[\)\]]/i;
  const unitMatches = whole.match(new RegExp(unitLineRe.source, 'g')) || [];
  const bulletWithQty = whole.match(/^[ \t]*(?:•|\-|\+)\s*(?:\d+x?)\s+[^:]+:/gmi) || [];
  const parenItem = whole.match(/\b[A-Za-z0-9\-\'’ ]+\s*\([^\)]+\)/g) || [];
  // compact inline unit lines often use a pattern like:
  // "Char2: 1x Commander ... (115 pts): 2x Shield Drone, ..."
  const compactInlineUnitRe = /(^|\n)\s*Char\d+:.*\(\s*\d{1,4}\s*(?:pts|points)\s*\)\s*:\s*/i;
  const compactInlineCount = (whole.match(new RegExp(compactInlineUnitRe.source, 'gi')) || []).length;
  // LF cues: header keys or title pattern, section headers with colon case styles, bullets with nested indents
  const lfHeaderKeys = head.some(l => /^(List Name|Factions Used|Army Points|Detachment Rule):/i.test(l.trim()));
  const lfTitleLine = head.some(l => /-\s*\(\s*\d+\s*Points?\s*\)\s*$/i.test(l));
  const lfSectionColon = whole.match(/^(Epic Hero|Epic Heroes|Character|Characters|Battleline|Infantry|Beast|Vehicle|Dedicated Transport|Other Datasheets):\s*$/gmi) || [];
  const lfEnhLines = (whole.match(/^\s*•\s*(?:E:|Enhancement:)/gmi) || []).length;
  const lfBullets = (whole.match(/^\s*•\s+/gmi) || []).length;
  if (lfHeaderKeys) { formats.LF.score += 4; formats.LF.breakdown.headerKeys = 4; }
  if (lfTitleLine) { formats.LF.score += 4; formats.LF.breakdown.titleLine = 4; }
  if (lfSectionColon.length >= 2) { formats.LF.score += 3; formats.LF.breakdown.sectionColons = lfSectionColon.length; }
  if (lfBullets > 5) { formats.LF.score += 1; formats.LF.breakdown.bullets = lfBullets; }
  if (lfEnhLines > 0) { formats.LF.score += 1; formats.LF.breakdown.enhancementLines = lfEnhLines; }
  // Penalize other formats slightly when strong LF signals present
  if (lfHeaderKeys || lfTitleLine || lfSectionColon.length >= 2) {
    formats.NRNR.score -= 1; formats.WTC.score -= 1; formats['WTC-Compact'].score -= 1; formats.GWAPP.score -= 1; formats['NR-GW'].score -= 3;
  }

  // NRNR signals
  if (bracketedPtsTitle) { formats.NRNR.score += 2; formats.NRNR.breakdown.titleWithBracketedPts = 2; }
  if (markdownHeading) { formats.NRNR.score += 3; formats.NRNR.breakdown.markdownHeading = 3; }
  if (armyRosterBanner) { formats.NRNR.score += 2; formats.NRNR.breakdown.armyRoster = 2; }
  if (hasDoubleHashSections) { formats.NRNR.score += 1; formats.NRNR.breakdown.doubleHashSections = 1; }
  if (unitMatches.length >= 3) { formats.NRNR.score += 1; formats.NRNR.breakdown.unitLines = 1; }
  if (bulletWithQty.length > 0) { formats.NRNR.score += 1; formats.NRNR.breakdown.bulletWithQty = bulletWithQty.length; }
  if (parenItem.length > 0) { formats.NRNR.score += 0.5; formats.NRNR.breakdown.parenItem = parenItem.length; }

  // WTC-Compact signals: header lines starting with + or & and keys like FACTION KEYWORD
  const headStr = head.join('\n');
  if (/^[ \t]*[+&]/m.test(headStr)) { formats['WTC-Compact'].score += 3; formats['WTC-Compact'].breakdown.headerPlusAmp = 3; }
  if (/(FACTION KEYWORD|DETACHMENT|TOTAL ARMY POINTS)/i.test(headStr)) { formats['WTC-Compact'].score += 2; formats['WTC-Compact'].breakdown.headerKeys = 2; }
  if (unitMatches.length >= 2) { formats['WTC-Compact'].score += 1; formats['WTC-Compact'].breakdown.unitLines = 1; }
  // If we find inline CharN unit lines that include a ':' after the points,
  // that's a strong signal for the compact format.
  if (compactInlineCount > 0) { formats['WTC-Compact'].score += 5; formats['WTC-Compact'].breakdown.inlineCharList = compactInlineCount; }

  // WTC (non-compact) signals: plus-header is used, but presence of CharN markers and explicit "NUMBER OF UNITS" favors WTC
  if (/^\s*[+&]/m.test(headStr)) { formats.WTC.score += 1; formats.WTC.breakdown.headerPlusAmp = 1; }
  if (/NUMBER OF UNITS:/i.test(headStr)) { formats.WTC.score += 2; formats.WTC.breakdown.numberOfUnits = 2; }
  const hasBodyCharMarkers = (whole.match(/(^|\n)\s*Char\d+:/gi) || []).length > 0;
  if (hasBodyCharMarkers) { formats.WTC.score += 3; formats.WTC.breakdown.charMarkers = 3; }
  // If markdown-esque NRNR signals are present, reduce WTC/WTC-Compact weighting
  if (markdownHeading || armyRosterBanner || hasDoubleHashSections) {
    formats.WTC.score -= 2; formats.WTC.breakdown.nrnrPenalty = -2;
    formats['WTC-Compact'].score -= 1; formats['WTC-Compact'].breakdown.nrnrPenalty = -1;
  }
  // WTC and WTC-Compact commonly use lines like 'N with Foo, Bar'
  const withLines = (whole.match(/^\s*\d+\s+with\s+/gmi) || []).length;
  if (withLines > 0) { formats.WTC.score += 2; formats.WTC.breakdown.withLines = withLines; formats['WTC-Compact'].score += 2; formats['WTC-Compact'].breakdown.withLines = withLines; }
  // uppercase section headers like CHARACTER / OTHER DATASHEETS are common in WTC
  if (head.some(l => /^(?:CHARACTER|OTHER DATASHEETS|CHARACTERS)\s*$/.test((l||'').trim()))) { formats.WTC.score += 1; formats.WTC.breakdown.sectionHeaders = 1; }
  // If CharN markers are present, penalize WTC-Compact slightly so WTC wins
  if (hasBodyCharMarkers) { formats['WTC-Compact'].score -= 1; formats['WTC-Compact'].breakdown.charMarkerPenalty = -1; }
  // But if compactInlineCount exists, boost WTC-Compact and reduce WTC.
  if (compactInlineCount > 0) { formats.WTC.score -= 2; formats.WTC.breakdown.compactInlinePenalty = -2; }

  // GWAPP signals: 'Exported with' in header, uppercase section headers like CHARACTERS
  const exportedWithWhole = /Exported with/i.test(whole);
  if (/Exported with/i.test(headStr) || exportedWithWhole) { formats.GWAPP.score += 6; formats.GWAPP.breakdown.exportedWith = 6; }
  if (/\b(CHARACTERS|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS)\b/i.test(whole)) { formats.GWAPP.score += 2; formats.GWAPP.breakdown.sectionHeaders = 2; }
  if (/\(\s*\d+\s*(?:pts|points)\s*\)/i.test(headStr)) { formats.GWAPP.score += 1; formats.GWAPP.breakdown.titleParenPts = 1; }
  // Presence of 'Exported with' is exclusive to GWAPP; reduce NR-GW when seen
  if (exportedWithWhole) { formats['NR-GW'].score -= 4; formats['NR-GW'].breakdown.gwappPenalty = -4; }
  // Additional GWAPP cues (common in app exports)
  if (/^\s*Strike Force\s*\(\s*\d{2,5}\s*points\s*\)/mi.test(whole)) { formats.GWAPP.score += 3; formats.GWAPP.breakdown.strikeForce = 3; }

  // NR-GW signals: uppercase section headers without markdown, bullet nesting, parenthetical enhancements
  if (/\b(CHARACTERS|BATTLELINE|OTHER DATASHEETS|DEDICATED TRANSPORTS)\b/i.test(whole)) { formats['NR-GW'].score += 2; formats['NR-GW'].breakdown.sectionHeaders = 2; }
  const bulletCount = (whole.match(/^[ \t]*(?:•|\u2022|◦|\-|\+)\s+/gmi) || []).length;
  if (bulletCount > 0 && !exportedWithWhole) { formats['NR-GW'].score += 1; formats['NR-GW'].breakdown.bulletCount = bulletCount; }
  if (parenItem.length > 0 && !exportedWithWhole) { formats['NR-GW'].score += 1; formats['NR-GW'].breakdown.parenItem = parenItem.length; }

  // Additional NR-GW heuristics (appended): explicit bullet quantities and unit-line patterns
  const bulletQtyCount = (whole.match(/^[ \t]*(?:•|\u2022|◦|\-|\+)\s*\d+x?\s+[A-Za-z0-9\-\'’]+/gmi) || []).length;
  if (bulletQtyCount >= 3 && !hasBodyCharMarkers && !exportedWithWhole) { formats['NR-GW'].score += 3; formats['NR-GW'].breakdown.bulletQty = bulletQtyCount; }
  const unitLineRePlain = /^(?:\s*)\d+x?\s+.*\(\s*\d{1,4}\s*(?:pts|points)\s*\)/i;
  const unitLineCountPlain = lines.filter(l => unitLineRePlain.test(l)).length;
  if (unitLineCountPlain >= 2 && !hasBodyCharMarkers && !exportedWithWhole) { formats['NR-GW'].score += 2; formats['NR-GW'].breakdown.unitLinesNoChar = unitLineCountPlain; }
  if (!hasBodyCharMarkers && !exportedWithWhole && (bulletQtyCount >= 3 || unitLineCountPlain >= 2)) {
    formats.WTC.score -= 2; formats.WTC.breakdown.nrGwPenalty = -2;
    formats['WTC-Compact'].score -= 2; formats['WTC-Compact'].breakdown.nrGwPenalty = -2;
  }
  // NRNR presence should also slightly reduce NR-GW confidence
  if (markdownHeading || armyRosterBanner) { formats['NR-GW'].score -= 1; formats['NR-GW'].breakdown.nrnrPenalty2 = -1; }

  // small positive for smart apostrophe presence across all formats
  if (whole.indexOf("’") !== -1) {
    for (const k of Object.keys(formats)) { formats[k].score += 0.5; formats[k].breakdown = formats[k].breakdown || {}; formats[k].breakdown.unicodeApostrophe = 0.5; }
  }

  // Compute normalized confidences per format
  const results = {};
  for (const key of Object.keys(formats)) {
    const f = formats[key];
    const confidence = Math.max(0, Math.min(1, f.score / (f.maxScore || 8)));
    results[key] = { score: f.score, confidence, scoreBreakdown: f.breakdown };
  }

  // Pick best candidate
  const best = Object.keys(results).sort((a,b) => results[b].score - results[a].score)[0];
  const bestResult = results[best] || { score: 0, confidence: 0 };

  return { format: best, confidence: bestResult.confidence, score: bestResult.score, scoreBreakdown: bestResult.scoreBreakdown, all: results };
}

export default { detectFormat };
