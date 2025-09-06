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

// Normalize SUMMARY to a canonical shape used by renderers/tests.
function normalizeSummary(summary) {
    if (!summary || typeof summary !== 'object') return;
    // remove fields we deliberately do not use
    delete summary.WARLORD;
    delete summary.ENHANCEMENT;
    delete summary.SECONDARY;

    const asStr = v => (v === null || v === undefined) ? '' : String(v).trim();
    summary.FACTION_KEYWORD = asStr(summary.FACTION_KEYWORD);
    summary.DETACHMENT = asStr(summary.DETACHMENT);
    summary.LIST_TITLE = asStr(summary.LIST_TITLE);
    // Remove trailing '(NNN points)' or '(NNN pts)' from the list title
    try {
        summary.LIST_TITLE = summary.LIST_TITLE.replace(/\s*\(\s*\d{1,5}\s*(?:pts|points)?\s*\)\s*$/i, '').trim();
    } catch (e) {
        // ignore
    }
    summary.DISPLAY_FACTION = asStr(summary.DISPLAY_FACTION);

    // If DISPLAY_FACTION missing, compose from LIST_TITLE and FACTION_KEYWORD
    if (!summary.DISPLAY_FACTION) {
        const parts = [summary.LIST_TITLE, summary.FACTION_KEYWORD].filter(Boolean);
        summary.DISPLAY_FACTION = parts.join(' - ');
    }

    // Normalize TOTAL_ARMY_POINTS to 'NNNNpts' if possible
    const extractPoints = s => {
        if (!s) return '';
        const m = String(s).match(/\(\s*(\d+)\s*points\)/i) || String(s).match(/(\d{3,5})\s*(?:pts|points)?/i) || String(s).match(/(\d{3,5})/);
        if (m) return `${m[1].replace(/\s+/g,'')}pts`;
        return '';
    };
    if (summary.TOTAL_ARMY_POINTS) summary.TOTAL_ARMY_POINTS = extractPoints(summary.TOTAL_ARMY_POINTS) || asStr(summary.TOTAL_ARMY_POINTS);
    else summary.TOTAL_ARMY_POINTS = extractPoints(summary.LIST_TITLE) || extractPoints(summary.DISPLAY_FACTION) || '';

    // Ensure NUMBER_OF_UNITS is a string
    summary.NUMBER_OF_UNITS = (summary.NUMBER_OF_UNITS === undefined || summary.NUMBER_OF_UNITS === null) ? '' : String(summary.NUMBER_OF_UNITS);

    // Ensure FACTION_KEYWORD is the short faction (as used in skippable_wargear.json)
    try {
        let short = '';
        if (summary.FACTION_KEYWORD) short = String(summary.FACTION_KEYWORD).split(' - ').pop().trim();
        if (!short && summary.DISPLAY_FACTION) short = String(summary.DISPLAY_FACTION).split(' - ').pop().trim();
        if (!short && summary.LIST_TITLE) {
            // fallback: try to find a wordy faction at end of list title
            short = String(summary.LIST_TITLE).split(' - ').pop().trim();
        }
        if (short) summary.FACTION_KEYWORD = short;

        // Use FAMILY_MAP to build DISPLAY_FACTION as 'FAMILY - FACTION_KEYWORD'
        const family = FAMILY_MAP[summary.FACTION_KEYWORD] || FAMILY_MAP[summary.DISPLAY_FACTION] || FAMILY_MAP[summary.FACTION_KEYWORD.split('-').pop()?.trim()];
        if (family) summary.DISPLAY_FACTION = `${family} - ${summary.FACTION_KEYWORD}`;
        else if (!summary.DISPLAY_FACTION) summary.DISPLAY_FACTION = summary.FACTION_KEYWORD;
    } catch (e) {
        // non-fatal
    }

    // Final coercion to ensure types are strings for canonical keys
    for (const k of ['FACTION_KEYWORD','DETACHMENT','TOTAL_ARMY_POINTS','LIST_TITLE','DISPLAY_FACTION','NUMBER_OF_UNITS']) {
        if (summary[k] === undefined || summary[k] === null) summary[k] = '';
        else summary[k] = String(summary[k]);
    }
}

