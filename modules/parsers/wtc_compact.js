import { normalizeForComparison, parseItemString, sortItemsByQuantityThenName } from '../utils.js';
import FAMILY_MAP from '../family_map.js';
import { standardizeSummary } from '../summary.js';

function smartTitleCase(s) {
    if (!s) return '';
    const small = new Set(['of','and','the','in','to','with','for','on','a','an','by','from']);
    return String(s).split(/\s+/).map((w, idx) => {
        if (!w) return '';
        const lw = w.toLowerCase();
        if (idx > 0 && small.has(lw)) return lw;
        return lw[0].toUpperCase() + lw.slice(1);
    }).join(' ');
}

function addItemToTarget(target, itemString, unitContextName, factionKeyword, unitTopName = '', skipIfMatchesUnitName = false, itemType = 'wargear') {
    if (!target) return;
    target.items = target.items || [];
    const parsed = parseItemString(String(itemString || '').trim());
    const qty = parsed.quantity ? String(parsed.quantity) : '1x';
    const name = parsed.name || '';
    const key = normalizeForComparison(name);
    if (skipIfMatchesUnitName) {
        const ctx = String(unitContextName || '');
        const top = String(unitTopName || '');
        if (normalizeForComparison(ctx) === normalizeForComparison(name) || (top && normalizeForComparison(top) === normalizeForComparison(name))) {
            return;
        }
    }
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
        const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
        const addQ = parseInt(String(qty || '1x').replace(/x/i, ''), 10) || 0;
        existing.quantity = `${exQ + addQ}x`;
    } else {
        const forcedType = (normalizeForComparison(name) === 'warlord') ? 'special' : itemType;
        target.items.push({ quantity: qty, name: name, items: [], type: forcedType, nameshort: '' });
    }
}

function parseAndAddEnhancement(content, target) {
    if (!content || !target) return;
    target.items = target.items || [];
    const raw = content.trim();
    const mPts = raw.match(/\(([^)]+)\)$/);
    const pts = mPts ? ` (${mPts[1]})` : '';
    const base = raw.replace(/\s*\([^)]+\)$/, '').trim();
    const normBase = normalizeForComparison(base);
    const already = (target.items || []).some(it => it && it.type === 'special' && normalizeForComparison((it.name || '').replace(/^Enhancement:\s*/i, '')) === normBase);
    if (already) return;
    const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
    const nameshort = `E: ${abbr}${pts}`.trim();
    const item = { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
    target.items.push(item);
}

