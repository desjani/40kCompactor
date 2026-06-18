import factionColors from './faction_colors.js';
import { makeAbbrevForName } from './abbreviations.js';
import { maybeCombineUnits } from './renderers.js';

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
  "World Eaters": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="${colors.secondary}" stroke-width="6" fill="${colors.background}" />
      <circle cx="50" cy="50" r="34" stroke="${colors.primary}" stroke-width="2" fill="none" />
      <path d="M35 30 L65 30 L65 40 L60 40 L60 50 L65 55 L65 70 L58 75 L58 65 L50 65 L42 65 L42 75 L35 70 L35 55 L40 50 L40 40 L35 40 Z" fill="${colors.secondary}" />
      <circle cx="45" cy="45" r="3" fill="${colors.primary}" />
      <circle cx="55" cy="45" r="3" fill="${colors.primary}" />
    </svg>
  `,
  "T'au Empire": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="${colors.primary}" stroke-width="6" fill="${colors.background}" />
      <circle cx="50" cy="50" r="24" fill="${colors.primary}" />
      <rect x="46" y="24" width="8" height="52" fill="${colors.background}" />
      <circle cx="50" cy="50" r="14" fill="${colors.background}" />
      <circle cx="50" cy="50" r="6" fill="${colors.primary}" />
    </svg>
  `,
  "Space Marines": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 20 H80 V50 C80 68 50 85 50 85 C50 85 20 68 20 50 Z" fill="${colors.background}" stroke="${colors.primary}" stroke-width="6" />
      <path d="M35 35 H65 V50 C65 60 50 72 50 72 C50 72 35 60 35 50 Z" fill="${colors.primary}" />
      <path d="M50 25 L53 38 L65 41 L53 44 L50 57 L47 44 L35 41 L47 38 Z" fill="${colors.secondary}" />
    </svg>
  `,
  "Adepta Sororitas": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 15 C50 15 54 28 58 35 C62 42 66 45 66 52 C66 62 58 66 50 66 C42 66 34 62 34 52 C34 45 38 42 42 35 C46 28 50 15 50 15 Z" fill="${colors.secondary}" />
      <path d="M50 56 C50 56 65 54 74 62 C80 67 82 75 74 80 C66 85 58 75 54 68 Z" fill="${colors.secondary}" />
      <path d="M50 56 C50 56 35 54 26 62 C20 67 18 75 26 80 C34 85 42 75 46 68 Z" fill="${colors.secondary}" />
      <rect x="32" y="58" width="36" height="6" rx="3" fill="${colors.primary}" />
    </svg>
  `,
  "Adeptus Custodes": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 15 L80 25 V50 C80 68 50 85 50 85 C50 85 20 68 20 50 V25 L50 15 Z" fill="${colors.background}" stroke="${colors.primary}" stroke-width="5" />
      <path d="M50 22 L72 30 V48 C72 62 50 75 50 75 C50 75 28 62 28 48 V30 L50 22 Z" fill="${colors.secondary}" opacity="0.3" />
      <path d="M30 35 L45 45 M30 43 L45 51 M30 51 L45 57 M70 35 L55 45 M70 43 L55 51 M70 51 L55 57" stroke="${colors.secondary}" stroke-width="4" stroke-linecap="round" />
      <line x1="50" y1="28" x2="50" y2="70" stroke="${colors.primary}" stroke-width="4" />
    </svg>
  `,
  "Adeptus Mechanicus": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="30" stroke="${colors.primary}" stroke-width="6" fill="none" />
      <path d="M46 12 H54 V20 H46 Z M46 80 H54 V88 H46 Z M12 46 H20 V54 H12 Z M80 46 H88 V54 H80 Z M22 22 L28 28 L22 34 L16 28 Z M72 72 L78 78 L72 84 L66 78 Z M22 72 L28 66 L34 72 L28 78 Z M72 22 L78 28 L84 22 L78 16 Z" fill="${colors.primary}" />
      <path d="M50 28 C41 28 35 34 35 44 C35 52 39 54 39 58 L42 62 H50 Z" fill="${colors.secondary}" />
      <path d="M50 28 C59 28 65 34 65 44 C65 52 61 54 61 58 L58 62 H50 Z" fill="${colors.primary}" />
      <circle cx="44" cy="42" r="3" fill="${colors.background}" />
      <circle cx="56" cy="42" r="3" fill="${colors.background}" />
    </svg>
  `,
  "Adeptus Titanicus": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="32" stroke="${colors.primary}" stroke-width="5" fill="none" />
      <path d="M47 10 H53 V18 H47 Z M47 82 H53 V90 H47 Z M10 47 H18 V53 H10 Z M82 47 H90 V53 H82 Z" fill="${colors.primary}" />
      <path d="M30 30 H70 V40 H55 V70 H45 V40 H30 Z" fill="${colors.secondary}" />
    </svg>
  `,
  "Aeldari": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 15 C30 35 25 55 25 75 C35 75 45 65 50 50 C55 65 65 75 75 75 C75 55 70 35 50 15 Z" stroke="${colors.primary}" stroke-width="6" fill="none" />
      <line x1="20" y1="50" x2="80" y2="50" stroke="${colors.secondary}" stroke-width="6" stroke-linecap="round" />
      <circle cx="50" cy="35" r="5" fill="${colors.secondary}" />
    </svg>
  `,
  "Astra Militarum": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 35 L40 45 L40 55 L15 42 Z M85 35 L60 45 L60 55 L85 42 Z M18 48 L40 55 L40 62 L18 53 Z M82 48 L60 55 L60 62 L82 53 Z" fill="${colors.primary}" />
      <path d="M50 32 C43 32 38 37 38 45 C38 52 42 54 42 60 L45 65 H55 L58 60 C58 54 62 52 62 45 C62 37 57 32 50 32 Z" fill="${colors.secondary}" />
      <circle cx="45" cy="44" r="3" fill="${colors.background}" />
      <circle cx="55" cy="44" r="3" fill="${colors.background}" />
      <polygon points="50,48 48,52 52,52" fill="${colors.background}" />
    </svg>
  `,
  "Black Templars": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 50 L25 20 L50 32 L75 20 Z M50 50 L80 25 L68 50 L80 75 Z M50 50 L75 80 L50 68 L25 80 Z M50 50 L20 75 L32 50 L20 25 Z" fill="${colors.primary}" />
      <circle cx="50" cy="50" r="8" fill="${colors.secondary}" />
    </svg>
  `,
  "Blood Angels": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 45 C15 30 35 20 42 38 C35 38 25 45 28 58 C18 58 15 52 15 45 Z" fill="${colors.primary}" />
      <path d="M85 45 C85 30 65 20 58 38 C65 38 75 45 72 58 C82 58 85 52 85 45 Z" fill="${colors.primary}" />
      <path d="M50 25 C50 25 35 48 35 58 C35 68 41 75 50 75 C59 75 65 68 65 58 C65 48 50 25 50 25 Z" fill="${colors.secondary}" />
    </svg>
  `,
  "Chaos Daemons": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 10 L55 25 H45 Z M50 90 L55 75 H45 Z M10 50 L25 55 V45 Z M90 50 L75 55 V45 Z M22 22 L36 30 L30 36 Z M78 78 L64 70 L70 64 Z M22 78 L30 64 L36 70 Z M78 22 L70 36 L64 30 Z" fill="${colors.primary}" />
      <circle cx="50" cy="50" r="20" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <path d="M38 50 C38 50 44 42 50 42 C56 42 62 50 62 50 C62 50 56 58 50 58 C44 58 38 50 38 50 Z" fill="${colors.secondary}" />
      <circle cx="50" cy="50" r="4" fill="${colors.primary}" />
    </svg>
  `,
  "Chaos Knights": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 12 L82 25 L75 55 C70 72 50 88 50 88 C50 88 30 72 25 55 L18 25 Z" fill="${colors.background}" stroke="${colors.primary}" stroke-width="4" />
      <path d="M50 25 L50 18 M50 75 L50 82 M25 50 L18 50 M75 50 L82 50 M32 32 L26 26 M68 68 L74 74 M32 68 L26 74 M68 32 L74 26" stroke="${colors.secondary}" stroke-width="4" stroke-linecap="round" />
      <circle cx="50" cy="50" r="12" fill="${colors.secondary}" opacity="0.4" />
    </svg>
  `,
  "Chaos Space Marines": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="16" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <path d="M50 10 L54 28 H46 Z M50 90 L54 72 H46 Z M10 50 L28 54 V46 Z M90 50 L72 54 V46 Z M22 22 L38 32 L32 38 Z M78 78 L62 68 L68 62 Z M22 78 L32 62 L38 68 Z M78 22 L68 38 L62 32 Z" fill="${colors.secondary}" />
      <circle cx="50" cy="50" r="6" fill="${colors.primary}" />
    </svg>
  `,
  "Dark Angels": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 25 C15 35 15 65 35 70 C28 55 28 35 38 30 Z" fill="${colors.primary}" />
      <path d="M78 25 C85 35 85 65 65 70 C72 55 72 35 62 30 Z" fill="${colors.primary}" />
      <path d="M47 20 H53 V65 L50 75 L47 65 Z" fill="${colors.secondary}" />
      <rect x="38" y="26" width="24" height="4" rx="1" fill="${colors.secondary}" />
      <circle cx="50" cy="17" r="3" fill="${colors.secondary}" />
    </svg>
  `,
  "Death Guard": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="32" r="14" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <circle cx="34" cy="62" r="14" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <circle cx="66" cy="62" r="14" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <polygon points="50,32 34,62 66,62" stroke="${colors.secondary}" stroke-width="2" fill="none" stroke-dasharray="4" />
      <circle cx="50" cy="32" r="4" fill="${colors.secondary}" />
      <circle cx="34" cy="62" r="4" fill="${colors.secondary}" />
      <circle cx="66" cy="62" r="4" fill="${colors.secondary}" />
    </svg>
  `,
  "Deathwatch": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M45 15 H55 V85 H45 Z M35 15 H65 V22 H35 Z M35 78 H65 V85 H35 Z M30 46 H70 V54 H30 Z" fill="${colors.primary}" />
      <path d="M50 36 C46 36 43 39 43 44 C43 48 45 49 45 53 L47 56 H53 L55 53 C55 49 57 48 57 44 C57 39 54 36 50 36 Z" fill="${colors.secondary}" />
      <circle cx="47" cy="42" r="2" fill="${colors.background}" />
      <circle cx="53" cy="42" r="2" fill="${colors.background}" />
    </svg>
  `,
  "Drukhari": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M70 20 C40 20 20 40 20 70 C35 60 55 60 70 70 C55 50 50 35 70 20 Z" fill="${colors.primary}" />
      <path d="M25 45 L15 50 L28 53 Z M40 28 L38 18 L46 29 Z" fill="${colors.secondary}" />
      <circle cx="48" cy="48" r="4" fill="${colors.secondary}" />
    </svg>
  `,
  "Emperor's Children": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="65" r="14" fill="${colors.secondary}" stroke="${colors.primary}" stroke-width="3" />
      <path d="M30 45 C30 45 32 60 42 75 C36 70 24 55 30 45 Z" fill="${colors.primary}" />
      <path d="M70 45 C70 45 68 60 58 75 C64 70 76 55 70 45 Z" fill="${colors.primary}" />
      <path d="M50 20 C50 20 45 35 50 53 C55 35 50 20 50 20 Z" fill="${colors.primary}" />
    </svg>
  `,
  "Genestealer Cults": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 15 C20 25 15 50 25 72 C35 55 30 35 55 25 C45 30 40 22 40 15 Z" fill="${colors.primary}" />
      <path d="M25 72 C35 78 50 78 65 68 C50 70 38 68 25 72 Z" fill="${colors.primary}" />
      <path d="M55 25 C65 35 65 50 50 62 C60 50 58 35 55 25 Z" fill="${colors.secondary}" />
      <circle cx="42" cy="38" r="3" fill="${colors.secondary}" />
    </svg>
  `,
  "Grey Knights": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 35 L48 28 V72 L20 80 Z" fill="${colors.primary}" stroke="${colors.secondary}" stroke-width="3" />
      <path d="M80 35 L52 28 V72 L80 80 Z" fill="${colors.primary}" stroke="${colors.secondary}" stroke-width="3" />
      <path d="M48 15 H52 V85 H48 Z" fill="${colors.secondary}" />
      <rect x="42" y="24" width="16" height="4" fill="${colors.secondary}" />
      <circle cx="50" cy="12" r="3" fill="${colors.secondary}" />
    </svg>
  `,
  "Imperial Fists": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="${colors.primary}" stroke-width="4" fill="none" />
      <path d="M35 70 V55 L40 45 H60 L65 55 V70 H35 Z" fill="${colors.secondary}" />
      <path d="M40 45 V58 M46 45 V58 M53 45 V58 M60 45 V58" stroke="${colors.background}" stroke-width="3" />
      <path d="M32 58 C32 58 35 48 44 48" stroke="${colors.secondary}" stroke-width="6" stroke-linecap="round" />
    </svg>
  `,
  "Imperial Knights": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 15 H75 L80 45 C80 65 50 85 50 85 C50 85 20 65 20 45 Z" fill="${colors.background}" stroke="${colors.primary}" stroke-width="5" />
      <path d="M20 45 L80 45" stroke="${colors.primary}" stroke-width="3" />
      <path d="M50 25 C44 25 40 30 40 38 C40 48 45 52 50 62 C55 52 60 48 60 38 C60 30 56 25 50 25 Z" fill="${colors.secondary}" />
      <rect x="45" y="32" width="10" height="3" fill="${colors.background}" />
    </svg>
  `,
  "Iron Hands": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="38" stroke="${colors.primary}" stroke-dasharray="8 6" stroke-width="4" fill="none" />
      <rect x="40" y="52" width="20" height="22" rx="3" fill="${colors.secondary}" />
      <rect x="40" y="30" width="3" height="20" rx="1" fill="${colors.secondary}" />
      <rect x="46" y="26" width="3" height="24" rx="1" fill="${colors.secondary}" />
      <rect x="52" y="26" width="3" height="24" rx="1" fill="${colors.secondary}" />
      <rect x="58" y="30" width="3" height="20" rx="1" fill="${colors.secondary}" />
      <path d="M40 58 L32 50 L34 46 L42 54 Z" fill="${colors.secondary}" />
    </svg>
  `,
  "Leagues of Votann": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 35 C15 35 15 15 30 15 C38 15 42 25 46 35 Z" fill="${colors.primary}" />
      <path d="M70 35 C85 35 85 15 70 15 C62 15 58 25 54 35 Z" fill="${colors.primary}" />
      <polygon points="50,25 35,42 42,75 50,85 58,75 65,42" fill="${colors.secondary}" stroke="${colors.primary}" stroke-width="3" />
      <circle cx="44" cy="46" r="3" fill="${colors.background}" />
      <circle cx="56" cy="46" r="3" fill="${colors.background}" />
    </svg>
  `,
  "Necrons": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="30" r="16" stroke="${colors.primary}" stroke-width="6" fill="none" />
      <line x1="24" y1="46" x2="76" y2="46" stroke="${colors.primary}" stroke-width="6" stroke-linecap="round" />
      <line x1="50" y1="46" x2="50" y2="85" stroke="${colors.primary}" stroke-width="6" />
      <polygon points="50,70 38,82 50,82 62,82" fill="${colors.secondary}" />
      <circle cx="50" cy="30" r="6" fill="${colors.secondary}" />
    </svg>
  `,
  "Orks": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 25 H78 V45 L70 52 V75 H30 V52 L22 45 Z" fill="${colors.primary}" />
      <polygon points="35,75 40,65 45,75 50,65 55,75 60,65 65,75" fill="${colors.background}" />
      <polygon points="30,35 45,38 43,45 28,42" fill="${colors.secondary}" />
      <polygon points="70,35 55,38 57,45 72,42" fill="${colors.secondary}" />
    </svg>
  `,
  "Raven Guard": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 15 L62 38 L88 38 C75 48 68 60 62 82 L50 68 L38 82 C32 60 25 48 12 38 L38 38 Z" fill="${colors.primary}" />
      <path d="M50 15 L55 35 H45 Z" fill="${colors.secondary}" />
      <circle cx="50" cy="40" r="4" fill="${colors.secondary}" />
    </svg>
  `,
  "Salamanders": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 50 C25 32 45 22 65 35 L78 35 L68 46 L75 52 L62 58 L55 78 C45 75 35 68 25 50 Z" fill="${colors.primary}" stroke="${colors.secondary}" stroke-width="3" />
      <path d="M72 48 C78 48 85 40 88 48 C85 54 78 52 72 48 Z" fill="${colors.secondary}" />
      <circle cx="48" cy="40" r="3" fill="${colors.secondary}" />
    </svg>
  `,
  "Space Wolves": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M72 75 C72 65 65 52 50 45 C35 38 25 22 25 22 C25 22 30 35 30 45 C20 48 15 55 22 62 C30 58 38 65 42 75 Z" fill="${colors.primary}" />
      <circle cx="34" cy="44" r="3" fill="${colors.secondary}" />
      <polygon points="25,52 28,56 31,52" fill="${colors.secondary}" />
    </svg>
  `,
  "Thousand Sons": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="32" stroke="${colors.primary}" stroke-width="6" fill="none" />
      <path d="M44 14 C44 14 50 5 56 14 L50 20 Z" fill="${colors.primary}" />
      <path d="M50 28 C42 42 42 62 50 72 C58 62 58 42 50 28 Z" fill="${colors.secondary}" />
      <circle cx="50" cy="50" r="4" fill="${colors.primary}" />
    </svg>
  `,
  "Tyranids": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 20 C15 35 15 65 30 80 C35 70 32 50 40 40 C35 35 32 28 30 20 Z" fill="${colors.primary}" />
      <path d="M70 20 C85 35 85 65 70 80 C65 70 68 50 60 40 C65 35 68 28 70 20 Z" fill="${colors.primary}" />
      <ellipse cx="50" cy="50" rx="10" ry="16" fill="${colors.secondary}" />
    </svg>
  `,
  "Ultramarines": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 20 H40 V50 C40 60 60 60 60 50 V20 H70 V50 C70 70 30 70 30 50 Z" fill="${colors.primary}" />
      <rect x="24" y="20" width="16" height="6" fill="${colors.primary}" />
      <rect x="60" y="20" width="16" height="6" fill="${colors.primary}" />
      <path d="M50 35 L44 48 H56 Z" fill="${colors.secondary}" />
    </svg>
  `,
  "White Scars": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="55,10 22,52 48,52 35,90 78,42 50,42" fill="${colors.primary}" stroke="${colors.secondary}" stroke-width="3" />
    </svg>
  `,
  "Agents of the Imperium": (colors) => `
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M46 15 H54 V85 H46 Z M30 15 H70 V22 H30 Z M30 78 H70 V85 H30 Z" fill="${colors.primary}" />
      <rect x="36" y="32" width="28" height="5" rx="1" fill="${colors.primary}" />
      <rect x="30" y="48" width="40" height="5" rx="1" fill="${colors.primary}" />
      <rect x="36" y="64" width="28" height="5" rx="1" fill="${colors.primary}" />
      <circle cx="50" cy="50" r="8" fill="${colors.secondary}" />
    </svg>
  `
};

