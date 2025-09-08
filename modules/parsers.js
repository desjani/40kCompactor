// Clean parsers.js implementing the requested rules
import { getIndent, normalizeForComparison, parseItemString } from './utils.js';
import FAMILY_MAP from './family_map.js';

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
    // If requested, ignore wargear whose name matches the current unit/subunit context.
    if (skipIfMatchesUnitName) {
        const ctx = String(unitContextName || '');
        const top = String(unitTopName || '');
        // Only skip when the normalized names are exactly equal (case/whitespace-insensitive)
        if (normalizeForComparison(ctx) === normalizeForComparison(name) || (top && normalizeForComparison(top) === normalizeForComparison(name))) {
            return; // disregard self-referential wargear against subunit or top-level unit
        }
    }
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
        const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
        const addQ = parseInt(String(qty || '1x').replace(/x/i, ''), 10) || 0;
        existing.quantity = `${exQ + addQ}x`;
    } else {
    // Ensure literal 'Warlord' is treated as a special, not as generic wargear
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

    // Deduplicate: if target already has an enhancement with the same base, skip
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

    // --- Pass 1: Header parsing (lines starting with + or &)
    const headerEnhancements = {}; // map targetName -> enhancementName (from & lines)
    const headerLines = [];
    let i = 0;
    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const t = raw.trim();
        if (!t) continue;
        if (t.startsWith('+') || t.startsWith('&')) {
            headerLines.push(t);
            continue;
        }
        // stop header scan on first non-header line
        break;
    }

    for (const hl of headerLines) {
        if (hl.startsWith('&')) {
            // Example: & Berzerker Glaive (on Char2: Master of Executions)
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
                // Use the text after the last ' - ' on the header line
                const parts = val.split(' - ');
                result.SUMMARY.FACTION_KEYWORD = parts[parts.length - 1].trim();
            } else if (key === 'DETACHMENT') {
                // Normalize non-breaking spaces to regular spaces
                result.SUMMARY.DETACHMENT = val.replace(/\u00A0/g, ' ');
            } else if (key === 'TOTAL ARMY POINTS') {
                result.SUMMARY.TOTAL_ARMY_POINTS = val;
            }
            // intentionally ignore other header keys
        }
    }

    // WTC-Compact lists do not contain a list title; define LIST_TITLE as an empty string
    result.SUMMARY.LIST_TITLE = '';

    // Build DISPLAY_FACTION from FACTION_KEYWORD using FAMILY_MAP when possible
    if (result.SUMMARY && result.SUMMARY.FACTION_KEYWORD) {
        const fk = result.SUMMARY.FACTION_KEYWORD;
        const familyKey = Object.keys(FAMILY_MAP).find(k => k.toLowerCase() === (fk || '').toString().toLowerCase());
        const family = familyKey ? FAMILY_MAP[familyKey] : null;
        if (family) result.SUMMARY.DISPLAY_FACTION = `${family} - ${fk}`;
        else result.SUMMARY.DISPLAY_FACTION = fk + (result.SUMMARY.DETACHMENT ? ` - ${result.SUMMARY.DETACHMENT}` : '');
        // Canonical lowercased key for downstream consumers
        try { result.SUMMARY.FACTION_KEY = fk.toString().toLowerCase(); } catch (e) {}
    }

    // --- Pass 2: Body parsing
    let currentUnit = null;
    let lastCharUnit = null;

    const unitLineRegex = /^(?:(Char\d+):\s*)?(?:(\d+)x?\s+)?(.*?)\s*\((\d+)\s*(?:pts|points)\)(?::\s*(.*))?$/i;
    const bulletRegex = /^\s*(?:\u2022|\*|-|\u25e6)\s*(.*)$/; // bullets like '•' or '-' or '*'

    for (; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (!trimmed) continue;

        // Top-level enhancement lines that attach to the last character unit
        if (/^Enhancement:\s*/i.test(trimmed)) {
            const content = trimmed.replace(/^Enhancement:\s*/i, '').trim();
            if (lastCharUnit) parseAndAddEnhancement(content, lastCharUnit, result.SUMMARY.FACTION_KEYWORD || '');
            continue;
        }

        // Unit lines
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

            if (inline) {
                    inline.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(unit, it, unit.name, result.SUMMARY.FACTION_KEYWORD || '', unit.name, true));
            }
            continue;
        }

        // Bulleted or indented lines (subunits, 'N with ...', or wargear)
        const b = raw.match(bulletRegex);
        if (b) {
            const content = b[1].trim();
            // 1) 'N with X, Y' lines (attach to last subunit if present, else to unit)
            const withMatch = content.match(/^(\d+)\s+with\s+(.*)$/i);
            if (withMatch && currentUnit) {
                const n = parseInt(withMatch[1], 10) || 1;
                const rest = withMatch[2];
                const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
                    rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(target, `${n}x ${it}`, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
                continue;
            }

            // 2) Subunit header like '9x Khorne Berzerker' or '1x Khorne Berzerker Champion: Icon ...'
            const subColonMatch = content.match(/^(\d+x?)\s+(.*?):\s*(.*)$/i);
            if (subColonMatch && currentUnit) {
                const sq = subColonMatch[1];
                const sname = subColonMatch[2].trim();
                const rest = subColonMatch[3] || '';
                const sub = { quantity: sq, name: sname, items: [], type: 'subunit' };
                currentUnit.items = currentUnit.items || [];
                currentUnit.items.push(sub);
                if (rest) {
                    // If the rest begins with an inline quantity like '2 with A, B', apply that quantity to each listed item
                    const withInline = rest.match(/^(\d+)\s+with\s+(.*)$/i);
                    if (withInline) {
                        const n = parseInt(withInline[1], 10) || 1;
                        const list = withInline[2];
                        list.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(sub, `${n}x ${it}`, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
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

            // 3) Plain wargear bullet: add to current unit
            if (currentUnit) {
                    addItemToTarget(currentUnit, content, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                continue;
            }
            continue;
        }

        // Non-bulleted indented lines like '5 with Bolt pistol, Chainblade' (no bullet symbol)
        const indentedWith = trimmed.match(/^(\d+)\s+with\s+(.*)$/i);
        if (indentedWith && currentUnit) {
            const n = parseInt(indentedWith[1], 10) || 1;
            const rest = indentedWith[2];
            const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(target, `${n}x ${it}`, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
            continue;
        }

        // Fallback: if there's a colon and it looks like 'X: Y, Z' (wargear list) attach to currentUnit
        const fallbackColon = trimmed.match(/^(.*?):\s*(.*)$/);
        if (fallbackColon && currentUnit) {
            const rest = fallbackColon[2] || '';
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(currentUnit, it, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
            continue;
        }
    }

    // Apply header-specified enhancements (from & lines)
    const allUnits = [...(result.CHARACTER || []), ...(result['OTHER DATASHEETS'] || [])];
    const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    for (const k of Object.keys(headerEnhancements)) {
        const enh = headerEnhancements[k];
        const found = allUnits.find(u => normalize(u.name).includes(normalize(k)) || normalize(`${u.quantity} ${u.name}`).includes(normalize(k)));
        if (found) parseAndAddEnhancement(enh, found, result.SUMMARY.FACTION_KEYWORD || '');
    }

    return result;
}
export function parseGwAppV2(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i;
    const firstSectionIndex = lines.findIndex(line => sectionHeaderRegex.test((line||'').trim().toUpperCase()));
    const headerLinesRaw = firstSectionIndex === -1 ? lines.slice(0, 0) : lines.slice(0, firstSectionIndex);
    // Normalize header lines and drop export footer lines
    let headerLines = headerLinesRaw.map(l => (l||'').trim()).filter(l => l && !l.startsWith('Exported with'));

    // RULE: LIST_TITLE is always the first non-empty line
    const firstNonEmpty = headerLines.findIndex(l => l && l.trim() !== '');
    if (firstNonEmpty !== -1) {
        const LIST_TITLE_LINE = headerLines[firstNonEmpty];
        // Extract LIST_TITLE (text before parentheses) and TOTAL_ARMY_POINTS
        const listTitleMatch = LIST_TITLE_LINE.match(/^(.*?)\s*\((\s*\d+\s*(?:pts|points)\s*)\)\s*$/i);
        if (listTitleMatch) {
            result.SUMMARY.LIST_TITLE = listTitleMatch[1].trim();
            const digits = (listTitleMatch[2].match(/(\d+)/) || [])[1] || '';
            if (digits) result.SUMMARY.TOTAL_ARMY_POINTS = `${digits}pts`;
        } else {
            result.SUMMARY.LIST_TITLE = LIST_TITLE_LINE;
        }

        // Build candidates: lines after LIST_TITLE up to first section header
        const candidates = [];
        for (let i = firstNonEmpty + 1; i < headerLines.length; i++) {
            const t = headerLines[i];
            if (!t) continue;
            candidates.push(t);
        }

        // Ignore game-size indicator rows: they must contain one of the keywords and a parenthetical
        const gameSizeKeywords = ['Combat Patrol', 'Incursion', 'Strike Force', 'Onslaught'];
        const isGameSize = (s) => {
            if (!s) return false;
            if (!/\(/.test(s)) return false;
            for (const k of gameSizeKeywords) if (new RegExp(k, 'i').test(s)) return true;
            return false;
        };

        // Eliminate any rows that equal any family value from FAMILY_MAP (case-insensitive)
        const familyValues = new Set(Object.values(FAMILY_MAP).map(v => (v || '').toString().toLowerCase()));

        const filtered = candidates.filter(r => {
            if (!r) return false;
            if (isGameSize(r)) return false;
            if (familyValues.has(r.toLowerCase())) return false;
            return true;
        });

        // From remaining rows pick the faction and detachment. Prefer a faction that matches a key
        // in FAMILY_MAP (case-insensitive). If none match, fall back to the last candidate as faction.
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
            // prefer first filtered as faction if no explicit match
            factionCandidate = filtered[0];
            detachmentCandidate = filtered.length > 1 ? filtered[1] : detachmentCandidate;
        }

        if (factionCandidate) result.SUMMARY.FACTION_KEYWORD = factionCandidate;
        if (detachmentCandidate) result.SUMMARY.DETACHMENT = detachmentCandidate;

        // Build DISPLAY_FACTION as 'Family - Faction' when family known
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
                    if (/^Enhancement:/i.test(content)) {
                        parseAndAddEnhancement(content.replace(/^Enhancement:\s*/i, '').trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    }
                    if (blockIsComplex && currentSection !== 'CHARACTER') {
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
        }
    }

    return result;
}

export function parseGwApp(lines) {
    return parseGwAppV2(lines);
}

export function detectFormat(lines) {
    if (lines.slice(0, 10).some(line => /^\s*\+\s*FACTION KEYWORD:/.test(line))) return 'WTC_COMPACT';
    if (lines.slice(0, 25).some(line => /^\s*(CHARACTERS|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS)\s*$/i.test((line||'').toUpperCase()))) return 'GW_APP';
    return 'UNKNOWN';
}