export function parseWtcCompact(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    if (!Array.isArray(lines)) return result;

    const headerEnhancements = {};
    const headerLines = [];
    let i = 0;
    const hasLeadingQty = (s) => /^(\d+)x?\s+/i.test(String(s||'').trim());
    const maybePrefixQty = (s, n) => {
        const t = String(s || '').trim();
        if (!t) return t;
        // If the item already carries an explicit quantity (e.g. '2x Fusion blaster'),
        // multiply by group count: '2 with 2x Fusion blaster' => '4x Fusion blaster'.
        if (hasLeadingQty(t)) {
            const m = t.match(/^(\d+)x?\s+(.*)$/i);
            if (m) {
                const base = parseInt(m[1], 10) || 1;
                const rest = m[2].trim();
                const total = Math.max(1, base * (parseInt(n, 10) || 1));
                return `${total}x ${rest}`;
            }
            return t;
        }
        return `${n}x ${t}`;
    };

    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const t = raw.trim();
        if (!t) continue;
        if (t.startsWith('+') || t.startsWith('&')) {
            headerLines.push(t);
            continue;
        }
        break;
    }

    for (const hl of headerLines) {
        if (hl.startsWith('&')) {
            const v = hl.replace(/^&\s*/, '');
            const m = v.match(/^(.*?)\s*\(on\s+(?:(Char\d+):\s*)?(.*)\)$/i);
            if (m) {
                const enh = m[1].trim();
                const target = (m[3] || '').trim();
                if (target) headerEnhancements[target] = enh;
            }
            continue;
        }
        const line = hl.replace(/^\+\s*/, '');
        const m = line.match(/^([^:]+):\s*(.*)$/);
        if (m) {
            const key = m[1].trim().toUpperCase();
            const val = m[2].trim();
            if (key === 'FACTION KEYWORD') {
                const parts = val.split(' - ');
                result.SUMMARY.FACTION_KEYWORD = parts[parts.length - 1].trim();
            } else if (key === 'DETACHMENT') {
                result.SUMMARY.DETACHMENT = val.replace(/\u00A0/g, ' ');
            } else if (key === 'TOTAL ARMY POINTS') {
                result.SUMMARY.TOTAL_ARMY_POINTS = val;
            }
        }
    }

    result.SUMMARY.LIST_TITLE = '';
    if (result.SUMMARY && result.SUMMARY.FACTION_KEYWORD) {
        const fk = result.SUMMARY.FACTION_KEYWORD;
        const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === (fk || '').toString().toLowerCase());
        const family = familyKey ? FAMILY_MAP[familyKey] : null;
        if (family) result.SUMMARY.DISPLAY_FACTION = `${family} - ${fk}`;
        else result.SUMMARY.DISPLAY_FACTION = fk + (result.SUMMARY.DETACHMENT ? ` - ${result.SUMMARY.DETACHMENT}` : '');
        try { result.SUMMARY.FACTION_KEY = fk.toString().toLowerCase(); } catch (e) {}
    }

    let currentUnit = null;
    let lastCharUnit = null;
    const unitLineRegex = /^(?:(Char\d+):\s*)?(?:(\d+)x?\s+)?(.*?)\s*\((\d+)\s*(?:pts|points)\)(?::\s*(.*))?$/i;
    const bulletRegex = /^\s*(?:\u2022|\*|-|\u25e6)\s*(.*)$/;

    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (!trimmed) continue;
        if (/^Enhancement:\s*/i.test(trimmed)) {
            const content = trimmed.replace(/^Enhancement:\s*/i, '').trim();
            if (lastCharUnit) parseAndAddEnhancement(content, lastCharUnit);
            continue;
        }
        const um = trimmed.match(unitLineRegex);
        if (um) {
            const charId = um[1];
            const qty = um[2] ? `${um[2]}x` : '1x';
            const name = (um[3] || '').trim();
            const pts = parseInt(um[4], 10) || 0;
            const inline = um[5];
            const unit = { quantity: qty, name, points: pts, items: [], isComplex: false, nameshort: '' };
            if (charId) {
                result.CHARACTER.push(unit);
                lastCharUnit = unit;
            } else {
                result['OTHER DATASHEETS'] = result['OTHER DATASHEETS'] || [];
                result['OTHER DATASHEETS'].push(unit);
            }
            currentUnit = unit;
            if (inline) inline.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(unit, it, unit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true));
            continue;
        }
        const b = raw.match(bulletRegex);
        if (b) {
            const content = b[1].trim();
            const withMatch = content.match(/^(\d+)\s+with\s+(.*)$/i);
            if (withMatch && currentUnit) {
                const n = parseInt(withMatch[1], 10) || 1;
                const rest = withMatch[2];
                const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                    const itemStr = maybePrefixQty(it, n);
                    addItemToTarget(target, itemStr, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                });
                continue;
            }
            const subColonMatch = content.match(/^(\d+x?)\s+(.*?):\s*(.*)$/i);
            if (subColonMatch && currentUnit) {
                const sq = subColonMatch[1];
                const sname = subColonMatch[2].trim();
                const rest = subColonMatch[3] || '';
                const sub = { quantity: sq, name: sname, items: [], type: 'subunit' };
                currentUnit.items = currentUnit.items || [];
                currentUnit.items.push(sub);
                if (rest) {
                    const withInline = rest.match(/^(\d+)\s+with\s+(.*)$/i);
                    if (withInline) {
                        const n = parseInt(withInline[1], 10) || 1;
                        const list = withInline[2];
                        list.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                            const itemStr = maybePrefixQty(it, n);
                            addItemToTarget(sub, itemStr, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                        });
                    } else {
                        rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(sub, it, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
                    }
                }
                continue;
            }
            const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
            if (subMatch && currentUnit) {
                const sub = { quantity: subMatch[1], name: subMatch[2].trim(), items: [], type: 'subunit' };
                currentUnit.items = currentUnit.items || [];
                currentUnit.items.push(sub);
                continue;
            }
            if (currentUnit) {
                addItemToTarget(currentUnit, content, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                continue;
            }
            continue;
        }
        const indentedWith = trimmed.match(/^(\d+)\s+with\s+(.*)$/i);
        if (indentedWith && currentUnit) {
            const n = parseInt(indentedWith[1], 10) || 1;
            const rest = indentedWith[2];
            const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
            rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                const itemStr = maybePrefixQty(it, n);
                addItemToTarget(target, itemStr, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
            });
            continue;
        }
        const fallbackColon = trimmed.match(/^(.*?):\s*(.*)$/);
        if (fallbackColon && currentUnit) {
            const rest = fallbackColon[2] || '';
            rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(currentUnit, it, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
            continue;
        }
    }

    // Intentionally ignore header-based enhancement mappings for WTC-Compact.
    // Per app requirements, enhancements in this format are specified on body lines
    // immediately following the character unit (e.g., "Enhancement: Foo (+NN pts)").
    // Applying header mappings can cause duplicates when both header and body specify
    // the same enhancement; therefore we skip applying them here.

    // Build a flat list for subsequent deterministic sorting.
    const allUnits = [...(result.CHARACTER || []), ...(result['OTHER DATASHEETS'] || [])];

    // Ensure deterministic ordering: sort top-level items and subunit items
    for (const u of allUnits) {
        if (u && Array.isArray(u.items) && u.items.length > 0) sortItemsByQuantityThenName(u.items);
        const subs = (u && Array.isArray(u.items)) ? u.items.filter(it => it && it.type === 'subunit') : [];
        for (const su of subs) if (su && Array.isArray(su.items) && su.items.length > 0) sortItemsByQuantityThenName(su.items);
    }

    standardizeSummary(result);
    return result;
}