function addItemToTarget(target, itemString, unitContextName, factionKeyword, itemType = 'wargear', parentQuantity = 1) {
    if (!target) return;
    target.items = target.items || [];
    const parsed = parseItemString(String(itemString || '').trim());
    const qty = parsed.quantity ? String(parsed.quantity) : '1x';
    const name = parsed.name || '';
    const key = normalizeForComparison(name);
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
        const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
        const addQ = parseInt(String(qty || '1x').replace(/x/i, ''), 10) || 0;
        existing.quantity = `${exQ + addQ}x`;
    } else {
        target.items.push({ quantity: qty, name: name, items: [], type: itemType, nameshort: '' });
    }
}

function parseAndAddEnhancement(content, target, factionKeyword) {
    if (!content || !target) return;
    target.items = target.items || [];
    const raw = content.trim();
    // Extract any trailing parenthetical points (e.g. '(+20 pts)' or '(+20)')
    const mPts = raw.match(/\(([^)]+)\)\s*$/);
    let enhPts = '';
    if (mPts) {
        const inner = String(mPts[1] || '').trim();
        const numM = inner.match(/([+-]?\d+)/);
        if (numM) enhPts = (String(numM[1]).startsWith('+') ? String(numM[1]) : `+${String(numM[1])}`);
        else enhPts = inner.replace(/\s*pts\s*/i, '').trim();
    }
    const base = raw.replace(/\s*\([^)]+\)$/, '').trim();

    // Deduplicate: if target already has an enhancement with the same base, skip
    const normBase = normalizeForComparison(base);
    const already = (target.items || []).some(it => it && it.type === 'special' && normalizeForComparison((it.name || '').replace(/^Enhancement:\s*/i, '')) === normBase);
    if (already) return;

    const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
    const nameshort = `E: ${abbr}`.trim();
    const item = { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
    if (enhPts) item.enhancementPoints = enhPts; // store as '+NN' or raw token
    target.items.push(item);
}

