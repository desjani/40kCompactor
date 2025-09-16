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
    GWAPP: { score: 0, breakdown: {} , maxScore: 7},
    'NR-GW': { score: 0, breakdown: {} , maxScore: 7}
  };

  // Shared regexes
  const bracketedPtsTitle = head.some(l => /-.*\[\s*\d{2,5}\s*pts?\s*\]$/.test(l));
  const markdownHeading = head.some(l => /^#{1,2}\s+/.test(l));
  const unitLineRe = /(.+?)\s*[\(\[]\s*([0-9]{1,4})\s*(?:pts|points)\s*[\)\]]/i;
  const unitMatches = whole.match(new RegExp(unitLineRe.source, 'g')) || [];
  const bulletWithQty = whole.match(/^[ \t]*(?:•|\-|\+)\s*(?:\d+x?)\s+[^:]+:/gmi) || [];
  const parenItem = whole.match(/\b[A-Za-z0-9\-\'’ ]+\s*\([^\)]+\)/g) || [];

  // NRNR signals
  if (bracketedPtsTitle) { formats.NRNR.score += 2; formats.NRNR.breakdown.titleWithBracketedPts = 2; }
  if (markdownHeading) { formats.NRNR.score += 3; formats.NRNR.breakdown.markdownHeading = 3; }
  if (unitMatches.length >= 3) { formats.NRNR.score += 1; formats.NRNR.breakdown.unitLines = 1; }
  if (bulletWithQty.length > 0) { formats.NRNR.score += 1; formats.NRNR.breakdown.bulletWithQty = bulletWithQty.length; }
  if (parenItem.length > 0) { formats.NRNR.score += 0.5; formats.NRNR.breakdown.parenItem = parenItem.length; }

  // WTC-Compact signals: header lines starting with + or & and keys like FACTION KEYWORD
  const headStr = head.join('\n');
  if (/^[ \t]*[+&]/m.test(headStr)) { formats['WTC-Compact'].score += 3; formats['WTC-Compact'].breakdown.headerPlusAmp = 3; }
  if (/(FACTION KEYWORD|DETACHMENT|TOTAL ARMY POINTS)/i.test(headStr)) { formats['WTC-Compact'].score += 2; formats['WTC-Compact'].breakdown.headerKeys = 2; }
  if (unitMatches.length >= 2) { formats['WTC-Compact'].score += 1; formats['WTC-Compact'].breakdown.unitLines = 1; }

  // GWAPP signals: 'Exported with' in header, uppercase section headers like CHARACTERS
  if (/Exported with/i.test(headStr)) { formats.GWAPP.score += 3; formats.GWAPP.breakdown.exportedWith = 3; }
  if (/(CHARACTERS|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS)/i.test(whole)) { formats.GWAPP.score += 2; formats.GWAPP.breakdown.sectionHeaders = 2; }
  if (/\(\s*\d+\s*(?:pts|points)\s*\)/i.test(headStr)) { formats.GWAPP.score += 1; formats.GWAPP.breakdown.titleParenPts = 1; }

  // NR-GW signals: uppercase section headers without markdown, bullet nesting, parenthetical enhancements
  if (/(CHARACTERS|BATTLELINE|OTHER DATASHEETS|DEDICATED TRANSPORTS)/.test(whole)) { formats['NR-GW'].score += 2; formats['NR-GW'].breakdown.sectionHeaders = 2; }
  const bulletCount = (whole.match(/^[ \t]*(?:•|\-|\+|◦)\s+/gmi) || []).length;
  if (bulletCount > 0) { formats['NR-GW'].score += 1; formats['NR-GW'].breakdown.bulletCount = bulletCount; }
  if (parenItem.length > 0) { formats['NR-GW'].score += 1; formats['NR-GW'].breakdown.parenItem = parenItem.length; }

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
