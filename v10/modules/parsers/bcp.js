// BCP-like parser (exported from GW App but flattened/stripped indentation, using bullets '•' and '◦')
// Example behavior:
// Top-level sections (CHARACTERS, OTHER DATASHEETS) define containers.
// Units start with name + points (e.g. "Daemon Prince ... (190 Points)").
// Sub-elements are marked by bullets:
//   '•' usually starts a top-level item on the unit (Wargear, Enhancement, or Subgroup).
//   '◦' usually starts a nested item (Wargear inside a Subgroup).
//
// Subgroups like "2x Sekhetar Robot" are distinguished from wargear "1x Hellforged weapons" by checking if they contain further nested items later (lookahead or structure)
// OR by context (e.g. if the next line is ◦, then the current • line was a subgroup).

export function parseBcp(lines) {
    const raw = Array.isArray(lines) ? lines : lines.split(/\r?\n/);
    const result = {
        'CHARACTER': [],
        'BATTLELINE': [],
        'DEDICATED TRANSPORT': [],
        'OTHER DATASHEETS': [],
        'ALLIED UNITS': [],
        'SUMMARY': { faction: '', detachment: '', points: '' }
    };
    
    // Normalize section keys helper
    const normSection = (s) => {
        s = s.toUpperCase();
        if (s === 'CHARACTERS') return 'CHARACTER';
        if (s === 'DEDICATED TRANSPORTS') return 'DEDICATED TRANSPORT';
        return s;
    };
    
    let currentSection = null;
    let currentUnit = null;
    let currentSubgroup = null; // For nesting (e.g. Aviarch, Sekhetar Robot)

    // Regex helpers
    // Unit header: "Name (N Points)" or "Name (N pts)"
    const reUnitHeader = /^(.+?)\s*\(\s*(\d+[.,]?\d*)\s*(?:Points|Pts|pts)\s*\)\s*$/i;
    // Bullet level 1: •
    // Bullet level 2: ◦
    const reBullet1 = /^\s*•\s*(.*)$/;
    const reBullet2 = /^\s*◦\s*(.*)$/;

    // Basic heuristic for "is this line a section header?"
    const sectionHeaders = new Set([
        'CHARACTERS', 'CHARACTER', 'BATTLELINE', 'DEDICATED TRANSPORTS', 'DEDICATED TRANSPORT',
        'OTHER DATASHEETS', 'ALLIED UNITS', 'LORDS OF WAR', 'FORTIFICATIONS'
    ]);

    // Iterate lines
    for (let i = 0; i < raw.length; i++) {
        let line = raw[i].trim();
        if (!line) continue;

        // Check explicit section
        const upper = line.toUpperCase();
        if (sectionHeaders.has(upper)) {
            currentSection = normSection(upper);
            // reset unit context
            currentUnit = null;
            currentSubgroup = null;
            continue;
        }
        
        // If we haven't found a section yet, try to parse metadata or skip
        if (!currentSection) {
            // grab faction/detachment/points from top lines if plausible
            // e.g. "Thousand Sons", then "Warpforged Cabal", then "Strike Force (2000 Points)"
            const ptsMatch = line.match(/(\d+[.,]?\d*)\s*(?:Points|Pts)/i);
            if (ptsMatch) {
                result.SUMMARY.points = ptsMatch[1];
            }
            // A crude grab for faction/detachment could go here, but BCP is variable.
            // We'll trust the first section header to start the real parse.
            continue;
        }

        // 1. Is it a nested item '◦ ...'?
        const match2 = line.match(reBullet2);
        if (match2) {
            if (currentSubgroup) {
                parseAndAddItem(match2[1], currentSubgroup);
            } else if (currentUnit) {
                // Formatting error in input or unexpected nesting; attach to unit
                parseAndAddItem(match2[1], currentUnit);
            }
            continue;
        }

        // 2. Is it a top-level item '• ...'?
        const match1 = line.match(reBullet1);
        if (match1) {
            const content = match1[1];
            // Check if this item is actually a subgroup header.
            // Heuristic: Does the NEXT line start with '◦'? If so, this is a parent (subgroup).
            let isSubgroupHeader = false;
            // Look ahead for '◦'
            for (let j = i + 1; j < raw.length; j++) {
                const nl = raw[j].trim();
                // skip empties
                if (!nl) continue;
                if (reBullet2.test(nl)) {
                    isSubgroupHeader = true;
                }
                break; // only check the immediately following non-empty line
            }

            if (isSubgroupHeader) {
                // Create a subunit
                // Parse quantity and name from "2x Sekhetar Robot"
                const qtyMatch = content.match(/^(\d+)x\s+(.+)$/);
                let count = 1;
                let name = content;
                if (qtyMatch) {
                    count = parseInt(qtyMatch[1], 10);
                    name = qtyMatch[2];
                }
                const newSub = { 
                    name, 
                    count, 
                    items: [], 
                    type: 'subunit',
                    // GW App/BCP doesn't give distinct unit cost for subunits usually, 
                    // or it's wrapped in the unit header. We leave cost blank or 0.
                    cost: 0 
                };
                if (!currentUnit) {
                    // Fallback if loose item
                    currentUnit = createFallbackUnit(result, currentSection);
                }
                currentUnit.items.push(newSub);
                currentSubgroup = newSub;
            } else {
                // Regular item (Wargear, Enhancement, Warlord trait, etc.)
                // Close previous subgroup scope because we are back to level 1 bullet
                currentSubgroup = null; 
                if (!currentUnit) {
                    currentUnit = createFallbackUnit(result, currentSection);
                }
                parseAndAddItem(content, currentUnit);
            }
            continue;
        }

        // 3. Must be a Unit Header
        // "Daemon Prince ... (190 Points)"
        const unitMatch = line.match(reUnitHeader);
        if (unitMatch) {
            const uName = unitMatch[1].trim();
            const uPts = parseInt(unitMatch[2].replace(/,/g, ''), 10);
            
            const newUnit = {
                name: uName,
                cost: uPts,
                count: 1, // Usually 1 unless parsing multiple counts which BCP rarely aggregates this way at top level
                items: [],
                type: 'unit'
            };
            
            if (!result[currentSection]) {
                result[currentSection] = [];
            }
            result[currentSection].push(newUnit);
            currentUnit = newUnit;
            currentSubgroup = null;
        } else {
            // Unknown line type inside a section (could be fluff or parse fail)
            // Just ignore or attach as note? Safest to ignore unless it looks like data.
        }
    }

    return result;
}

