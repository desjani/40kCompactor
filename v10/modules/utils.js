export function getIndent(line) {
    const match = line.match(/^\s*/);
    return match ? match[0].length : 0;
}

export function normalizeForComparison(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function parseItemString(itemString) {
    const itemRegex = /^(?:(\d+)x?\s+)?(.*)/;
    const itemMatch = itemString.trim().match(itemRegex);
    if (itemMatch) {
        const quantity = itemMatch[1] ? `${itemMatch[1]}x` : '1x';
    let name = itemMatch[2].trim();
    // Normalize inputs that begin with the literal 'with' (e.g. "with Hideous Mutations")
    name = name.replace(/^with\s+/i, '').trim();
        return { quantity, name };
    }
    return { quantity: '1x', name: itemString.trim() };
}

export function flexibleNameMatch(name1, name2) {
    if (!name1 || !name2) return false;
    const normName1 = normalizeForComparison(name1).replace(/s$/, '');
    const normName2 = normalizeForComparison(name2).replace(/s$/, '');

    return normName1.includes(normName2) || normName2.includes(normName1);
}

// Sort wargear/special item arrays in-place: descending numeric quantity, then by name (A-Z)
export function sortItemsByQuantityThenName(items) {
    if (!Array.isArray(items)) return items;
    items.sort((a, b) => {
        const aq = parseInt(String((a && a.quantity) || '1x').replace(/x/i, ''), 10) || 1;
        const bq = parseInt(String((b && b.quantity) || '1x').replace(/x/i, ''), 10) || 1;
        // descending quantity
        if (aq !== bq) return bq - aq;
        const an = (a && a.name) ? a.name.toString().toLowerCase() : '';
        const bn = (b && b.name) ? b.name.toString().toLowerCase() : '';
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
    });
    return items;
}