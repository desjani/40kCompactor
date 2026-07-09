import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const srcSvgsDir = path.join(projectRoot, 'temp-wh40k-icon/src/svgs');
const destSvgsDir = path.join(projectRoot, 'assets/faction-icons');

// Create destination dir
if (!fs.existsSync(destSvgsDir)) {
    fs.mkdirSync(destSvgsDir, { recursive: true });
}

const mapping = {
    "World Eaters": "chaos/legions/world-eaters-1.svg",
    "T'au Empire": "xenos/tau_empire/tau-sept.svg",
    "Space Marines": "human_imperium/adeptus-astartes.svg",
    "Adepta Sororitas": "human_imperium/adepta-sororitas.svg",
    "Adeptus Custodes": "human_imperium/adeptus-custodes.svg",
    "Adeptus Mechanicus": "human_imperium/adeptus-mechanicus.svg",
    "Adeptus Titanicus": "human_imperium/mechanicum/collegia-titanica.svg",
    "Aeldari": "xenos/eldar/craftworld-eldar.svg",
    "Astra Militarum": "human_imperium/astra-militarum.svg",
    "Black Templars": "human_imperium/astartes_chapters/black-templars.svg",
    "Blood Angels": "human_imperium/astartes_legion/blood-angels.svg",
    "Chaos Daemons": "chaos/chaos-daemons.svg",
    "Chaos Knights": "chaos/questor-traitoris.svg",
    "Chaos Space Marines": "chaos/chaos-star-01.svg",
    "Dark Angels": "human_imperium/astartes_legion/dark-angels.svg",
    "Death Guard": "chaos/legions/death-guard.svg",
    "Deathwatch": "human_imperium/astartes_chapters/deathwatch.svg",
    "Drukhari": "xenos/durhkari/drukhari-2.svg",
    "Emperor's Children": "chaos/legions/emperors-children-1.svg",
    "Genestealer Cults": "xenos/genestealer_cult/genestealer-cults.svg",
    "Grey Knights": "human_imperium/astartes_chapters/grey-knights.svg",
    "Imperial Fists": "human_imperium/astartes_legion/imperial-fists.svg",
    "Imperial Knights": "human_imperium/imperial-knights.svg",
    "Iron Hands": "human_imperium/astartes_legion/iron-hands.svg",
    "Leagues of Votann": "xenos/leagues-of-votann.svg",
    "Necrons": "xenos/necrons/necrons.svg",
    "Orks": "xenos/orks/orks.svg",
    "Raven Guard": "human_imperium/astartes_legion/raven-guard.svg",
    "Salamanders": "human_imperium/astartes_legion/salamanders.svg",
    "Space Wolves": "human_imperium/astartes_legion/space-wolves.svg",
    "Thousand Sons": "chaos/legions/thousand-sons.svg",
    "Tyranids": "xenos/tyranids.svg",
    "Ultramarines": "human_imperium/astartes_legion/ultramarines.svg",
    "White Scars": "human_imperium/astartes_legion/white-scars.svg",
    "Agents of the Imperium": "human_imperium/inquisition-01.svg"
};

let factionIconsJsContent = `// Auto-generated faction SVG emblems module
// Built from Certseeds/wh40k-icon repository

export default {
`;

for (const [faction, relPath] of Object.entries(mapping)) {
    const srcPath = path.join(srcSvgsDir, relPath);
    if (!fs.existsSync(srcPath)) {
        console.error(`ERROR: File not found: ${srcPath}`);
        continue;
    }

    // 1. Copy SVG to destination folder
    const filename = faction.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.svg';
    const destPath = path.join(destSvgsDir, filename);
    fs.copyFileSync(srcPath, destPath);

    // 2. Read and clean up SVG for inlining
    let svgContent = fs.readFileSync(srcPath, 'utf8');

    // Strip XML declarations and comments
    svgContent = svgContent.replace(/<\?xml.*?\?>/gi, '');
    svgContent = svgContent.replace(/<!--.*?-->/gs, '');

    // Extract viewBox and internal content, or standardize the outer <svg> element
    // Standardize to width="36" height="36" and inject colors dynamic variables
    // Most SVGs from that repo have fill="#000" or fill="#000000"
    // We will replace hardcoded fill/stroke values with dynamic colors.primary/colors.secondary
    // Let's replace any fill="#000000" or fill="#000" with fill="\${colors.primary}"
    // And fill="#ffffff" or fill="#fff" (non-transparent space) with fill="\${colors.secondary}" or similar
    
    // Standardize outer <svg> tag:
    // Regex to match <svg ...>
    svgContent = svgContent.replace(/<svg\s+([^>]*?)>/i, (match, attrs) => {
        // Strip existing width, height, fill, and stroke
        let cleanAttrs = attrs.replace(/\b(width|height|fill|stroke)\s*=\s*"[^"]*"/gi, '');
        return `<svg width="36" height="36" fill="\${colors.header || colors.primary}" ${cleanAttrs.trim()}>`;
    });

    // Replace color codes
    // Map non-white fills and strokes to colors.header || colors.primary
    // Map white/light fills and strokes to colors.secondary
    svgContent = svgContent.replace(/fill\s*=\s*"#([a-fA-F0-9]{3,6})"/gi, (match, hex) => {
        if (hex.toLowerCase() === 'ffffff' || hex.toLowerCase() === 'fff') {
            return 'fill="${colors.secondary}"';
        }
        return 'fill="${colors.header || colors.primary}"';
    });

    svgContent = svgContent.replace(/stroke\s*=\s*"#([a-fA-F0-9]{3,6})"/gi, (match, hex) => {
        if (hex.toLowerCase() === 'ffffff' || hex.toLowerCase() === 'fff') {
            return 'stroke="${colors.secondary}"';
        }
        return 'stroke="${colors.header || colors.primary}"';
    });

    svgContent = svgContent.trim();

    factionIconsJsContent += `  ${JSON.stringify(faction)}: (colors) => \`
${svgContent}
\`,
`;
}

factionIconsJsContent += `};
`;

const jsOutputPath = path.join(projectRoot, 'modules/faction_icons.js');
fs.writeFileSync(jsOutputPath, factionIconsJsContent, 'utf8');
console.log(`Successfully generated local SVGs and inlined module at ${jsOutputPath}`);