// Helper to resolve faction color variables
export function resolveColors(factionName) {
  const normalized = (factionName || '').replace(/[\u2018\u2019]/g, "'");
  if (premiumFactionColors[normalized]) {
    return premiumFactionColors[normalized];
  }

  // Fallback to basic faction colors from configuration
  const entry = factionColors[normalized] || factionColors[normalized.toLowerCase()] || {};
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

  let maxCharCount = 20; // fallback minimum

  // Header info
  const summary = data.metadata || {};
  const listName = summary.title || summary.armyName || 'Warhammer 40k List';
  const detachment = summary.detachment || (summary.detachments && summary.detachments.join(' & ')) || '';
  const pointsTotal = summary.pointsTotal || summary.totalPoints || 0;
  const headerPointsStr = options.hidePoints ? '' : ` [${pointsTotal} pts]`;
  
  maxCharCount = Math.max(maxCharCount, (listName + headerPointsStr).length * 0.9, detachment.length * 0.85);

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

  const getUnitLineLen = (unit) => {
    let nameLen = unit.name.length;
    
    const qty = parseInt(unit.quantity || 1, 10);
    if (options.combineIdenticalUnits && (unit.__groupCount || 0) > 1) {
      nameLen += `${unit.__groupCount}x${unit.__unitSize || qty} `.length;
    } else {
      nameLen += qty > 1 ? `${qty}x `.length : 0;
    }

    let detailsLen = 0;
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
      wargearList.filter(w => options.showMandatoryWargear || !w.skippable).forEach(w => {
        const nameAbbr = getAbbrName(w.name);
        parts.push(w.quantity > 1 ? `${w.quantity}x ${nameAbbr}` : nameAbbr);
      });
    } else {
      if (Array.isArray(unit.wargear)) {
        unit.wargear.filter(w => options.showMandatoryWargear || !w.skippable).forEach(w => {
          const q = parseInt(w.quantity || 1, 10);
          parts.push(q > 1 ? `${q}x ${getAbbrName(w.name)}` : getAbbrName(w.name));
        });
      }
      if (Array.isArray(unit.subunits)) {
        unit.subunits.forEach(sub => {
          const q = parseInt(sub.quantity || 1, 10);
          const prefix = q > 1 ? `${q}x ` : '';
          const wgStr = getSubunitWargearStr(sub, options.showMandatoryWargear);
          parts.push(`${prefix}${sub.name}${wgStr ? ` (${wgStr})` : ''}`);
        });
      }
    }

    if (parts.length > 0) {
      if (options.useAbbreviations) {
        detailsLen = ` (${parts.join(', ')})`.length;
      }
    }
    
    const pointsStr = options.hidePoints ? '' : ` [${unit.points} pts]`;
    return nameLen + detailsLen + pointsStr.length;
  };

  units.forEach(unit => {
    if (unit.isAttached && Array.isArray(unit.attachedParts)) {
      unit.attachedParts.forEach(part => {
        maxCharCount = Math.max(maxCharCount, getUnitLineLen(part) + 6);
      });
    } else {
      maxCharCount = Math.max(maxCharCount, getUnitLineLen(unit));
    }
  });

  const estimated = Math.ceil(maxCharCount * 8.2) + 90;
  return Math.min(580, Math.max(380, estimated));
}

