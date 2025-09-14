import { getIndent, normalizeForComparison, parseItemString, sortItemsByQuantityThenName } from '../utils.js';
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

function addItemToTarget(target, itemString, unitContextName, factionKeyword, unitTopName = '', skipIfMatchesUnitName = false, itemType = 'wargear', parentQuantity = 1) {
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

function parseAndAddEnhancement(content, target, factionKeyword) {
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

export function parseGwAppV2(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i;
    const firstSectionIndex = lines.findIndex(line => sectionHeaderRegex.test((line||'').trim().toUpperCase()));
    const headerLinesRaw = firstSectionIndex === -1 ? lines.slice(0, 0) : lines.slice(0, firstSectionIndex);
    let headerLines = headerLinesRaw.map(l => (l||'').trim()).filter(l => l && !l.startsWith('Exported with'));
    const firstNonEmpty = headerLines.findIndex(l => l && l.trim() !== '');
    if (firstNonEmpty !== -1) {
        const LIST_TITLE_LINE = headerLines[firstNonEmpty];
        const listTitleMatch = LIST_TITLE_LINE.match(/^(.*?)\s*\((\s*\d+\s*(?:pts|points)\s*)\)\s*$/i);
        if (listTitleMatch) {
            result.SUMMARY.LIST_TITLE = listTitleMatch[1].trim();
            const digits = (listTitleMatch[2].match(/(\d+)/) || [])[1] || '';
            if (digits) result.SUMMARY.TOTAL_ARMY_POINTS = `${digits}pts`;
        } else {
            result.SUMMARY.LIST_TITLE = LIST_TITLE_LINE;
        }
        const candidates = [];
        for (let i = firstNonEmpty + 1; i < headerLines.length; i++) {
            const t = headerLines[i];
            if (!t) continue;
            candidates.push(t);
        }
        const gameSizeKeywords = ['Combat Patrol', 'Incursion', 'Strike Force', 'Onslaught'];
        const isGameSize = (s) => {
            if (!s) return false;
            if (!/\(/.test(s)) return false;
            for (const k of gameSizeKeywords) if (new RegExp(k, 'i').test(s)) return true;
            return false;
        };
        const familyValues = new Set(Object.values(FAMILY_MAP).map(v => (v || '').toString().toLowerCase()));
        const filtered = candidates.filter(r => {
            if (!r) return false;
            if (isGameSize(r)) return false;
            if (familyValues.has(r.toLowerCase())) return false;
            return true;
        });
        let factionCandidate = null;
        let detachmentCandidate = null;
        const factionKeyLower = Object.keys(FAMILY_MAP).map(k => k.toLowerCase());
        for (const r of filtered) {
            if (factionKeyLower.includes((r || '').toString().toLowerCase())) {
                factionCandidate = r;
            } else if (!detachmentCandidate) {
                detachmentCandidate = r;
            }
        }
        if (!factionCandidate && filtered.length > 0) {
            factionCandidate = filtered[0];
            detachmentCandidate = filtered.length > 1 ? filtered[1] : detachmentCandidate;
        }
        if (factionCandidate) result.SUMMARY.FACTION_KEYWORD = factionCandidate;
        if (detachmentCandidate) result.SUMMARY.DETACHMENT = detachmentCandidate;
        if (factionCandidate) {
            const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === factionCandidate.toLowerCase());
            const family = familyKey ? FAMILY_MAP[familyKey] : null;
            if (family) result.SUMMARY.DISPLAY_FACTION = `${family} - ${factionCandidate}`;
            else result.SUMMARY.DISPLAY_FACTION = factionCandidate + (detachmentCandidate ? ` - ${detachmentCandidate}` : '');
            try { result.SUMMARY.FACTION_KEY = factionCandidate.toString().toLowerCase(); } catch (e) {}
        }
    }

    const startIndex = firstSectionIndex === -1 ? 0 : firstSectionIndex;
    const unitLineRegex = /^(.*?)\s*\(([\d,\.\s]+)\s*(?:pts|points)\)\s*$/i;
    const bulletRegex = /^\s*(?:•|\-|\+|◦)\s*(.*)$/;
    let currentSection = null;

    for (let i = startIndex; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('Exported with')) continue;
        if (sectionHeaderRegex.test(trimmed.toUpperCase())) {
            currentSection = /^CHARACTERS?/i.test(trimmed) ? 'CHARACTER' : 'OTHER DATASHEETS';
            continue;
        }
        const m = trimmed.match(unitLineRegex);
        if (m) {
            const nameRaw = m[1].trim();
            const pts = parseInt(String(m[2]).replace(/[\,\.\s]/g, ''), 10) || 0;
            let quantity = '1x';
            let unitName = nameRaw;
            const leadingQty = nameRaw.match(/^([0-9]+x?)\s+(.*)$/i);
            if (leadingQty) { quantity = leadingQty[1].toLowerCase(); unitName = leadingQty[2].trim(); }
            const unit = { quantity, name: unitName, points: pts, items: [], isComplex: false, nameshort: '' };
            const sectionKey = currentSection === 'CHARACTER' ? 'CHARACTER' : 'OTHER DATASHEETS';
            result[sectionKey] = result[sectionKey] || [];
            result[sectionKey].push(unit);

            const blockLines = [];
            let j = i + 1;
            while (j < lines.length) {
                const l = lines[j] || '';
                if (!l.trim()) break;
                if (sectionHeaderRegex.test(l.trim().toUpperCase())) break;
                if (unitLineRegex.test(l.trim())) break;
                if (!/^\s+/.test(l)) break;
                blockLines.push(l);
                j++;
            }

            const blockIsComplex = (() => {
                for (let bi = 0; bi < blockLines.length; bi++) {
                    const line = blockLines[bi];
                    const b = line.match(bulletRegex);
                    if (!b) continue;
                    const indent = getIndent(line);
                    for (let k = bi + 1; k < blockLines.length; k++) {
                        const child = blockLines[k];
                        if (!child.trim()) break;
                        const childIndent = getIndent(child);
                        if (childIndent <= indent) break;
                        if (bulletRegex.test(child)) return true;
                    }
                }
                return false;
            })();

            let currentSubunit = null;
            let currentSubIndent = 0;
            for (let bi = 0; bi < blockLines.length; bi++) {
                const line = blockLines[bi];
                const t = line.trim();
                const b = line.match(bulletRegex);
                const indent = getIndent(line);
                if (b) {
                    const content = b[1].trim();
                    const enhancementLike = content.match(/^(.*?)\s*\(\+?\s*\d+\s*(?:pts?|points)\)\s*$/i);
                    if (/^Enhancement:/i.test(content)) {
                        parseAndAddEnhancement(content.replace(/^Enhancement:\s*/i, '').trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    } else if (enhancementLike) {
                        parseAndAddEnhancement(content.trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    }
                    if (blockIsComplex) {
                        if (currentSubunit && typeof currentSubIndent === 'number' && indent > currentSubIndent) {
                            addItemToTarget(currentSubunit, content, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, false);
                            continue;
                        }
                        currentSubunit = null;
                        const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
                        const subQty = subMatch ? subMatch[1] : '1x';
                        const subName = subMatch ? subMatch[2].trim() : content;
                        const subunit = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                        unit.items = unit.items || [];
                        unit.items.push(subunit);
                        currentSubunit = subunit;
                        currentSubIndent = indent;
                        continue;
                    }
                    addItemToTarget(unit, content, unit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
                    continue;
                }
                if (currentSubunit && indent > currentSubIndent) {
                    addItemToTarget(currentSubunit, t, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
                    continue;
                }
                addItemToTarget(unit, t, unit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
            }

            i = j - 1;
            continue;
        }
    }

    function ensurePropsLocal(obj, parentName) {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj.name !== 'string') obj.name = '';
        if (typeof obj.quantity !== 'string') obj.quantity = obj.quantity ? String(obj.quantity) : '1x';
        if (typeof obj.type !== 'string') obj.type = obj.type || 'wargear';
        if (typeof obj.nameshort !== 'string') obj.nameshort = obj.nameshort || '';
        if (!Array.isArray(obj.items)) obj.items = [];

        if (/^Enhancement:/i.test(obj.name)) {
            const content = obj.name.replace(/^Enhancement:\s*/i, '').trim();
            obj.type = 'special';
            obj.nameshort = obj.nameshort || (() => {
                const m = content.match(/\(([^)]+)\)$/);
                const pts = m ? ` (${m[1]})` : '';
                const base = content.replace(/\s*\([^)]+\)$/, '').trim();
                const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
                return `E: ${abbr}${pts}`.trim();
            })();
            obj.name = `Enhancement: ${smartTitleCase(content.replace(/\s*\([^)]+\)$/, '').trim())}`;
        } else {
            obj.name = parentName ? obj.name : smartTitleCase(obj.name);
        }

        if (normalizeForComparison(obj.name) === 'warlord') obj.type = 'special';

        obj.items = (obj.items || []).map(it => {
            if (!it) return null;
            if (typeof it === 'string') {
                const coerced = { quantity: '1x', name: it.trim(), items: [], type: /^Enhancement:/i.test(it) ? 'special' : 'wargear', nameshort: '' };
                ensurePropsLocal(coerced, obj.name);
                if (coerced.name) coerced.name = smartTitleCase(coerced.name);
                return coerced;
            }
            ensurePropsLocal(it, obj.name);
            if (it && it.name) it.name = smartTitleCase(it.name);
            return it;
        }).filter(Boolean);
    }

    for (const sectionKey of ['CHARACTER', 'OTHER DATASHEETS']) {
        if (!Array.isArray(result[sectionKey])) continue;
        for (const unit of result[sectionKey]) {
            ensurePropsLocal(unit);
            const subunits = (unit.items || []).filter(it => it && it.type === 'subunit');
            if (subunits.length > 0) {
                const allSameName = subunits.every(s => normalizeForComparison(s.name || '') === normalizeForComparison(unit.name || ''));
                if (allSameName) {
                    const agg = new Map();
                    let total = 0;
                    for (const su of subunits) {
                        const q = parseInt(String(su.quantity || '1x').replace(/x/i, ''), 10) || 1;
                        total += q;
                        for (const inner of (su.items || [])) {
                            const temp = { items: [] };
                            addItemToTarget(temp, `${inner.quantity || '1x'} ${inner.name}`, unit.name, result.SUMMARY.FACTION_KEYWORD || '', inner.type || 'wargear', 1);
                            for (const it of temp.items) {
                                const key = normalizeForComparison(it.name || '');
                                if (agg.has(key)) {
                                    const ex = agg.get(key);
                                    const exq = parseInt(String(ex.quantity || '1x').replace(/x/i, ''), 10) || 0;
                                    const addq = parseInt(String(it.quantity || '1x').replace(/x/i, ''), 10) || 0;
                                    ex.quantity = `${exq + addq}x`;
                                } else {
                                    agg.set(key, it);
                                }
                            }
                        }
                    }
                    unit.items = Array.from(agg.values());
                    if (total > 0) unit.quantity = `${total}x`;
                    unit.isComplex = false;
                } else {
                    const total = subunits.reduce((acc, it) => acc + (parseInt(String(it.quantity || '1x').replace(/x/i, ''), 10) || 0), 0);
                    if (total > 0) unit.quantity = `${total}x`;
                    unit.isComplex = true;
                }
            } else {
                unit.isComplex = false;
            }
            // Ensure deterministic ordering: sort items by descending quantity then name
            if (Array.isArray(unit.items) && unit.items.length > 0) sortItemsByQuantityThenName(unit.items);
        }
    }

    standardizeSummary(result);
    return result;
}

export function parseGwApp(lines) { return parseGwAppV2(lines); }