function createFallbackUnit(result, section) {
    // If we find items before a unit header, stick them in a dummy unit
    const u = { name: "Unknown Unit", count: 1, cost: 0, items: [], type: 'unit' };
    if (!result[section]) result[section] = [];
    result[section].push(u);
    return u;
}

function parseAndAddItem(text, target) {
    text = text.trim();
    // Check for "Enhancements: ..."
    if (text.toLowerCase().startsWith('enhancements:')) {
        const enhName = text.substring('enhancements:'.length).trim();
        target.items.push({ name: `Enhancement: ${enhName}`, count: 1, cost: 0, type: 'special' });
        return;
    }
    // Check for "Warlord"
    if (text.toLowerCase() === 'warlord') {
        target.items.push({ name: 'Warlord', count: 1, cost: 0, type: 'special' });
        return;
    }

    // Default: Wargear or Ability
    // Try to parse quantity "1x ..."
    const qtyMatch = text.match(/^(\d+)x\s+(.+)$/);
    if (qtyMatch) {
         target.items.push({ 
             name: qtyMatch[2].trim(), 
             count: parseInt(qtyMatch[1], 10), 
             type: 'wargear' 
         });
    } else {
        // No quantity, assume 1
        target.items.push({ 
            name: text, 
            count: 1, 
            type: 'wargear' 
        });
    }
}
