export function normalizeForComparison(name) {
    if (!name) return '';
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/’/g, "'")
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

export function normalizeForSubstringComparison(name) {
    if (!name) return '';
    return name.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/’/g, "'")
        .trim();
}

export function flexibleNameMatch(name1, name2) {
    const name1Normalized = normalizeForComparison(name1).replace(/\s/g, '');
    const name2Normalized = normalizeForComparison(name2).replace(/\s/g, '');

    if (name1Normalized === name2Normalized) return true;

    if (name1Normalized.endsWith('s') && name2Normalized === name1Normalized.slice(0, -1)) return true;
    if (name2Normalized.endsWith('s') && name1Normalized === name2Normalized.slice(0, -1)) return true;

    return false;
}

export function flexibleItemMatch(rule, itemName) {
    return flexibleNameMatch(rule.item, itemName);
}

export function flexibleSubstringMatch(sourceString, targetString) {
    const normalizedSource = normalizeForSubstringComparison(sourceString);
    const normalizedTarget = normalizeForSubstringComparison(targetString);
    return normalizedSource.includes(normalizedTarget);
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