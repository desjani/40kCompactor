import factionColors from './faction_colors.js';
import { makeAbbrevForName } from './abbreviations.js';

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

const factionEmblems = {
  "World Eaters": `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="#d4af37" stroke-width="6" fill="#151518" />
      <circle cx="50" cy="50" r="34" stroke="#b20000" stroke-width="2" />
      <path d="M35 30 L65 30 L65 40 L60 40 L60 50 L65 55 L65 70 L58 75 L58 65 L50 65 L42 65 L42 75 L35 70 L35 55 L40 50 L40 40 L35 40 Z" fill="#d4af37" />
      <circle cx="45" cy="45" r="3" fill="#b20000" />
      <circle cx="55" cy="45" r="3" fill="#b20000" />
    </svg>
  `,
  "T'au Empire": `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="#ff7f00" stroke-width="6" fill="#18181b" />
      <circle cx="50" cy="50" r="24" fill="#ff7f00" />
      <rect x="46" y="24" width="8" height="52" fill="#18181b" />
      <circle cx="50" cy="50" r="14" fill="#18181b" />
      <circle cx="50" cy="50" r="6" fill="#ff7f00" />
    </svg>
  `,
  "Space Marines": `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 20 H80 V50 C80 68 50 85 50 85 C50 85 20 68 20 50 Z" fill="#18181b" stroke="#0054a6" stroke-width="6" />
      <path d="M35 35 H65 V50 C65 60 50 72 50 72 C50 72 35 60 35 50 Z" fill="#0054a6" />
      <path d="M50 25 L53 38 L65 41 L53 44 L50 57 L47 44 L35 41 L47 38 Z" fill="#f5c400" />
    </svg>
  `
};

// Helper to resolve faction color variables
export function resolveColors(factionName) {
  if (premiumFactionColors[factionName]) {
    return premiumFactionColors[factionName];
  }

  // Fallback to basic faction colors from configuration
  const entry = factionColors[factionName] || factionColors[factionName?.toLowerCase()] || {};
  const primaryName = entry.unit || 'white';
  const secondaryName = entry.points || 'yellow';
  
  const primary = colorNameToHex[primaryName.toLowerCase()] || '#ffffff';
  const secondary = colorNameToHex[secondaryName.toLowerCase()] || '#ffff00';

  return {
    primary: primary,
    secondary: secondary,
    background: '#18181b',
    cardBg: '#27272a',
    attachedBg: '#1f1f23',
    text: '#f4f4f5',
    textSecondary: '#a1a1aa'
  };
}

// Helper to generate initials emblem
function makeInitialsEmblem(name, colors) {
  const words = (name || 'Army').split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return `
    <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <text x="50" y="58" font-family="sans-serif" font-size="28" font-weight="bold" fill="${colors.secondary}" text-anchor="middle">${initials}</text>
    </svg>
  `;
}

