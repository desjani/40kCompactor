
export function normalizeForComparison(name) {
    if (!name) return '';
    // Decomposes accented chars (e.g., 'â' -> 'a' + '^') and removes the diacritics.
    // Also handles lowercase, trim, and common character variations.
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/’/g, "'")
        .trim();
}

export function flexibleNameMatch(name1, name2) {
    const name1Normalized = normalizeForComparison(name1);
    const name2Normalized = normalizeForComparison(name2);
    if (name1Normalized === name2Normalized) return true; // Exact match
    if (name1Normalized.endsWith('s') && name2Normalized === name1Normalized.slice(0, -1)) return true; // name1 is plural, name2 is singular
    if (name2Normalized.endsWith('s') && name1Normalized === name2Normalized.slice(0, -1)) return true; // name2 is plural, name1 is singular
    return false;
}

export function flexibleItemMatch(rule, itemName) {
    return flexibleNameMatch(rule.item, itemName);
}

export function getIndent(s) { return s.match(/^\s*/)[0].length; }

export function parseItemString(itemString) {
    const match = itemString.match(/^(\d+x?\s+)?(.*)$/);
    if (match) {
        const quantity = match[1] ? match[1].trim() : '1x';
        const name = match[2].trim();
        return { quantity, name };
    }
    return { quantity: '1x', name: itemString };
}
