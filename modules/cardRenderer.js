import factionColors from './faction_colors.js';
import { makeAbbrevForName } from './abbreviations.js';
import { maybeCombineUnits, getWarlordTag, abbreviateDetachment, abbreviateForceDisposition, abbreviateWords } from './renderers.js';
import { getModelsCount, getCanonicalFactionName, normalizeKey } from './utils.js';
import factionEmblems from './faction_icons.js';

function getContrastColor(hexColor) {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

const colorNameToHex = {
    black: '#000000', red: '#FF0000', green: '#00FF00', yellow: '#FFFF00', blue: '#0000FF',
    magenta: '#FF00FF', cyan: '#00FFFF', white: '#FFFFFF', grey: '#808080'
};

const premiumFactionColors = {
  "T'au Empire": {
    primary: '#ff7f00',   // T'au Orange
    secondary: '#00ffff', // Glowing Cyan
    background: '#18181b', // Zinc 900
    cardBg: '#27272a',     // Zinc 800
    attachedBg: '#1f1f23', // Darker zinc for grouping container
    text: '#f4f4f5',
    textSecondary: '#a1a1aa'
  },
  "World Eaters": {
    primary: '#b20000',   // Blood Red
    secondary: '#d4af37', // Brass Gold
    background: '#151518', // Matte black
    cardBg: '#222226',     // Off-black card
    attachedBg: '#1b1b1f',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa'
  },
  "Space Marines": {
    primary: '#0054a6',   // Ultramarine Blue
    secondary: '#f5c400', // Gold
    background: '#18181b',
    cardBg: '#27272a',
    attachedBg: '#1f1f23',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa'
  },
  "Adeptus Custodes": {
    primary: '#d4af37',   // Custodes Gold
    secondary: '#b20000', // Crimson Red
    background: '#1c1917',
    cardBg: '#292524',
    attachedBg: '#211f1d',
    text: '#fafaf9',
    textSecondary: '#a8a29e'
  },
  "Necrons": {
    primary: '#39ff14',   // Gauss Green
    secondary: '#8e9095', // Silver
    background: '#111827',
    cardBg: '#1f2937',
    attachedBg: '#18202c',
    text: '#f9fafb',
    textSecondary: '#9ca3af'
  }
};

// Helper to resolve faction color variables
export function resolveColors(factionName, options = {}) {
  factionName = getCanonicalFactionName(factionName);
  const mode = options.colorMode || 'faction';
  
  if (mode === 'custom' && options.colors) {
    const c = options.colors;
    return {
      primary: c.unit || '#ffffff',
      secondary: c.points || '#ffff00',
      background: '#18181b',
      cardBg: '#27272a',
      attachedBg: '#1f1f23',
      text: '#f4f4f5',
      textSecondary: '#a1a1aa',
      header: c.header || '#ffffff',
      unit: c.unit || '#ffffff',
      subunit: c.subunit || '#808080',
      wargear: c.wargear || '#ffffff',
      points: c.points || '#ffff00',
      attached: c.attached || '#ffff00',
      icon: c.icon || c.header || '#ffffff'
    };
  }

  if (mode === 'none') {
    return {
      primary: '#ffffff',
      secondary: '#ffffff',
      background: '#18181b',
      cardBg: '#27272a',
      attachedBg: '#1f1f23',
      text: '#f4f4f5',
      textSecondary: '#a1a1aa',
      header: '#ffffff',
      unit: '#ffffff',
      subunit: '#808080',
      wargear: '#ffffff',
      points: '#ffffff',
      attached: '#ffffff',
      icon: '#ffffff'
    };
  }

  const normalized = (factionName || '').replace(/[\u2018\u2019]/g, "'");
  if (premiumFactionColors[normalized]) {
    const p = premiumFactionColors[normalized];
    return {
      ...p,
      header: p.primary,
      unit: p.primary,
      subunit: p.textSecondary,
      wargear: p.textSecondary,
      points: p.secondary,
      attached: p.secondary,
      icon: p.primary
    };
  }

  // Fallback to basic faction colors from configuration
  const entry = factionColors[normalized] || factionColors[normalized.toLowerCase()] || {};
  const primaryName = entry.unit || 'white';
  const secondaryName = entry.points || 'yellow';
  const subunitName = entry.subunit || 'grey';
  const wargearName = entry.wargear || 'white';
  const headerName = entry.header || primaryName;
  const attachedName = entry.attached || secondaryName;
  
  const primary = colorNameToHex[primaryName.toLowerCase()] || '#ffffff';
  const secondary = colorNameToHex[secondaryName.toLowerCase()] || '#ffff00';
  const subunit = colorNameToHex[subunitName.toLowerCase()] || '#808080';
  const wargear = colorNameToHex[wargearName.toLowerCase()] || '#ffffff';
  const header = colorNameToHex[headerName.toLowerCase()] || primary;
  const attached = colorNameToHex[attachedName.toLowerCase()] || secondary;

  return {
    primary: primary,
    secondary: secondary,
    background: '#18181b',
    cardBg: '#27272a',
    attachedBg: '#1f1f23',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa',
    header: header,
    unit: primary,
    subunit: subunit,
    wargear: wargear,
    points: secondary,
    attached: attached,
    icon: header
  };
}

// Helper to generate initials emblem (HTML-based to prevent Satori SVG <text> limit errors)
function makeInitialsEmblem(name, colors) {
  const words = (name || 'Army').split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 2px solid ${colors.primary};
      border-radius: 18px;
      box-sizing: border-box;
    ">
      <span style="
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: bold;
        color: ${colors.secondary};
      ">
        ${initials}
      </span>
    </div>
  `;
}

export function estimateCardWidth(data, options = {}) {
  if (!data) return 580;
  const rawUnits = Array.isArray(data.units) ? data.units : [];
  const units = maybeCombineUnits(rawUnits, options.hideSubunits, options.combineIdenticalUnits);

  const showMandatory = !!options.showMandatoryWargear;
  const showMode = options.wargearShowMode || (showMandatory ? 'show-all' : 'hide-mandatory');

  let maxPixelWidth = 320; // fallback minimum content width

  // Header info
  const summary = data.metadata || {};
  const listName = summary.title || summary.armyName || 'Warhammer 40k List';
  const detachment = summary.detachment || (summary.detachments && summary.detachments.join(' & ')) || '';
  
  let disps = '';
  if (Array.isArray(summary.forceDispositions) && summary.forceDispositions.length > 0) {
      if (options.abbreviateHeader) {
          disps = summary.forceDispositions.map(d => abbreviateWords(d)).join(', ');
      } else {
          disps = summary.forceDispositions.join(', ');
      }
  } else if (summary.forceDisposition) {
      if (options.abbreviateHeader) {
          disps = abbreviateForceDisposition(summary.forceDisposition);
      } else {
          disps = summary.forceDisposition;
      }
  }
  
  let finalDetachment = detachment;
  if (options.abbreviateHeader && detachment) {
      finalDetachment = abbreviateDetachment(detachment);
  }
  
  const subtitleParts = [finalDetachment, disps].filter(Boolean);
  const subtitle = subtitleParts.join(' • ');

  const pointsTotal = summary.pointsTotal || summary.totalPoints || 0;
  const pointsStr = pointsTotal.toLocaleString() + ' pts';
  
  // Header: List name (18px, bold) + Faction Icon (36px wide + 12px gap) + Points Pill
  // Points Pill has 6px 14px padding (so 28px horizontal padding) + 1px border + 15px bold text
  const listNameWidth = listName.length * 9.5;
  const pointsPillWidth = options.hidePoints ? 0 : (pointsStr.length * 8.2 + 30);
  const headerLineWidth = 48 + 36 + 12 + listNameWidth + (pointsPillWidth ? (12 + pointsPillWidth) : 0);
  maxPixelWidth = Math.max(maxPixelWidth, headerLineWidth);

  // Subtitle: Detachment / Force disposition (12px, normal)
  const subtitleWidth = 48 + 36 + 12 + (subtitle.length * 6.5);
  maxPixelWidth = Math.max(maxPixelWidth, subtitleWidth);

  const getAbbrName = (itemName) => {
    if (!options.useAbbreviations) return itemName;
    if (options.wargearAbbrMap && options.wargearAbbrMap.__flat_abbr) {
      const key = normalizeKey(itemName);
      const val = options.wargearAbbrMap.__flat_abbr[key];
      if (val) {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.abbr) return val.abbr;
      }
    }
    return makeAbbrevForName(itemName);
  };

  const getUnitAbbrName = (itemName) => {
    if (!options.abbreviateUnitNames) return itemName;
    if (options.wargearAbbrMap && options.wargearAbbrMap.__flat_abbr) {
      const key = normalizeKey(itemName);
      const val = options.wargearAbbrMap.__flat_abbr[key];
      if (val) {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.abbr) return val.abbr;
      }
    }
    return makeAbbrevForName(itemName);
  };

  const getUnitDetails = (unit) => {
    const parts = [];
    if (Array.isArray(unit.enhancements)) {
      unit.enhancements.forEach(e => {
        parts.push(`E: ${getAbbrName(e.name)}`);
      });
    }
    if (options.hideSubunits) {
      const aggregated = new Map();
      if (Array.isArray(unit.wargear)) {
        unit.wargear.forEach(wg => {
          const key = wg.name;
          const qtyVal = parseInt(wg.quantity || 1, 10);
          const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
          aggregated.set(key, { quantity: prev.quantity + qtyVal, skippable: prev.skippable || !!wg.skippable });
        });
      }
      if (Array.isArray(unit.subunits)) {
        unit.subunits.forEach(sub => {
          if (Array.isArray(sub.wargear)) {
            sub.wargear.forEach(wg => {
              const key = wg.name;
              const qtyVal = parseInt(wg.quantity || 1, 10);
              const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
              aggregated.set(key, { quantity: prev.quantity + qtyVal, skippable: prev.skippable || !!wg.skippable });
            });
          }
        });
      }
      const wargearList = Array.from(aggregated.entries()).map(([name, info]) => ({
        name,
        quantity: info.quantity,
        skippable: info.skippable
      }));
      wargearList.sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.name.localeCompare(b.name);
      });
      wargearList.filter(w => {
        if (showMode === 'show-all') return true;
        if (showMode === 'hide-all') return false;
        return !w.skippable;
      }).forEach(w => {
        const nameAbbr = getAbbrName(w.name);
        parts.push(w.quantity > 1 ? `${w.quantity}x ${nameAbbr}` : nameAbbr);
      });
    } else {
      if (Array.isArray(unit.wargear)) {
        unit.wargear.filter(w => {
          if (showMode === 'show-all') return true;
          if (showMode === 'hide-all') return false;
          return !w.skippable;
        }).forEach(w => {
          const q = parseInt(w.quantity || 1, 10);
          parts.push(q > 1 ? `${q}x ${getAbbrName(w.name)}` : getAbbrName(w.name));
        });
      }
    }
    return parts;
  };

  const processUnitLines = (unit, attachedIndex, isAttachedPart) => {
    const finalUnitName = getUnitAbbrName(unit.name);
    let nameLen = finalUnitName.length;
    const wTag = getWarlordTag(unit, options.hideBrackets);
    nameLen += wTag ? wTag.length + 1 : 0;
    
    const G = (unit.__groupCount !== undefined) ? unit.__groupCount : 1;
    const M = (unit.__unitSize !== undefined) ? unit.__unitSize : getModelsCount(unit);
    let qtyStr = '';
    if (G > 1) {
      qtyStr = M > 1 ? `${G}x${M} ` : `${G}x `;
    } else {
      qtyStr = M > 1 ? `${M} ` : '';
    }
    nameLen += qtyStr.length;

    // Baseline horizontal space occupied by containers around this line
    // Outer card: 24px left + 24px right = 48px padding
    // Unit container: 16px left + 16px right = 32px padding
    // Total standard: 80px
    let baselineOffset = 80;
    if (isAttachedPart) {
      // Attached container: border-left 3px, padding-left 12px, margin-left 4px = 19px
      baselineOffset += 19;
    }

    const details = getUnitDetails(unit);
    const showInlineDetails = !!options.useAbbreviations;
    const unitPointsStr = options.hidePoints ? '' : (options.hideBrackets ? `${unit.points} pts` : `[${unit.points} pts]`);

    // Left side width: Unit Name (15px, bold)
    const nameWidth = nameLen * 8.2;
    // Right side width: Points (14px, bold)
    const pointsWidth = unitPointsStr.length * 7.5;

    if (showInlineDetails) {
      const badgesWidth = details.reduce((sum, d) => sum + (d.length * 5.5 + 12) + 8, 0);
      const totalLineLen = nameWidth + (pointsWidth ? (20 + pointsWidth) : 0) + badgesWidth;
      maxPixelWidth = Math.max(maxPixelWidth, baselineOffset + totalLineLen);
    } else {
      maxPixelWidth = Math.max(maxPixelWidth, baselineOffset + nameWidth + (pointsWidth ? (30 + pointsWidth) : 0));
      if (details.length > 0) {
        const badgesWidth = details.reduce((sum, d) => sum + (d.length * 6.0 + 16) + 6, 0);
        maxPixelWidth = Math.max(maxPixelWidth, baselineOffset + badgesWidth);
      }
    }

    if (!options.hideSubunits && Array.isArray(unit.subunits)) {
      unit.subunits.forEach(sub => {
        const q = parseInt(sub.quantity || 1, 10);
        const prefix = q > 1 ? `${q}x ` : '';
        const bulletChar = options.noBullets ? '' : '• ';
        const finalSubName = getUnitAbbrName(sub.name);
        const subNameText = `${bulletChar}${prefix}${finalSubName}`;
        
        const subNameWidth = subNameText.length * 7.0;

        const wgs = (sub.wargear || []).filter(w => {
          if (showMode === 'show-all') return true;
          if (showMode === 'hide-all') return false;
          return !w.skippable;
        });
        const badgesWidth = wgs.reduce((sum, w) => {
          const wq = parseInt(w.quantity || 1, 10);
          const nameAbbr = getAbbrName(w.name);
          const text = wq > 1 ? `${wq}x ${nameAbbr}` : nameAbbr;
          return sum + (text.length * 5.0 + 10) + 6;
        }, 0);

        const totalSubunitLineWidth = subNameWidth + (badgesWidth ? (6 + badgesWidth) : 0);
        maxPixelWidth = Math.max(maxPixelWidth, baselineOffset + totalSubunitLineWidth);
      });
    }
  };

  let attachedIndex = 0;
  units.forEach(unit => {
    if (unit.isAttached && Array.isArray(unit.attachedParts)) {
      attachedIndex++;
      unit.attachedParts.forEach(part => {
        processUnitLines(part, attachedIndex, true);
      });
    } else {
      processUnitLines(unit, 0, false);
    }
  });

  // Minimum width is 380px to preserve a clean layout balance
  return Math.max(380, Math.ceil(maxPixelWidth));
}

// Generate the complete HTML structure as a string with inline styles for Satori parity
export function generateCardHtml(data, options = {}) {
  if (!data) return '';
  const summary = data.metadata || {};
  const showMandatory = !!options.showMandatoryWargear;
  const showMode = options.wargearShowMode || (showMandatory ? 'show-all' : 'hide-mandatory');
  const factionName = summary.faction || '';
  const normalizedFaction = factionName.replace(/[\u2018\u2019]/g, "'");
  const colors = resolveColors(normalizedFaction, options);
  
  const emblemFn = factionEmblems[normalizedFaction];
  const emblemColors = {
    ...colors,
    header: colors.icon || colors.header,
    primary: colors.icon || colors.primary
  };
  const emblemSvg = emblemFn ? emblemFn(emblemColors) : makeInitialsEmblem(normalizedFaction, emblemColors);

  // Parse header info
  const listName = summary.title || summary.armyName || 'Warhammer 40k List';
  const detachment = summary.detachment || (summary.detachments && summary.detachments.join(' & ')) || '';
  
  let disps = '';
  if (Array.isArray(summary.forceDispositions) && summary.forceDispositions.length > 0) {
      if (options.abbreviateHeader) {
          disps = summary.forceDispositions.map(d => abbreviateWords(d)).join(', ');
      } else {
          disps = summary.forceDispositions.join(', ');
      }
  } else if (summary.forceDisposition) {
      if (options.abbreviateHeader) {
          disps = abbreviateForceDisposition(summary.forceDisposition);
      } else {
          disps = summary.forceDisposition;
      }
  }
  
  let finalDetachment = detachment;
  if (options.abbreviateHeader && detachment) {
      finalDetachment = abbreviateDetachment(detachment);
  }
  
  const subtitleParts = [finalDetachment, disps].filter(Boolean);
  const subtitle = subtitleParts.join(' • ');

  const pointsTotal = summary.pointsTotal || summary.totalPoints || 0;

  const cardWidth = options.cardWidth || estimateCardWidth(data, options);

  // Process units (combine logic if requested)
  const rawUnits = Array.isArray(data.units) ? data.units : [];
  const units = maybeCombineUnits(rawUnits, options.hideSubunits, options.combineIdenticalUnits);
  
  const getAbbrName = (itemName) => {
    if (!options.useAbbreviations) return itemName;
    if (options.wargearAbbrMap && options.wargearAbbrMap.__flat_abbr) {
      const key = normalizeKey(itemName);
      const val = options.wargearAbbrMap.__flat_abbr[key];
      if (val) {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.abbr) return val.abbr;
      }
    }
    return makeAbbrevForName(itemName);
  };

  const getUnitAbbrName = (itemName) => {
    if (!options.abbreviateUnitNames) return itemName;
    if (options.wargearAbbrMap && options.wargearAbbrMap.__flat_abbr) {
      const key = normalizeKey(itemName);
      const val = options.wargearAbbrMap.__flat_abbr[key];
      if (val) {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.abbr) return val.abbr;
      }
    }
    return makeAbbrevForName(itemName);
  };

  const getSubunitWargearStr = (sub, showMode) => {
    const wgs = (sub.wargear || []).filter(w => {
      if (showMode === 'show-all') return true;
      if (showMode === 'hide-all') return false;
      return !w.skippable;
    });
    return wgs.map(w => {
      const q = parseInt(w.quantity || 1, 10);
      const nameAbbr = getAbbrName(w.name);
      return q > 1 ? `${q}x ${nameAbbr}` : nameAbbr;
    }).join(', ');
  };

  const renderUnitDetails = (unit) => {
    const parts = [];
    if (Array.isArray(unit.enhancements)) {
      unit.enhancements.forEach(e => {
        const abbrName = getAbbrName(e.name);
        parts.push(`E: ${abbrName}`);
      });
    }

    if (options.hideSubunits) {
      const aggregated = new Map();
      if (Array.isArray(unit.wargear)) {
        unit.wargear.forEach(wg => {
          const key = wg.name;
          const qty = parseInt(wg.quantity || 1, 10);
          const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
          aggregated.set(key, { quantity: prev.quantity + qty, skippable: prev.skippable || !!wg.skippable });
        });
      }
      if (Array.isArray(unit.subunits)) {
        unit.subunits.forEach(sub => {
          if (Array.isArray(sub.wargear)) {
            sub.wargear.forEach(wg => {
              const key = wg.name;
              const qty = parseInt(wg.quantity || 1, 10);
              const prev = aggregated.get(key) || { quantity: 0, skippable: !!wg.skippable };
              aggregated.set(key, { quantity: prev.quantity + qty, skippable: prev.skippable || !!wg.skippable });
            });
          }
        });
      }

      const wargearList = Array.from(aggregated.entries()).map(([name, info]) => ({
        name,
        quantity: info.quantity,
        skippable: info.skippable
      }));
      wargearList.sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.name.localeCompare(b.name);
      });

      wargearList.filter(w => {
        if (showMode === 'show-all') return true;
        if (showMode === 'hide-all') return false;
        return !w.skippable;
      }).forEach(w => {
        const nameAbbr = getAbbrName(w.name);
        parts.push(w.quantity > 1 ? `${w.quantity}x ${nameAbbr}` : nameAbbr);
      });
    } else {
      if (Array.isArray(unit.wargear)) {
        unit.wargear.filter(w => {
          if (showMode === 'show-all') return true;
          if (showMode === 'hide-all') return false;
          return !w.skippable;
        }).forEach(w => {
          const q = parseInt(w.quantity || 1, 10);
          const nameAbbr = getAbbrName(w.name);
          parts.push(q > 1 ? `${q}x ${nameAbbr}` : nameAbbr);
        });
      }
    }
    return parts;
  };

  const getSubunitLineHtml = (sub) => {
    const q = parseInt(sub.quantity || 1, 10);
    const prefix = q > 1 ? `${q}x ` : '';
    const bulletChar = options.noBullets ? '' : '• ';
    const wgs = (sub.wargear || []).filter(w => {
      if (showMode === 'show-all') return true;
      if (showMode === 'hide-all') return false;
      return !w.skippable;
    });
    const badgesHtml = wgs.map(w => {
      const wq = parseInt(w.quantity || 1, 10);
      const nameAbbr = getAbbrName(w.name);
      const text = wq > 1 ? `${wq}x ${nameAbbr}` : nameAbbr;
      return `
        <span style="
          padding: 1px 5px;
          font-size: 9px;
          font-weight: 600;
          background-color: ${colors.wargear || '#3f3f46'};
          color: ${getContrastColor(colors.wargear || '#3f3f46')};
          border-radius: 3px;
          display: flex;
          align-items: center;
          white-space: nowrap;
        ">
          ${text}
        </span>
      `;
    }).join('');

    return `
      <div style="
        font-size: 13px;
        margin-top: 4px;
        text-align: left;
        line-height: 1.4;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      ">
        <span style="color: ${colors.subunit || colors.textSecondary}; font-weight: 500;">
          ${bulletChar}${prefix}${getUnitAbbrName(sub.name)}
        </span>
        ${badgesHtml}
      </div>
    `;
  };

  let unitsHtml = '';
  
  const renderUnitCardHtml = (unit, isSubCard = false, labelPrefix = '') => {
    const G = (unit.__groupCount !== undefined) ? unit.__groupCount : 1;
    const M = (unit.__unitSize !== undefined) ? unit.__unitSize : getModelsCount(unit);
    let qtyStr = '';
    if (G > 1) {
      qtyStr = M > 1 ? `${G}x${M} ` : `${G}x `;
    } else {
      qtyStr = M > 1 ? `${M} ` : '';
    }
    const pointsStr = options.hidePoints ? '' : (options.hideBrackets ? `${unit.points} pts` : `[${unit.points} pts]`);
    const details = renderUnitDetails(unit);

    const showInlineDetails = !!options.useAbbreviations;

    const subunitsBlock = (!options.hideSubunits && Array.isArray(unit.subunits) && unit.subunits.length > 0)
      ? `
        <div style="
          display: flex;
          flex-direction: column;
          margin-top: 8px;
          border-top: 1px dashed #3f3f46;
          padding-top: 6px;
          width: 100%;
          box-sizing: border-box;
        ">
          ${unit.subunits.map(sub => getSubunitLineHtml(sub)).join('')}
        </div>
      `
      : '';

    return `
      <div style="
        display: flex;
        flex-direction: column;
        padding: 12px 16px;
        background-color: ${colors.cardBg};
        border: 1px solid #3f3f46;
        border-radius: 6px;
        margin-bottom: ${isSubCard ? '6px' : '10px'};
        box-sizing: border-box;
        width: 100%;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; margin-right: 12px; text-align: left;">
            <span style="font-size: 15px; font-weight: bold; color: ${colors.unit || colors.text};">
              ${labelPrefix}${qtyStr}${getUnitAbbrName(unit.name)}
            </span>
            ${(showInlineDetails && details.length > 0) ? details.map(det => `
              <span style="
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 600;
                background-color: ${colors.wargear || '#3f3f46'};
                color: ${getContrastColor(colors.wargear || '#3f3f46')};
                border-radius: 4px;
                display: flex;
                align-items: center;
                white-space: nowrap;
              ">
                ${det}
              </span>
            `).join('') : ''}
          </div>
          <span style="font-size: 14px; font-weight: bold; color: ${colors.points || colors.secondary}; text-align: right; white-space: nowrap;">
            ${pointsStr}
          </span>
        </div>
        ${(!showInlineDetails && details.length > 0) ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            ${details.map(det => `
              <span style="
                padding: 3px 8px;
                font-size: 11px;
                background-color: ${colors.wargear || '#3f3f46'};
                color: ${getContrastColor(colors.wargear || '#3f3f46')};
                border-radius: 4px;
                display: flex;
                align-items: center;
              ">
                ${det}
              </span>
            `).join('')}
          </div>
        ` : ''}
        ${subunitsBlock}
      </div>
    `;
  };

  units.forEach((unit, idx) => {
    if (unit.isAttached && Array.isArray(unit.attachedParts)) {
      unitsHtml += `
        <div style="
          display: flex;
          flex-direction: column;
          border-left: 3px solid ${colors.attached || colors.primary};
          padding-left: 12px;
          margin-left: 4px;
          margin-bottom: 12px;
          width: 100%;
          box-sizing: border-box;
        ">
          ${unit.attachedParts.map((part, pIdx) => {
            const wTag = getWarlordTag(part, options.hideBrackets);
            const labelPrefix = wTag ? `<span style="color: ${colors.attached || colors.secondary}; font-weight: bold; margin-right: 4px;">${wTag}</span>` : '';
            return renderUnitCardHtml(part, true, labelPrefix);
          }).join('')}
        </div>
      `;
    } else {
      const wTag = getWarlordTag(unit, options.hideBrackets);
      const labelPrefix = wTag ? `<span style="color: ${colors.attached || colors.secondary}; font-weight: bold; margin-right: 4px;">${wTag}</span>` : '';
      unitsHtml += renderUnitCardHtml(unit, false, labelPrefix);
    }
  });

  return `
    <div id="compactor-codex-card" style="
      display: flex;
      flex-direction: column;
      width: ${cardWidth}px;
      padding: 24px;
      background-color: ${colors.background};
      color: ${colors.text};
      font-family: 'Inter', -apple-system, sans-serif;
      box-sizing: border-box;
    ">
      <!-- Header Section -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #3f3f46;
        padding-bottom: 14px;
        margin-bottom: 20px;
        width: 100%;
        box-sizing: border-box;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: center;">
            ${emblemSvg}
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 18px; font-weight: bold; color: ${colors.header || colors.text}; text-align: left; line-height: 1.2;">
              ${listName}
            </span>
            ${subtitle ? `
              <span style="font-size: 12px; color: ${colors.header || colors.textSecondary}; opacity: 0.85; text-align: left; margin-top: 2px;">
                ${subtitle}
              </span>
            ` : ''}
          </div>
        </div>
        
        ${options.hidePoints ? '' : `
        <div style="
          display: flex;
          align-items: center;
          padding: 6px 14px;
          background-color: ${colors.pillBg || 'rgba(212, 175, 55, 0.1)'};
          border: 1px solid ${colors.points || colors.secondary};
          border-radius: 9999px;
          box-sizing: border-box;
        ">
          <span style="font-size: 15px; font-weight: bold; color: ${colors.points || colors.secondary};">
            ${pointsTotal.toLocaleString()} pts
          </span>
        </div>
        `}
      </div>

      <!-- Units List -->
      <div style="display: flex; flex-direction: column; width: 100%; box-sizing: border-box;">
        ${unitsHtml}
      </div>
    </div>
  `;
}

// Client-side Browser PNG data URL generator
export async function generateCardPngDataUrl(data, options = {}) {
  if (typeof window === 'undefined') return '';
  
  // Create a temporary off-screen container for rendering
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.innerHTML = generateCardHtml(data, options);
  document.body.appendChild(tempDiv);

  const targetNode = tempDiv.querySelector('#compactor-codex-card');
  if (!targetNode) {
    document.body.removeChild(tempDiv);
    throw new Error('Failed to find card node');
  }

  try {
    // Inject the Inter font to guarantee correct rendering
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap';
    document.head.appendChild(link);
    
    // Wait for fonts to be completely ready with a timeout
    if (document.fonts) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise(r => setTimeout(r, 500))
        ]);
      } catch (e) {
        console.warn('Failed to wait for fonts ready:', e);
      }
    }
    await new Promise(r => setTimeout(r, 100));

    const factionName = data.metadata?.faction || '';
    const normalizedFaction = factionName.replace(/[\u2018\u2019]/g, "'");
    const colors = resolveColors(normalizedFaction, options);

    // Render using html-to-image
    const dataUrl = await window.htmlToImage.toPng(targetNode, {
      pixelRatio: 2, // High DPI rendering
      backgroundColor: colors.background, // Set background color explicitly to avoid rendering artifacts
      skipFonts: true,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left'
      }
    });
    return dataUrl;
  } finally {
    document.body.removeChild(tempDiv);
  }
}

// Client-side Browser PNG export trigger
export async function downloadCardPng(data, options = {}) {
  try {
    const dataUrl = await generateCardPngDataUrl(data, options);
    // Create download trigger
    const linkEl = document.createElement('a');
    const armyName = (data.metadata?.title || data.metadata?.armyName || 'army-list').toLowerCase().replace(/[^a-z0-9]/g, '-');
    linkEl.download = `${armyName}-card.png`;
    linkEl.href = dataUrl;
    linkEl.click();
  } catch (err) {
    console.error('Failed to generate image:', err);
    alert('Failed to generate list image. Please try again.');
  }
}

export async function copyCardImageToClipboard(data, options = {}) {
  try {
    const dataUrl = await generateCardPngDataUrl(data, options);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err);
    throw err;
  }
}