// Generate the complete HTML structure as a string with inline styles for Satori parity
export function generateCardHtml(data, options = {}) {
  if (!data) return '';
  const summary = data.metadata || {};
  const factionName = summary.faction || '';
  const normalizedFaction = factionName.replace(/[\u2018\u2019]/g, "'");
  const colors = resolveColors(normalizedFaction);
  
  const emblemFn = factionEmblems[normalizedFaction];
  const emblemSvg = emblemFn ? emblemFn(colors) : makeInitialsEmblem(normalizedFaction, colors);

  // Parse header info
  const listName = summary.title || summary.armyName || 'Warhammer 40k List';
  const detachment = summary.detachment || (summary.detachments && summary.detachments.join(' & ')) || '';
  const pointsTotal = summary.pointsTotal || summary.totalPoints || 0;

  const cardWidth = options.cardWidth || estimateCardWidth(data, options);

  // Process units (combine logic if requested)
  const rawUnits = Array.isArray(data.units) ? data.units : [];
  const units = maybeCombineUnits(rawUnits, options.hideSubunits, options.combineIdenticalUnits);
  
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

      wargearList.filter(w => options.showMandatoryWargear || !w.skippable).forEach(w => {
        const nameAbbr = getAbbrName(w.name);
        parts.push(w.quantity > 1 ? `${w.quantity}x ${nameAbbr}` : nameAbbr);
      });
    } else {
      if (Array.isArray(unit.wargear)) {
        unit.wargear.filter(w => options.showMandatoryWargear || !w.skippable).forEach(w => {
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
    const wgStr = getSubunitWargearStr(sub, options.showMandatoryWargear);
    const lineText = `• ${prefix}${sub.name}${wgStr ? ` (${wgStr})` : ''}`;
    return `
      <div style="
        font-size: 13px;
        color: ${colors.textSecondary};
        margin-top: 4px;
        text-align: left;
        line-height: 1.4;
      ">
        ${lineText}
      </div>
    `;
  };

  let unitsHtml = '';
  
  const renderUnitCardHtml = (unit, isSubCard = false, labelPrefix = '') => {
    const qty = parseInt(unit.quantity || 1, 10);
    let qtyStr = '';
    if (options.combineIdenticalUnits && (unit.__groupCount || 0) > 1) {
      qtyStr = `${unit.__groupCount}x${unit.__unitSize || qty} `;
    } else {
      qtyStr = qty > 1 ? `${qty}x ` : '';
    }
    const pointsStr = options.hidePoints ? '' : `[${unit.points} pts]`;
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
            <span style="font-size: 15px; font-weight: bold; color: ${colors.text};">
              ${labelPrefix}${qtyStr}${unit.name}
            </span>
            ${(showInlineDetails && details.length > 0) ? details.map(det => `
              <span style="
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 600;
                background-color: #3f3f46;
                color: ${colors.textSecondary};
                border-radius: 4px;
                display: flex;
                align-items: center;
                white-space: nowrap;
              ">
                ${det}
              </span>
            `).join('') : ''}
          </div>
          <span style="font-size: 14px; font-weight: bold; color: ${colors.secondary}; text-align: right; white-space: nowrap;">
            ${pointsStr}
          </span>
        </div>
        ${(!showInlineDetails && details.length > 0) ? `
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
          border-left: 3px solid ${colors.primary};
          padding-left: 12px;
          margin-left: 4px;
          margin-bottom: 12px;
          width: 100%;
          box-sizing: border-box;
        ">
          ${unit.attachedParts.map((part, pIdx) => {
            return renderUnitCardHtml(part, true, '');
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
    
    // Wait briefly for font and styles to load
    await new Promise(r => setTimeout(r, 250));

    // Render using html-to-image
    const dataUrl = await window.htmlToImage.toPng(targetNode, {
      pixelRatio: 2, // High DPI rendering
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
