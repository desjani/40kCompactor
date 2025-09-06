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