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

    // TODO: Re-add Force Dispositions when New Recruit adds support
    // TODO: Re-add Attached Units when New Recruit adds support

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

                const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
                items.forEach(it => {
                    currentSubunit.wargear.push(parseQtyAndName(it, currentUnit ? currentUnit.name : ''));
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

        // 3. Model detail line (indented under a subunit)
        if (line.startsWith(' ') || line.startsWith('\t')) {
            const detailMatch = trimmed.match(/^(\d+)(?:\s+with\s+)?(.*)$/i);
            if (detailMatch && currentSubunit) {
                const modelQty = parseInt(detailMatch[1], 10) || 1;
                const itemsStr = detailMatch[2].trim();
                const items = itemsStr.split(',').map(s => s.trim()).filter(Boolean);

                items.forEach(it => {
                    const parsedWg = parseQtyAndName(it, currentUnit ? currentUnit.name : '');
                    parsedWg.quantity = parsedWg.quantity * modelQty;
                    currentSubunit.wargear.push(parsedWg);
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
                        currentUnit.wargear.push(parseQtyAndName(p, name));
                    }
                });
            }

            result.units.push(currentUnit);
            currentSubunit = null; // Reset subunit context
            continue;
        }
    }

    return result;
}