// Generate the complete HTML structure as a string with inline styles for Satori parity
export function generateCardHtml(data, options = {}) {
  if (!data) return '';
  const summary = data.metadata || {};
  const factionName = summary.faction || '';
  const colors = resolveColors(factionName);
  
  const emblemSvg = factionEmblems[factionName] || makeInitialsEmblem(factionName, colors);

  // Parse header info
  const listName = summary.title || summary.armyName || 'Warhammer 40k List';
  const detachment = summary.detachment || (summary.detachments && summary.detachments.join(' & ')) || '';
  const pointsTotal = summary.pointsTotal || summary.totalPoints || 0;

  // Process units (combine logic if requested)
  const rawUnits = Array.isArray(data.units) ? data.units : [];
  
  const getAbbrName = (itemName) => {
    if (!options.useAbbreviations) return itemName;
    if (options.wargearAbbrMap && options.wargearAbbrMap.__flat_abbr) {
      const nameLower = itemName.toLowerCase();
      const val = options.wargearAbbrMap.__flat_abbr[nameLower];
      if (val) {
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.abbr) return val.abbr;
      }
    }
    return makeAbbrevForName(itemName);
  };

  const getSubunitWargearStr = (sub, showMandatory) => {
    const wgs = (sub.wargear || []).filter(w => showMandatory || !w.skippable);
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
    if (Array.isArray(unit.wargear)) {
      unit.wargear.filter(w => options.showMandatoryWargear || !w.skippable).forEach(w => {
        const q = parseInt(w.quantity || 1, 10);
        const nameAbbr = getAbbrName(w.name);
        parts.push(q > 1 ? `${q}x ${nameAbbr}` : nameAbbr);
      });
    }
    if (!options.hideSubunits && Array.isArray(unit.subunits)) {
      unit.subunits.forEach(sub => {
        const q = parseInt(sub.quantity || 1, 10);
        const prefix = q > 1 ? `${q}x ` : '';
        const wgStr = getSubunitWargearStr(sub, options.showMandatoryWargear);
        parts.push(`${prefix}${sub.name}${wgStr ? ` (${wgStr})` : ''}`);
      });
    }
    return parts;
  };

  let unitsHtml = '';
  
  const renderUnitCardHtml = (unit, isSubCard = false, labelPrefix = '') => {
    const qty = parseInt(unit.quantity || 1, 10);
    const qtyStr = qty > 1 ? `${qty}x ` : '';
    const pointsStr = options.hidePoints ? '' : `[${unit.points} pts]`;
    const details = renderUnitDetails(unit);

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
          <span style="font-size: 15px; font-weight: bold; color: ${colors.text}; text-align: left;">
            ${labelPrefix}${qtyStr}${unit.name}
          </span>
          <span style="font-size: 14px; font-weight: bold; color: ${colors.secondary}; text-align: right;">
            ${pointsStr}
          </span>
        </div>
        ${details.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            ${details.map(det => `
              <span style="
                padding: 3px 8px;
                font-size: 11px;
                background-color: #3f3f46;
                color: ${colors.textSecondary};
                border-radius: 4px;
                display: flex;
                align-items: center;
              ">
                ${det}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };

  rawUnits.forEach((unit, idx) => {
    if (unit.isAttached && Array.isArray(unit.attachedParts)) {
      unitsHtml += `
        <div style="
          display: flex;
          flex-direction: column;
          border-left: 3px solid ${colors.primary};
          padding-left: 12px;
          margin-left: 4px;
          margin-bottom: 12px;
          width: 100%;
          box-sizing: border-box;
        ">
          ${unit.attachedParts.map((part, pIdx) => {
            const role = (part.role || '').toLowerCase();
            const tag = role.includes('leader') ? '(Leader) ' : '(Bodyguard) ';
            return renderUnitCardHtml(part, true, tag);
          }).join('')}
        </div>
      `;
    } else {
      unitsHtml += renderUnitCardHtml(unit);
    }
  });

  return `
    <div id="compactor-codex-card" style="
      display: flex;
      flex-direction: column;
      width: 580px;
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
            <span style="font-size: 18px; font-weight: bold; color: ${colors.text}; text-align: left; line-height: 1.2;">
              ${listName}
            </span>
            ${detachment ? `
              <span style="font-size: 12px; color: ${colors.textSecondary}; text-align: left; margin-top: 2px;">
                ${detachment}
              </span>
            ` : ''}
          </div>
        </div>
        
        <div style="
          display: flex;
          align-items: center;
          padding: 6px 14px;
          background-color: ${colors.pillBg || 'rgba(212, 175, 55, 0.1)'};
          border: 1px solid ${colors.secondary};
          border-radius: 9999px;
          box-sizing: border-box;
        ">
          <span style="font-size: 15px; font-weight: bold; color: ${colors.secondary};">
            ${pointsTotal.toLocaleString()} pts
          </span>
        </div>
      </div>

      <!-- Units List -->
      <div style="display: flex; flex-direction: column; width: 100%; box-sizing: border-box;">
        ${unitsHtml}
      </div>
    </div>
  `;
}

// Client-side Browser PNG export trigger
export async function downloadCardPng(data, options = {}) {
  if (typeof window === 'undefined') return;
  
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
    
    // Wait briefly for font and styles to load
    await new Promise(r => setTimeout(r, 200));

    // Render using html-to-image
    const dataUrl = await window.htmlToImage.toPng(targetNode, {
      pixelRatio: 2, // High DPI rendering
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left'
      }
    });

    // Create download trigger
    const linkEl = document.createElement('a');
    const armyName = (data.metadata?.title || data.metadata?.armyName || 'army-list').toLowerCase().replace(/[^a-z0-9]/g, '-');
    linkEl.download = `${armyName}-card.png`;
    linkEl.href = dataUrl;
    linkEl.click();
  } catch (err) {
    console.error('Failed to generate image:', err);
    alert('Failed to generate list image. Please try again.');
  } finally {
    document.body.removeChild(tempDiv);
  }
}
