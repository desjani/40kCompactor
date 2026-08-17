import { isWargearSkippable, parseNewRecruitHeader } from '../utils.js';

export function parseNRWTCCompact(lines, skippableWargearMap = {}) {
    if (!Array.isArray(lines) || lines.length === 0) {
        return {
            edition: '11th',
            metadata: {
                title: '', armyName: '', faction: '', detachment: '', detachments: [],
                pointsTotal: 0, totalPoints: 0, pointsLimit: 0, forceDispositions: [],
                warlordName: '', warlordId: '', enhancements: []
            },
            units: []
        };
    }

    const cleanLines = lines.map(l => l ? l.replace(/\u00a0/g, ' ') : '');
    const { metadata, nextIndex } = parseNewRecruitHeader(cleanLines);
    const result = {
        edition: '11th',
        metadata,
        units: []
    };

    let currentUnit = null;
    let currentSubunit = null;

    const parseQtyAndName = (str, unitName) => {
        const cleaned = str.trim();
        let name = cleaned;
        let quantity = 1;
        const match = cleaned.match(/^(\d+)x?\s+(.*)$/i);
        if (match) {
            name = match[2].trim();
            quantity = parseInt(match[1], 10);
        }
        name = name.replace(/^with\s+/i, '').trim();
        const skippable = isWargearSkippable(skippableWargearMap, result.metadata.faction, unitName, name);
        return {
            name,
            quantity,
            skippable
        };
    };

    // Add a parsed wargear item to a subunit's wargear list, summing into an existing
    // entry of the same name instead of pushing a duplicate. A subunit's loadout is
    // often split across several "N with ..." lines/segments (e.g. rank-and-file vs.
    // an icon bearer), so the same wargear name can legitimately appear more than once.
    const addWargear = (targetArray, parsedWg) => {
        const existing = targetArray.find(w => w.name === parsedWg.name);
        if (existing) {
            existing.quantity += parsedWg.quantity;
        } else {
            targetArray.push(parsedWg);
        }
    };

    for (let i = nextIndex; i < cleanLines.length; i++) {
        const line = cleanLines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. Enhancement line
        const enhMatch = trimmed.match(/^(?:•?\s*)?Enhancement\s*:\s*(.*?)\s*\(\+(\d+)\s*(?:pts|points|pt)\)/i);
        if (enhMatch) {
            if (currentUnit) {
                currentUnit.enhancements.push({
                    name: enhMatch[1].trim(),
                    points: parseInt(enhMatch[2], 10) || 0
                });
            }
            continue;
        }

        // 2. Subunit line (starts with • or *)
        if (trimmed.startsWith('•') || trimmed.startsWith('*')) {
            const subContent = trimmed.substring(1).trim();

            // Check if it has inline wargear via colon:
            const colonIdx = subContent.indexOf(':');
            if (colonIdx !== -1) {
                const subHeader = subContent.substring(0, colonIdx).trim();
                const itemsStr = subContent.substring(colonIdx + 1).trim();

                const match = subHeader.match(/^(?:(\d+)x?\s+)?(.*)$/);
                const quantity = match && match[1] ? parseInt(match[1], 10) : 1;
                const name = match ? match[2].trim() : subHeader;

                currentSubunit = {
                    name,
                    quantity,
                    wargear: []
                };

                // An inline subunit's item text can itself lead with a "N with ..."
                // model-count multiplier (e.g. "2x Shas'ui: 2 with Gun Drone, Plasma rifle")
                // when all N models in the subunit share one loadout. Distinguish that
                // from a per-item "Nx Item" quantity on the first item (no "with").
                const modelPrefixMatch = itemsStr.match(/^(\d+)\s+with\s+(.*)$/i);
                const modelMultiplier = modelPrefixMatch ? (parseInt(modelPrefixMatch[1], 10) || 1) : 1;
                const rawItemsStr = modelPrefixMatch ? modelPrefixMatch[2] : itemsStr;

                const items = rawItemsStr.split(',').map(s => s.trim()).filter(Boolean);
                items.forEach(it => {
                    const parsedWg = parseQtyAndName(it, currentUnit ? currentUnit.name : '');
                    parsedWg.quantity = parsedWg.quantity * modelMultiplier;
                    addWargear(currentSubunit.wargear, parsedWg);
                });

                if (currentUnit) {
                    currentUnit.subunits.push(currentSubunit);
                }
                // Inline subunit is done
                currentSubunit = null;
            } else {
                // Multi-line subunit header
                const match = subContent.match(/^(?:(\d+)x?\s+)?(.*)$/);
                const quantity = match && match[1] ? parseInt(match[1], 10) : 1;
                const name = match ? match[2].trim() : subContent;

                currentSubunit = {
                    name,
                    quantity,
                    wargear: []
                };

                if (currentUnit) {
                    currentUnit.subunits.push(currentSubunit);
                }
            }
            continue;
        }

        // 3. Model detail line (indented under a subunit), or an "Attached to <Character>"
        // backlink identifying which character leads this unit
        if (line.startsWith(' ') || line.startsWith('\t')) {
            const attachedToMatch = trimmed.match(/^Attached to\s+(.+)$/i);
            if (attachedToMatch) {
                if (currentUnit) {
                    currentUnit._attachedToName = attachedToMatch[1].trim();
                }
                continue;
            }

            const detailMatch = trimmed.match(/^(\d+)(?:\s+with\s+)?(.*)$/i);
            if (detailMatch && currentSubunit) {
                const modelQty = parseInt(detailMatch[1], 10) || 1;
                const itemsStr = detailMatch[2].trim();
                const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);

                items.forEach(it => {
                    const parsedWg = parseQtyAndName(it, currentUnit ? currentUnit.name : '');
                    parsedWg.quantity = parsedWg.quantity * modelQty;
                    addWargear(currentSubunit.wargear, parsedWg);
                });
            }
            continue;
        }

        // 4. Unit Header line
        const unitMatch = trimmed.match(/^(?:([a-zA-Z0-9]+):\s*)?(?:(\d+)x?\s+)?(.*?)\s*\((\d+)\s*(?:pts|points|pt)\)(?:\s*:\s*(.*))?$/i);
        if (unitMatch) {
            const idPrefix = unitMatch[1] ? unitMatch[1].trim() : '';
            const quantity = unitMatch[2] ? parseInt(unitMatch[2], 10) : 1;
            const name = unitMatch[3].trim();
            const points = parseInt(unitMatch[4], 10) || 0;
            const inlineDetails = unitMatch[5] ? unitMatch[5].trim() : '';

            let category = 'Other Datasheets';
            if (idPrefix.toLowerCase().startsWith('char')) {
                category = 'Characters';
            }

            currentUnit = {
                name,
                points,
                quantity,
                category,
                wargear: [],
                enhancements: [],
                subunits: []
            };

            // Check if is Warlord via header metadata or ID matching
            if (result.metadata.warlordId && idPrefix === result.metadata.warlordId) {
                currentUnit.isWarlord = true;
            } else if (result.metadata.warlordName && name.toLowerCase() === result.metadata.warlordName.toLowerCase()) {
                currentUnit.isWarlord = true;
            }

            if (inlineDetails) {
                const parts = inlineDetails.split(',').map(s => s.trim()).filter(Boolean);
                parts.forEach(p => {
                    if (p.toLowerCase() === 'warlord') {
                        currentUnit.isWarlord = true;
                    } else {
                        addWargear(currentUnit.wargear, parseQtyAndName(p, name));
                    }
                });
            }

            result.units.push(currentUnit);
            currentSubunit = null; // Reset subunit context
            continue;
        }
    }

    // Merge each unit carrying an "Attached to <Character>" backlink into its
    // leading character, replacing the character's slot with a combined
    // { isAttached, attachedParts: [leader, bodyguard] } wrapper (the shape the
    // renderers already understand from the GW App parser). This format has no
    // explicit attachment-group section in the source, so the backlink is the
    // only signal available; matching is done purely by character name, since
    // it's unambiguous on its own (unlike the forward "Leading X[N]" hint on the
    // character, which is redundant for merging and is intentionally left unparsed).
    const consumedCharIndices = new Set();
    const consumedSquadIndices = new Set();
    const mergedByCharIndex = new Map();

    result.units.forEach((squadUnit, squadIndex) => {
        if (!squadUnit._attachedToName) return;
        const targetName = squadUnit._attachedToName.toLowerCase();
        const charIndex = result.units.findIndex((u, idx) =>
            idx !== squadIndex &&
            !consumedCharIndices.has(idx) &&
            !u._attachedToName &&
            u.name.toLowerCase() === targetName
        );
        if (charIndex === -1) return;

        const charUnit = result.units[charIndex];
        delete squadUnit._attachedToName;
        mergedByCharIndex.set(charIndex, {
            name: charUnit.name,
            points: (charUnit.points || 0) + (squadUnit.points || 0),
            category: 'Attached Units',
            isAttached: true,
            attachedParts: [
                { ...charUnit, role: 'Leader' },
                { ...squadUnit, role: 'Bodyguard' }
            ]
        });
        consumedCharIndices.add(charIndex);
        consumedSquadIndices.add(squadIndex);
    });

    if (mergedByCharIndex.size > 0) {
        result.units = result.units
            .map((u, idx) => mergedByCharIndex.get(idx) || u)
            .filter((u, idx) => !consumedSquadIndices.has(idx));
    }

    // Clean up the scratch field from any unmatched (orphaned) backlink
    result.units.forEach(u => { delete u._attachedToName; });

    return result;
}
