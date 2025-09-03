import { normalizeForComparison } from './utils.js';

function getInlineItemsString(items, useAbbreviations = true, useCustomColors = false, colors = {}, wargearAbbrMap) {
    if (!items || items.length === 0) return '';

    const specialItems = items.filter(item => item.type === 'special');
    const wargearItems = items.filter(item => item.type === 'wargear');

    const specialStrings = specialItems.map(item => {
        if (useAbbreviations) {
            return item.nameshort;
        }
        if (item.name.startsWith('Enhancement: ')) {
            return item.name.substring('Enhancement: '.length);
        }
        return item.name;
    });

    const wargearStrings = wargearItems.map(item => {
        const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
        const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
        const abbr = wargearAbbrMap.get(item.name)?.abbr;
        if (abbr === 'NULL') return null;
        const itemName = useAbbreviations && abbr ? abbr : item.name;
        return `${itemQtyDisplay}${itemName}`;
    }).filter(Boolean);

    const allStrings = [...specialStrings, ...wargearStrings].filter(Boolean);
    const itemsString = allStrings.join(', ');

    if (!itemsString) return '';

    if (useCustomColors) {
        return ` <span style="color: ${colors.wargear};">(${itemsString})</span>`;
    }

    return ` (${itemsString})`;
}


export function generateOutput(data, useAbbreviations, wargearAbbrMap) {
    let html = '', plainText = '';
    const factionKeyword = data.SUMMARY?.FACTION_KEYWORD || '';
    const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (factionKeyword.split(' - ').pop() || factionKeyword);

    const colorMode = document.querySelector('input[name="colorMode"]:checked').value;
    const useCustomColors = useAbbreviations && colorMode === 'custom';
    
    let colors = {};
    if (useCustomColors) {
        colors = {
            unit: document.getElementById('unitColor').value,
            subunit: document.getElementById('subunitColor').value,
            points: document.getElementById('pointsColor').value,
            header: document.getElementById('headerColor').value,
            wargear: document.getElementById('wargearColor').value
        };
    }

    if (data.SUMMARY) {
        const summaryParts = [];
        if (data.SUMMARY.LIST_TITLE) summaryParts.push(data.SUMMARY.LIST_TITLE);
        if (displayFaction) summaryParts.push(displayFaction);
        if (data.SUMMARY.DETACHMENT) summaryParts.push(`${data.SUMMARY.DETACHMENT}`);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) summaryParts.push(`${data.SUMMARY.TOTAL_ARMY_POINTS}`);
        if (summaryParts.length > 0) {
            const summaryText = summaryParts.join(' | ');
            const headerColorStyle = useCustomColors ? `color: ${colors.header};` : 'color: var(--color-text-secondary);';
            html += `<div style="padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border);"><p style="font-size: 0.75rem; margin-bottom: 0.25rem; ${headerColorStyle} font-weight: 600;">${summaryText}</p></div>`;
            plainText += summaryText + '\n-------------------------------------\n';
        }
    }
    html += `<div style="margin-top: 0.5rem;">`;
    for (const section in data) {
        if (section !== 'SUMMARY' && Array.isArray(data[section]) && data[section].length > 0) {
            data[section].forEach(unit => {
                const numericQuantity = parseInt(unit.quantity.replace('x', ''), 10);
                let quantityDisplay = numericQuantity > 1 ? `${numericQuantity} ` : '';

                if (useAbbreviations) { // Compact List Rendering
                    const topLevelItems = unit.items.filter(item => item.points === undefined);
                    const itemsString = getInlineItemsString(topLevelItems, true, useCustomColors, colors, wargearAbbrMap);
                    const unitNameText = `${quantityDisplay}${unit.name}`;
                    const pointsText = `[${unit.points}]`;
                    
                    const unitNameHTML = useCustomColors ? `<span style="color: ${colors.unit};">${unitNameText}</span>` : unitNameText;
                    const pointsHTML = useCustomColors ? `<span style="color: ${colors.points};">${pointsText}</span>` : pointsText;
                    
                    const unitTextForPlain = `${unitNameText}${getInlineItemsString(topLevelItems, true, false, {}, wargearAbbrMap)} ${pointsText}`;
                    const unitHTML = `${unitNameHTML}${itemsString} ${pointsHTML}`;

                    html += `<div><p style="color: var(--color-text-primary); font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">${unitHTML}</p>`;
                    plainText += `* ${unitTextForPlain}\n`;

                    const subunitItems = unit.items.filter(item => item.points !== undefined);
                    if (subunitItems.length > 0) {
                        html += `<div style="padding-left: 1rem; font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 400;">`;
                        subunitItems.forEach(item => {
                            const subUnitHasVisibleItems = item.items && item.items.some(subItem => wargearAbbrMap.get(subItem.name)?.abbr !== 'NULL' || subItem.type === 'special');
                            if (subUnitHasVisibleItems) {
                                const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                                const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                                const subunitItemsString = getInlineItemsString(item.items, true, useCustomColors, colors, wargearAbbrMap);
                                
                                const subunitNameText = `${itemQtyDisplay}${item.name}`;
                                const subunitNameHTML = useCustomColors ? `<span style="color: ${colors.subunit};">${subunitNameText}</span>` : subunitNameText;
                                const itemHTML = `${subunitNameHTML}${subunitItemsString}`;
                                const itemTextForPlain = `${subunitNameText}${getInlineItemsString(item.items, true, false, {}, wargearAbbrMap)}`;

                                html += `<p style="font-weight: 500; color: var(--color-text-primary); margin: 0;">${itemHTML}</p>`;
                                plainText += `  + ${itemTextForPlain}\n`;
                            }
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                } else { // Extended List Rendering
                    const unitText = `${quantityDisplay}${unit.name} [${unit.points}]`;
                    html += `<div><p style="color: var(--color-text-primary); font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">${unitText}</p>`;
                    plainText += `* ${unitText}\n`;
                    if (unit.items && unit.items.length > 0) {
                        html += `<div style="padding-left: 1rem; font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 400;">`;
                        const topLevelItems = unit.items.filter(item => item.points === undefined);
                        const subunitItems = unit.items.filter(item => item.points !== undefined).sort((a, b) => parseInt(a.quantity.replace('x', ''), 10) - parseInt(b.quantity.replace('x', ''), 10));

                        topLevelItems.forEach(item => {
                            const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                            const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                            html += `<p style="margin: 0;">${itemQtyDisplay}${item.name}</p>`;
                            plainText += `  - ${itemQtyDisplay}${item.name}\n`;
                        });

                        subunitItems.forEach(item => {
                            const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                            const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                            const itemText = `${itemQtyDisplay}${item.name}`;
                            html += `<p style="font-weight: 500; color: var(--color-text-primary); margin: 0.5rem 0 0 0;">${itemText}</p>`;
                            plainText += `  * ${itemText}\n`;

                            if (item.items && item.items.length > 0) {
                                html += `<div style="padding-left: 1rem;">`;
                                item.items.forEach(subItem => {
                                    const subItemNumericQty = parseInt(subItem.quantity.replace('x', ''), 10);
                                    const subItemQtyDisplay = subItemNumericQty > 1 ? `${subItemNumericQty} ` : '';
                                    html += `<p style="margin: 0;">${subItemQtyDisplay}${subItem.name}</p>`;
                                    plainText += `    - ${subItemQtyDisplay}${subItem.name}\n`;
                                });
                                html += `</div>`;
                            }
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
            });
        }
    }
    html += `</div>`;
    return { html, plainText };
}

export function generateDiscordText(data, plain, useAbbreviations = true, wargearAbbrMap) {
    const colorMode = document.querySelector('input[name="colorMode"]:checked').value;
    const useColor = !plain && colorMode !== 'none';
    let text = plain ? '' : (useColor ? '\`\`\`ansi\n' : '\`\`\`\n');

    const ansiPalette = [
        { name: 'grey', hex: '#808080', code: 30 },
        { name: 'red', hex: '#FF0000', code: 31 },
        { name: 'green', hex: '#00FF00', code: 32 },
        { name: 'yellow', hex: '#FFFF00', code: 33 },
        { name: 'blue', hex: '#0000FF', code: 34 },
        { name: 'magenta', hex: '#FF00FF', code: 35 },
        { name: 'cyan', hex: '#00FFFF', code: 36 },
        { name: 'white', hex: '#FFFFFF', code: 37 }
    ];

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };

    const findClosestAnsi = (hexColor) => {
        const inputRgb = hexToRgb(hexColor);
        if (!inputRgb) return ansiPalette.find(c => c.name === 'white').code;

        let minDistance = Infinity;
        let bestCode = ansiPalette.find(c => c.name === 'white').code;

        for (const color of ansiPalette) {
            const paletteRgb = hexToRgb(color.hex);
            const distance = Math.pow(inputRgb.r - paletteRgb.r, 2) +
                           Math.pow(inputRgb.g - paletteRgb.g, 2) +
                           Math.pow(inputRgb.b - paletteRgb.b, 2);
            if (distance < minDistance) {
                minDistance = distance;
                bestCode = color.code;
            }
        }
        return bestCode;
    };

    const toAnsi = (txt, hexColor, bold = false) => {
        if (!useColor || !hexColor) return txt;
        if (hexColor.toLowerCase() === '#000000') return txt;

        const ansiCode = findClosestAnsi(hexColor);
        const boldCode = bold ? '1;' : '';
        return `\u001b[${boldCode}${ansiCode}m${txt}\u001b[0m`;
    };

    let colors = { unit: '#FFFFFF', subunit: '#808080', points: '#FFFF00', header: '#FFFFFF', wargear: '#FFFFFF' };
    if (useColor) {
        if (colorMode === 'custom') {
            colors = {
                unit: document.getElementById('unitColor').value,
                subunit: document.getElementById('subunitColor').value,
                points: document.getElementById('pointsColor').value,
                header: document.getElementById('headerColor').value,
                wargear: document.getElementById('wargearColor').value
            };
        }
    }
    
    const getDiscordItemsString = (items, useAbbreviations = true) => {
        if (!items || items.length === 0) return '';
        
        const specialItems = items.filter(item => item.type === 'special');
        const wargearItems = items.filter(item => item.type === 'wargear');
    
        const specialStrings = specialItems.map(item => {
            if (useAbbreviations) {
                return item.nameshort;
            }
            if (item.name.startsWith('Enhancement: ')) {
                return item.name.substring('Enhancement: '.length);
            }
            return item.name;
        });

        const wargearStrings = wargearItems.map(item => {
            const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
            const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
            const abbr = wargearAbbrMap.get(item.name)?.abbr;
            if (abbr === 'NULL') return null;
            const itemName = useAbbreviations && abbr ? abbr : item.name;
            return `${itemQtyDisplay}${itemName}`;
        }).filter(Boolean);
    
        const allStrings = [...specialStrings, ...wargearStrings].filter(Boolean);
        const itemsString = allStrings.join(', ');

        if(!itemsString) return '';

        return ` ${toAnsi(`(${itemsString})`, colors.wargear)}`;
    };


    if (data.SUMMARY) {
        const summaryParts = [];
        if (data.SUMMARY.LIST_TITLE) summaryParts.push(data.SUMMARY.LIST_TITLE);
        if (data.SUMMARY.FACTION_KEYWORD) {
            const displayFaction = data.SUMMARY?.DISPLAY_FACTION || (data.SUMMARY.FACTION_KEYWORD.split(' - ').pop() || data.SUMMARY.FACTION_KEYWORD);
            summaryParts.push(displayFaction);
        }
        if (data.SUMMARY.DETACHMENT) summaryParts.push(data.SUMMARY.DETACHMENT);
        if (data.SUMMARY.TOTAL_ARMY_POINTS) summaryParts.push(data.SUMMARY.TOTAL_ARMY_POINTS);
        if (summaryParts.length > 0) {
            const header = summaryParts.join(' | ');
            text += `${toAnsi(header, colors.header, true)}\n\n`;
        }
    }
    for (const section in data) {
        if (section === 'SUMMARY' || !Array.isArray(data[section])) continue;
        data[section].forEach(unit => {
            const numericQuantity = parseInt(unit.quantity.replace('x', ''), 10);
            let quantityDisplay = numericQuantity > 1 ? `${numericQuantity} ` : '';
            if (unit.isComplex) {
                quantityDisplay = '';
            }
            const unitName = `${quantityDisplay}${unit.name}`;
            const points = `${unit.points}`;
            const topLevelItems = unit.items.filter(item => item.points === undefined);
            const itemsString = getDiscordItemsString(topLevelItems, useAbbreviations);
            text += `* ${toAnsi(unitName, colors.unit, true)}${itemsString} ${toAnsi(`[${points}]`, colors.points, true)}\n`;
            
            const subunitItems = unit.items.filter(item => item.points !== undefined);
            subunitItems.forEach(item => {
                const subUnitHasVisibleItems = item.items && item.items.some(subItem => wargearAbbrMap.get(subItem.name)?.abbr !== 'NULL' || subItem.type === 'special');
                if (subUnitHasVisibleItems) {
                    const itemNumericQty = parseInt(item.quantity.replace('x', ''), 10);
                    const itemQtyDisplay = itemNumericQty > 1 ? `${itemNumericQty} ` : '';
                    const subunitName = item.name;
                    const subunitItemsString = getDiscordItemsString(item.items, useAbbreviations);
                    const subunitText = `${itemQtyDisplay}${subunitName}`;
                    const prefix = plain ? '*' : '+';
                    text += `  ${prefix} ${toAnsi(subunitText, colors.subunit)}${subunitItemsString}\n`;
                }
            });
        });
    }
    if (!plain) text += '\`\`\`';
    return text;
}