// (Removed enhancement points map: enhancements will no longer include point values.)

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
            let pts = '';
            if (m) {
                const numM = String(m[1]).match(/([+-]?\d+)/);
                if (numM) pts = ` (+${String(numM[1]).replace(/^\+?/, '')})`;
                else pts = ` (${m[1]})`;
            }
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
            // Do not parse SUMMARY keys that aren't useful, but capture WARLORD raw for later
            if (key === 'WARLORD') { result.SUMMARY._WARLORD_RAW = val; continue; }
            const skipKeys = new Set(['ENHANCEMENT', 'SECONDARY']);
            if (skipKeys.has(key)) continue;
            if (key === 'FACTION KEYWORD') result.SUMMARY.FACTION_KEYWORD = val;
            else if (key === 'DETACHMENT') result.SUMMARY.DETACHMENT = val;
            else if (key === 'TOTAL ARMY POINTS') result.SUMMARY.TOTAL_ARMY_POINTS = val;
            else if (key === 'NUMBER OF UNITS') result.SUMMARY.NUMBER_OF_UNITS = val;
            else result.SUMMARY[key] = val;
        }
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

            const unit = { quantity: qty, name, points: pts, items: [], nameshort: '' };
            if (charId) {
                unit._charId = charId;
                result.CHARACTER.push(unit);
                lastCharUnit = unit;
            } else {
                result['OTHER DATASHEETS'] = result['OTHER DATASHEETS'] || [];
                result['OTHER DATASHEETS'].push(unit);
            }
            // normalize props for the new unit
            try { ensurePropsLocal(unit); } catch (e) {}
            currentUnit = unit;

            if (inline) {
                inline.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(unit, it, unit.name, result.SUMMARY.FACTION_KEYWORD || ''));
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
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(target, `${n}x ${it}`, target.name, result.SUMMARY.FACTION_KEYWORD || ''));
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
                // ensure subunit has standardized properties
                sub.nameshort = sub.nameshort || '';
                currentUnit.items.push(sub);
                if (rest) rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(sub, it, sub.name, result.SUMMARY.FACTION_KEYWORD || ''));
                continue;
            }

            const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
            if (subMatch && currentUnit) {
                const subQty = subMatch[1];
                const subName = subMatch[2].trim();

                // Structural heuristic: if the following indented block exists, inspect it.
                // If the block contains multiple lines or any bulleted lines, treat as a subunit.
                // Otherwise it's likely a quantityed wargear line (e.g. "3x Ectoplasma cannon").
                // Find the next non-blank line after the current line
                let nextLine = '';
                for (let k = i + 1; k < lines.length; k++) {
                    if ((lines[k] || '').trim() === '') continue;
                    nextLine = lines[k];
                    break;
                }
                const nextLineIsMoreIndented = nextLine && getIndent(nextLine) > getIndent(raw);
                if (nextLineIsMoreIndented) {
                    const blockLines = [];
                    for (let j = i + 1; j < lines.length; j++) {
                        const lineJ = lines[j] || '';
                        if (lineJ.trim() === '') break;
                        if (getIndent(lineJ) > getIndent(raw)) {
                            blockLines.push(lineJ.trim());
                        } else {
                            break;
                        }
                    }
                    const hasBulletInBlock = blockLines.some(bl => bulletRegex.test(bl));
                    if (!hasBulletInBlock && blockLines.length <= 1) {
                        // Likely wargear listed as a quantityed bullet; attach to unit instead.
                        addItemToTarget(currentUnit, content, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '');
                        continue;
                    }
                }

                const sub = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                currentUnit.items = currentUnit.items || [];
                sub.nameshort = sub.nameshort || '';
                currentUnit.items.push(sub);
                continue;
            }

            // 3) Plain wargear bullet: add to current unit
            if (currentUnit) {
                addItemToTarget(currentUnit, content, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '');
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
            rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(target, `${n}x ${it}`, target.name, result.SUMMARY.FACTION_KEYWORD || ''));
            continue;
        }

        // Fallback: if there's a colon and it looks like 'X: Y, Z' (wargear list) attach to currentUnit
        const fallbackColon = trimmed.match(/^(.*?):\s*(.*)$/);
        if (fallbackColon && currentUnit) {
            const rest = fallbackColon[2] || '';
            rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(currentUnit, it, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || ''));
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

    // Reorder CHARACTER entries for WTC output to match GW App ordering:
    // prefer header 'CharN' reference, otherwise locate a unit containing an item named 'Warlord'.
    try {
        if (Array.isArray(result.CHARACTER) && result.CHARACTER.length > 0) {
            const chars = result.CHARACTER.slice();
            let warlordUnit = null;
            const rawW = result.SUMMARY && result.SUMMARY._WARLORD_RAW ? String(result.SUMMARY._WARLORD_RAW) : '';
            const m = rawW.match(/(Char\d+)/i);
            if (m) {
                const cid = m[1].toUpperCase();
                const idx = chars.findIndex(u => u._charId && u._charId.toUpperCase() === cid);
                if (idx >= 0) warlordUnit = chars.splice(idx, 1)[0];
            }
            if (!warlordUnit) {
                const warlordIdx = chars.findIndex(u => Array.isArray(u.items) && u.items.some(it => it && normalizeForComparison(it.name || '') === 'warlord'));
                if (warlordIdx >= 0) warlordUnit = chars.splice(warlordIdx, 1)[0];
            }
            chars.sort((a, b) => {
                const an = normalizeForComparison(a && a.name || '');
                const bn = normalizeForComparison(b && b.name || '');
                if (an < bn) return -1;
                if (an > bn) return 1;
                return 0;
            });
            if (warlordUnit) chars.unshift(warlordUnit);
            result.CHARACTER = chars;
            // Clean temporary markers
            for (const c of result.CHARACTER) delete c._charId;
            if (result.SUMMARY) delete result.SUMMARY._WARLORD_RAW;
        }
    } catch (e) {
        // non-fatal
    }

    // Ensure all units and nested items have been coerced to canonical shapes
    try {
        const allUnits2 = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const u of allUnits2) {
            ensurePropsLocal(u);
        }
    } catch (e) {
        // non-fatal
    }

    // Compute top-level quantities from subunits for OTHER DATASHEETS when present
    try {
        const ods = result['OTHER DATASHEETS'] || [];
        for (const unit of ods) {
            if (!unit || !Array.isArray(unit.items)) continue;
            // Coerce any plain-string children into normal wargear objects.
            // Do NOT automatically turn quantity-prefixed strings into subunits here;
            // GW App's strict rule requires explicit bulleted subunit bodies. Leaving
            // strings as wargear prevents false-positive subunit classification.
            for (let idx = 0; idx < unit.items.length; idx++) {
                const it = unit.items[idx];
                if (!it) continue;
                if (typeof it === 'string') {
                    const coerced = { quantity: '1x', name: it.trim(), items: [], type: 'wargear', nameshort: '' };
                    ensurePropsLocal(coerced, unit.name);
                    unit.items[idx] = coerced;
                    continue;
                }
                // Objects produced by the main parsing passes are left as-is.
            }

            const subunits = unit.items.filter(it => it && (it.type === 'subunit' || normalizeForComparison(it.type || '') === 'subunit'));
            if (subunits.length > 0) {
                let total = 0;
                for (const su of subunits) {
                    const q = parseInt(String(su.quantity || '1x').replace(/x/i, ''), 10);
                    total += (isNaN(q) ? 1 : q);
                }
                unit.quantity = `${total}x`;
            }
        }
    } catch (e) {
        // non-fatal
    }

    // Enforce strict typing rules across all top-level units and their children:
    // - Top-level units (CHARACTER and OTHER DATASHEETS entries) must have type 'unit'
    // - Direct children of a unit are either 'subunit', 'wargear', or 'special'
    // - A child is a 'subunit' only when its normalized name is clearly the unit member (e.g., 'Khorne Berzerker' under 'Khorne Berzerkers')
    // - Subunits are only one level deep; anything under a subunit is always 'wargear'
    try {
        const normalize = s => normalizeForComparison(String(s||''));
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const unit of allTop) {
            if (!unit || typeof unit !== 'object') continue;
            unit.type = 'unit';
            unit.items = unit.items || [];

            const unitKey = normalize(unit.name).replace(/s$/,'');

            for (let i = 0; i < unit.items.length; i++) {
                const child = unit.items[i];
                if (!child) continue;
                // Strings -> coerce into objects
                if (typeof child === 'string') {
                    unit.items[i] = { quantity: '1x', name: child.trim(), items: [], type: 'wargear', nameshort: '' };
                    ensurePropsLocal(unit.items[i], unit.name);
                }
                const c = unit.items[i];
                // Special items: Warlord or Enhancement
                const cNameNorm = normalize(c.name || '');
                if (cNameNorm === 'warlord' || /^enhancement:/i.test(c.name || '')) {
                    c.type = 'special';
                    continue;
                }
                // Decide subunit vs wargear: subunit when child name relates to unit name
                const childKey = normalize(c.name || '').replace(/s$/,'');
                // Structural heuristic: prefer explicit structural evidence of subunitness.
                // If the child already has nested items or its items include bullets / multiple lines,
                // it's a subunit. Otherwise fall back to name similarity as a tiebreaker.
                const hasNested = Array.isArray(c.items) && c.items.length > 0;
                let likelySubunit = false;
                if (hasNested) {
                    // If nested items contain more than one entry or any appear to be bulleted (strings with bullets),
                    // it's almost certainly a subunit block.
                    const nestedCount = c.items.length;
                    const nestedHasBullets = c.items.some(it => typeof it === 'string' && bulletRegex.test(it));
                    if (nestedCount > 1 || nestedHasBullets) likelySubunit = true;
                }
                if (!likelySubunit) {
                    // fallback: name similarity but require multiple quantity (>1) or exact name match
                    const num = parseInt(String(c.quantity || '').replace(/x/i, ''), 10) || 0;
                    const looksLikeSubunit = (childKey && unitKey && (childKey.includes(unitKey) || unitKey.includes(childKey)) && (num > 1 || childKey === unitKey));
                    likelySubunit = looksLikeSubunit;
                }

                if (likelySubunit) {
                    c.type = 'subunit';
                    c.items = c.items || [];
                    // Ensure anything under a subunit is wargear
                    for (const it of c.items) {
                        if (!it) continue;
                        if (typeof it === 'string') {
                            // coerce
                            const coerced = { quantity: '1x', name: String(it).trim(), items: [], type: 'wargear', nameshort: '' };
                            ensurePropsLocal(coerced, c.name);
                            // replace in place
                            const idx = c.items.indexOf(it);
                            if (idx >= 0) c.items[idx] = coerced;
                        } else {
                            it.type = 'wargear';
                            ensurePropsLocal(it, c.name);
                        }
                    }
                } else {
                    // Not a subunit: must be wargear (or special already handled)
                    c.type = c.type || 'wargear';
                    c.items = c.items || [];
                    // Normalize nested items to wargear as well
                    for (let j = 0; j < c.items.length; j++) {
                        const it = c.items[j];
                        if (!it) continue;
                        if (typeof it === 'string') {
                            const coerced = { quantity: '1x', name: String(it).trim(), items: [], type: 'wargear', nameshort: '' };
                            ensurePropsLocal(coerced, c.name);
                            c.items[j] = coerced;
                        } else {
                            it.type = 'wargear';
                            ensurePropsLocal(it, c.name);
                        }
                    }
                }
            }
        }
    } catch (e) {
        // non-fatal
    }

    // Normalize summary to canonical shape
    // Final strict enforcement pass to guarantee invariants:
    try {
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const unit of allTop) {
            if (!unit || typeof unit !== 'object') continue;
            unit.type = 'unit';
            unit.items = unit.items || [];
            for (let ci = 0; ci < unit.items.length; ci++) {
                const c = unit.items[ci];
                if (!c || typeof c !== 'object') continue;
                // Special allowed only at direct children of unit
                if (c.type === 'special' || /^Enhancement:/i.test(c.name || '') || normalizeForComparison(c.name || '') === 'warlord') {
                    c.type = 'special';
                    c.items = c.items || [];
                    // ensure specials don't have nested subunits; coerce nested into wargear
                    for (let k = 0; k < c.items.length; k++) {
                        const it = c.items[k];
                        if (!it) continue;
                        it.type = 'wargear';
                        ensurePropsLocal(it, c.name);
                    }
                    continue;
                }
                // If child looks like a subunit, enforce subunit rules
                if (c.type === 'subunit' || normalizeForComparison(c.name || '') === normalizeForComparison(unit.name || '')) {
                    c.type = 'subunit';
                    c.items = c.items || [];
                    // Everything under a subunit must be wargear
                    for (let k = 0; k < c.items.length; k++) {
                        const it = c.items[k];
                        if (!it) continue;
                        it.type = 'wargear';
                        ensurePropsLocal(it, c.name);
                    }
                    continue;
                }
                // Otherwise it's wargear; ensure nested items are wargear too
                c.type = 'wargear';
                c.items = c.items || [];
                for (let k = 0; k < c.items.length; k++) {
                    const it = c.items[k];
                    if (!it) continue;
                    it.type = 'wargear';
                    ensurePropsLocal(it, c.name);
                }
            }
        }
    } catch (e) {
        // non-fatal
    }

    // Cleanup pass: discard any wargear whose name exactly matches (case-insensitive)
    // either its top-level unit name or the subunit it's nested under.
    try {
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        const norm = s => normalizeForComparison(String(s||''));
        for (const unit of allTop) {
            if (!unit || typeof unit !== 'object') continue;
            const unitNorm = norm(unit.name);
            unit.items = (unit.items || []).filter(child => {
                if (!child || typeof child !== 'object') return true;
                // If a top-level wargear exactly matches the unit name, drop it
                if ((child.type === 'wargear' || normalizeForComparison(child.type||'') === 'wargear') && norm(child.name) === unitNorm) return false;
                return true;
            });

            // For subunits, remove nested wargear that exactly matches the subunit or top-level unit
            for (const child of unit.items) {
                if (!child || typeof child !== 'object') continue;
                if ((child.type === 'subunit' || normalizeForComparison(child.type||'') === 'subunit')) {
                    const subNorm = norm(child.name);
                    child.items = (child.items || []).filter(it => {
                        if (!it || typeof it !== 'object') return true;
                        if ((it.type === 'wargear' || normalizeForComparison(it.type||'') === 'wargear')) {
                            const itNorm = norm(it.name);
                            if (itNorm === subNorm || itNorm === unitNorm) return false;
                        }
                        return true;
                    });
                }
            }
        }
    } catch (e) {
        // non-fatal
    }
    // Sort items and nested items by descending numeric quantity (stable deterministic tie-break by name)
    try {
        const qtyNum = q => { if (!q) return 0; const m = String(q).match(/(\d+)/); return m ? parseInt(m[1],10) : 0; };
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const unit of allTop) {
            if (!unit || !Array.isArray(unit.items)) continue;
            unit.items.sort((a,b)=>{
                const aq = qtyNum(a && a.quantity); const bq = qtyNum(b && b.quantity);
                if (bq !== aq) return bq - aq;
                const an = String(a && a.name || '').toLowerCase(); const bn = String(b && b.name || '').toLowerCase();
                if (an < bn) return -1; if (an > bn) return 1; return 0;
            });
            for (const c of unit.items) {
                if (!c || !Array.isArray(c.items)) continue;
                c.items.sort((x,y)=>{
                    const xq = qtyNum(x && x.quantity); const yq = qtyNum(y && y.quantity);
                    if (yq !== xq) return yq - xq;
                    const xn = String(x && x.name || '').toLowerCase(); const yn = String(y && y.name || '').toLowerCase();
                    if (xn < yn) return -1; if (xn > yn) return 1; return 0;
                });
            }
        }
    } catch (e) {}
    normalizeSummary(result.SUMMARY);
    return result;
}
export function parseGwAppV2(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    const sectionHeaderRegex = /^(CHARACTERS|CHARACTER|BATTLELINE|OTHER DATASHEETS|ALLIED UNITS|DEDICATED TRANSPORTS)$/i;
    const firstSectionIndex = lines.findIndex(line => sectionHeaderRegex.test((line||'').trim().toUpperCase()));
    const headerLinesRaw = firstSectionIndex === -1 ? lines.slice(0, 0) : lines.slice(0, firstSectionIndex);
    let headerLines = headerLinesRaw.map(l => (l||'').trim()).filter(l => l && !l.startsWith('Exported with'));
    if (headerLines.length > 0) {
        result.SUMMARY.DETACHMENT = headerLines.pop().replace(/\s+/g, '\u00A0');
        if (headerLines.length > 0) {
            // Detect title (contains total points), game size (Strike Force, etc.), and faction line.
            const list = headerLines.slice();
            let listTitle = null;
            let gameSize = null;
            const factionCandidates = [];
            const pointsRe = /\(\s*\d+\s*points\s*\)/i;
            const gameSizeRe = /^(Combat Patrol|Incursion|Strike Force|Onslaught)/i;
            for (const ln of list) {
                if (pointsRe.test(ln) && !listTitle) {
                    listTitle = ln;
                    continue;
                }
                if (gameSizeRe.test(ln) || (pointsRe.test(ln) && gameSizeRe.test(ln))) {
                    gameSize = ln;
                    continue;
                }
                factionCandidates.push(ln);
            }

            const shortFaction = (factionCandidates.length > 0) ? factionCandidates[factionCandidates.length - 1].trim() : (listTitle || '').trim();
            const fullFaction = [listTitle, shortFaction, gameSize].filter(Boolean).join(' - ');

            const family = FAMILY_MAP[shortFaction] || FAMILY_MAP[fullFaction] || FAMILY_MAP[shortFaction.split('-').pop()?.trim()];
            result.SUMMARY.FACTION_KEYWORD = family ? `${family} - ${shortFaction}` : shortFaction;
            result.SUMMARY.DISPLAY_FACTION = fullFaction || shortFaction;
            if (listTitle) result.SUMMARY.LIST_TITLE = listTitle;
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
            const unit = { quantity, name: unitName, points: pts, items: [], nameshort: '' };
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
                // Treat both bulleted and indented non-bulleted lines the same: extract content
                const content = b ? b[1].trim() : t;
                if (!content) continue;
                if (/^Enhancement:/i.test(content)) {
                    parseAndAddEnhancement(content.replace(/^Enhancement:\s*/i, '').trim(), unit, result.SUMMARY.FACTION_KEYWORD || '');
                    continue;
                }
                // Only create a new subunit when this line is at the subunit indentation level
                // (i.e. no currentSubunit yet, or this line is not more indented than the current subunit)
                if (blockIsComplex && currentSection !== 'CHARACTER' && (currentSubunit === null || indent <= currentSubIndent)) {
                    // Determine if this line is a subunit header per strict GW App rules:
                    // - must be a bulleted (or otherwise matched) line
                    // - the very next line in the file (immediate, not skipping blanks) must be further indented
                    //   and must contain a bullet. If that is not true, this is not a subunit.
                    const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
                    const nextImmediate = (bi + 1 < blockLines.length) ? blockLines[bi + 1] : null;

                    const nextImmediateIsSubunitBody = (() => {
                        if (!nextImmediate) return false;
                        const nextIndent = getIndent(nextImmediate);
                        if (nextIndent <= indent) return false;
                        // The next immediate line must itself be a bulleted line
                        return bulletRegex.test(nextImmediate);
                    })();

                    if (subMatch && nextImmediateIsSubunitBody) {
                        const subQty = subMatch[1];
                        const subName = subMatch[2].trim();
                        const subunit = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                        unit.items = unit.items || [];
                        unit.items.push(subunit);
                        currentSubunit = subunit;
                        currentSubIndent = indent;
                        continue;
                    }
                    // Not a subunit header by strict rules; fall through to treat as wargear below
                }
                // If this line is deeper than the current subunit indent, attach it to the current subunit
                if (currentSubunit && indent > currentSubIndent) {
                    addItemToTarget(currentSubunit, content, currentSubunit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
                    continue;
                }
                // Otherwise, attach as wargear to the unit itself
                addItemToTarget(unit, content, unit.name, result.SUMMARY.FACTION_KEYWORD || '', 'wargear', 1);
                continue;
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
                    // unit considered non-aggregated; subunits were merged into top-level wargear
                } else {
                    const total = subunits.reduce((acc, it) => acc + (parseInt(String(it.quantity || '1x').replace(/x/i, ''), 10) || 0), 0);
                    if (total > 0) unit.quantity = `${total}x`;
                    // unit considered complex (has distinct subunits)
                }
            } else {
                // no subunits present
            }
        }
    }

    // Enforce strict typing rules for GW parse to match WTC expectations
    try {
        const normalize = s => normalizeForComparison(String(s||''));
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const unit of allTop) {
            if (!unit || typeof unit !== 'object') continue;
            unit.type = 'unit';
            unit.items = unit.items || [];
            const unitKey = normalize(unit.name).replace(/s$/,'');
            for (let i = 0; i < unit.items.length; i++) {
                const child = unit.items[i];
                if (!child) continue;
                if (typeof child === 'string') {
                    unit.items[i] = { quantity: '1x', name: child.trim(), items: [], type: 'wargear', nameshort: '' };
                    ensurePropsLocal(unit.items[i], unit.name);
                }
                const c = unit.items[i];
                const cNameNorm = normalize(c.name || '');
                if (cNameNorm === 'warlord' || /^enhancement:/i.test(c.name || '')) {
                    c.type = 'special';
                    continue;
                }
                const childKey = normalize(c.name || '').replace(/s$/,'');
                // Structural heuristic: prefer explicit structural evidence of subunitness.
                const hasNested = Array.isArray(c.items) && c.items.length > 0;
                let likelySubunit = false;
                if (hasNested) {
                    const nestedCount = c.items.length;
                    const nestedHasBullets = c.items.some(it => typeof it === 'string' && bulletRegex.test(it));
                    if (nestedCount > 1 || nestedHasBullets) likelySubunit = true;
                }
                if (!likelySubunit) {
                    // Fallback: name similarity but require multiple quantity (>1) or exact name match
                    const num = parseInt(String(c.quantity || '').replace(/x/i, ''), 10) || 0;
                    const looksLikeSubunit = (childKey && unitKey && (childKey.includes(unitKey) || unitKey.includes(childKey)) && (num > 1 || childKey === unitKey));
                    likelySubunit = looksLikeSubunit;
                }
                if (likelySubunit) {
                    c.type = 'subunit';
                    c.items = c.items || [];
                    for (let k = 0; k < c.items.length; k++) {
                        const it = c.items[k];
                        if (!it) continue;
                        if (typeof it === 'string') {
                            const coerced = { quantity: '1x', name: String(it).trim(), items: [], type: 'wargear', nameshort: '' };
                            ensurePropsLocal(coerced, c.name);
                            c.items[k] = coerced;
                        } else {
                            it.type = 'wargear';
                            ensurePropsLocal(it, c.name);
                        }
                    }
                } else {
                    c.type = c.type || 'wargear';
                    c.items = c.items || [];
                    for (let j = 0; j < c.items.length; j++) {
                        const it = c.items[j];
                        if (!it) continue;
                        if (typeof it === 'string') {
                            const coerced = { quantity: '1x', name: String(it).trim(), items: [], type: 'wargear', nameshort: '' };
                            ensurePropsLocal(coerced, c.name);
                            c.items[j] = coerced;
                        } else {
                            it.type = 'wargear';
                            ensurePropsLocal(it, c.name);
                        }
                    }
                }
            }
        }
    } catch (e) {
        // non-fatal
    }

    // Reorder CHARACTER entries: GW App places the unit containing the 'Warlord'
    // marker first, then the remaining characters in alphabetical order.
    try {
        if (Array.isArray(result.CHARACTER) && result.CHARACTER.length > 0) {
            const chars = result.CHARACTER.slice();
            // Prefer header WARLORD reference like 'Char2: Daemon Prince of Khorne'
            let warlordUnit = null;
            const rawW = result.SUMMARY && result.SUMMARY._WARLORD_RAW ? String(result.SUMMARY._WARLORD_RAW) : '';
            const m = rawW.match(/(Char\d+)/i);
            if (m) {
                const cid = m[1].toUpperCase();
                const idx = chars.findIndex(u => u._charId && u._charId.toUpperCase() === cid);
                if (idx >= 0) warlordUnit = chars.splice(idx, 1)[0];
            }
            // Fallback: find a unit which has an item named 'Warlord'
            if (!warlordUnit) {
                const warlordIdx = chars.findIndex(u => Array.isArray(u.items) && u.items.some(it => it && normalizeForComparison(it.name || '') === 'warlord'));
                if (warlordIdx >= 0) warlordUnit = chars.splice(warlordIdx, 1)[0];
            }
            chars.sort((a, b) => {
                const an = normalizeForComparison(a && a.name || '');
                const bn = normalizeForComparison(b && b.name || '');
                if (an < bn) return -1;
                if (an > bn) return 1;
                return 0;
            });
            if (warlordUnit) chars.unshift(warlordUnit);
            // remove internal marker
            for (const c of chars) delete c._charId;
            if (result.SUMMARY) delete result.SUMMARY._WARLORD_RAW;
            result.CHARACTER = chars;
        }
    } catch (e) {
        // non-fatal ordering failure; keep original order
    }

    // --- Synthesize header summary fields from parsed content ---
    try {
        // TOTAL_ARMY_POINTS: try to extract from LIST_TITLE if present (e.g. 'Chainblades go BRRRR (1995 points)')
        if (result.SUMMARY && result.SUMMARY.LIST_TITLE) {
            const m = String(result.SUMMARY.LIST_TITLE).match(/\((\s*\d+\s*)points\)/i) || String(result.SUMMARY.LIST_TITLE).match(/\((\s*\d+\s*)points\)/i);
            const m2 = String(result.SUMMARY.LIST_TITLE).match(/\((\s*\d+\s*)points\)/i);
            const ptsMatch = m2 || m;
            if (ptsMatch) {
                const num = ptsMatch[1].replace(/\s+/g, '');
                result.SUMMARY.TOTAL_ARMY_POINTS = `${num}pts`;
            }
        }

    // (Intentionally do not synthesize WARLORD or ENHANCEMENT summary fields)

        // NUMBER_OF_UNITS: count items in CHARACTER + OTHER DATASHEETS
        const totalUnits = (Array.isArray(result.CHARACTER)?result.CHARACTER.length:0) + (Array.isArray(result['OTHER DATASHEETS'])?result['OTHER DATASHEETS'].length:0);
        result.SUMMARY.NUMBER_OF_UNITS = String(totalUnits);
    } catch (e) {
        // non-fatal
    }

    // Sort items and nested items by descending numeric quantity (stable deterministic tie-break by name)
    try {
        const qtyNum = q => { if (!q) return 0; const m = String(q).match(/(\d+)/); return m ? parseInt(m[1],10) : 0; };
        const allTop = [...(result.CHARACTER||[]), ...(result['OTHER DATASHEETS']||[])];
        for (const unit of allTop) {
            if (!unit || !Array.isArray(unit.items)) continue;
            unit.items.sort((a,b)=>{
                const aq = qtyNum(a && a.quantity); const bq = qtyNum(b && b.quantity);
                if (bq !== aq) return bq - aq;
                const an = String(a && a.name || '').toLowerCase(); const bn = String(b && b.name || '').toLowerCase();
                if (an < bn) return -1; if (an > bn) return 1; return 0;
            });
            for (const c of unit.items) {
                if (!c || !Array.isArray(c.items)) continue;
                c.items.sort((x,y)=>{
                    const xq = qtyNum(x && x.quantity); const yq = qtyNum(y && y.quantity);
                    if (yq !== xq) return yq - xq;
                    const xn = String(x && x.name || '').toLowerCase(); const yn = String(y && y.name || '').toLowerCase();
                    if (xn < yn) return -1; if (xn > yn) return 1; return 0;
                });
            }
        }
    } catch (e) {}

    // Normalize the summary so GWApp and WTC produce the same canonical keys/types
    normalizeSummary(result.SUMMARY);
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
