
export function normalizeForComparison(name) {
    if (!name) return '';
    // Decomposes accented chars (e.g., 'â' -> 'a' + '^') and removes the diacritics.
    // Also handles lowercase, trim, and common character variations.
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/’/g, "'")
        .trim();
}

export function flexibleItemMatch(rule, itemName) {
    const ruleItemNormalized = normalizeForComparison(rule.item);
    const itemNameNormalized = normalizeForComparison(itemName);
    if (ruleItemNormalized === itemNameNormalized) return true; // Exact match
    if (ruleItemNormalized === itemNameNormalized + 's') return true; // input: cutter, rule: cutters
    if (itemNameNormalized.endsWith('s') && ruleItemNormalized === itemNameNormalized.slice(0, -1)) return true; // input: cutters, rule: cutter
    return false;
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
