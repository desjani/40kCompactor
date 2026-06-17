import { standardizeSummary } from '../summary.js';
import { parseItemString, normalizeForComparison, sortItemsByQuantityThenName } from '../utils.js';

// NRNR parser: initial header parsing implementation. This extracts the
// document title / display faction line, bracketed total points, and
// common header fields like Detachment and TOTAL ARMY POINTS.
export function parseNrNr(lines) {
    const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
    if (!Array.isArray(lines)) return result;

    const firstNonEmpty = lines.map(l => String(l || '')).find(l => l.trim());
    const firstNonEmptyIndex = lines.findIndex(l => String(l || '').trim());
    if (firstNonEmpty) {
        // First line format: FACTIONFAMILY - FACTION_KEYWORD - LIST_TITLE - [TOTAL_ARMY_POINTS]
        // Example: "Xenos - T'au Empire - Big Suits To Fill - [2070 pts]"
        const parts = firstNonEmpty.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
        // assign conservative defaults
        result.SUMMARY.FACTION_FAMILY = parts[0] || '';
        result.SUMMARY.FACTION_KEYWORD = parts[1] || '';
        // LIST_TITLE may itself contain hyphens; if more than 3 parts, join middle parts except the last bracket
        if (parts.length >= 3) {
            // The last part may include the bracketed pts; strip it out
            const last = parts[parts.length - 1];
            const mPts = last.match(/\[\s*(\d{2,5})\s*pts?\s*\]$/i);
            if (mPts) {
                result.SUMMARY.TOTAL_ARMY_POINTS = `${mPts[1]}pts`;
                // LIST_TITLE is everything between part[2] .. parts[-2]
                if (parts.length === 3) result.SUMMARY.LIST_TITLE = parts[2];
                else result.SUMMARY.LIST_TITLE = parts.slice(2, parts.length - 1).join(' - ');
            } else {
                // no bracketed pts found; assume last part is list title
                result.SUMMARY.LIST_TITLE = parts.slice(2).join(' - ');
            }
        }
        // Also set DISPLAY_FACTION as original first line for compatibility
        result.SUMMARY.DISPLAY_FACTION = firstNonEmpty.trim();
    }

    // Scan header-ish lines for Detachment, Battle Size, FACTION KEYWORD, TOTAL ARMY POINTS
    for (let i = 0; i < Math.min(lines.length, 40); i++) {
        const raw = String(lines[i] || '').trim();
        if (!raw) continue;
        const det = raw.match(/^Detachment:\s*(.*)$/i);
        if (det) result.SUMMARY.DETACHMENT = det[1].trim();
        const total = raw.match(/^TOTAL ARMY POINTS:\s*(.*)$/i);
        if (total) result.SUMMARY.TOTAL_ARMY_POINTS = total[1].trim();
        const fk = raw.match(/^FACTION KEYWORD:\s*(.*)$/i);
        if (fk) result.SUMMARY.FACTION_KEYWORD = fk[1].trim();
        // Battle Size line may contain an indicative string
        const bs = raw.match(/^Battle Size:\s*(.*)$/i);
        if (bs) result.SUMMARY.BATTLE_SIZE = bs[1].trim();
        // LIST_TITLE-like heading: lines that look like markdown headings with pts
        const titleLike = raw.match(/^#+\s*(?:\+{1,2}\s*)?(.*)\[\s*\d{2,5}\s*pts?\s*\]$/i);
        if (titleLike && !result.SUMMARY.LIST_TITLE) {
            const lt = titleLike[1].trim();
            // If it's the generic Army Roster header (often +++ markers), prefer empty LIST_TITLE to match canonical output
            if (/Army\s+Roster/i.test(lt) || /\+\+/.test(lt)) result.SUMMARY.LIST_TITLE = '';
            else result.SUMMARY.LIST_TITLE = lt;
        }
    }

    // Heuristic: if FACTION_KEYWORD not set, attempt to infer from DISPLAY_FACTION
    if (!result.SUMMARY.FACTION_KEYWORD && result.SUMMARY.DISPLAY_FACTION) {
        const parts = result.SUMMARY.DISPLAY_FACTION.split(' - ');
        if (parts.length >= 2) {
            // Usually the last part before bracketed pts is the list title; take the second part as faction
            result.SUMMARY.FACTION_KEYWORD = parts[1].trim();
        } else {
            // fallback: take first token sequence before bracket
            result.SUMMARY.FACTION_KEYWORD = result.SUMMARY.DISPLAY_FACTION.replace(/\s*\[.*$/,'').trim();
        }
    }

    // Body parsing: sections and unit lines (simple markdown-style NRNR)
    const sectionHeaderRe = /^##\s*(.+?)\s*(?:\[\s*\d+\s*pts?\s*\])?$/i;
    const unitLineRe = /^(?:(\d+)x?\s+)?(.+?)\s*\[\s*(\d{1,4})\s*pts?\s*\]\s*(?::\s*(.*))?$/i;
    const bulletRe = /^\s*(?:•|\-|\+)\s*(.*)$/;

    let currentSection = null;
    let currentUnit = null;
    for (let i = 0; i < lines.length; i++) {
        const raw = String(lines[i] || '');
        const t = raw.trim();
        if (!t) continue;
        // skip the very first non-empty title line (we already parsed it into SUMMARY)
        if (i === firstNonEmptyIndex) continue;
        // If this is any markdown heading (# or ##), treat as header only and do not parse as a unit line
        if (t.startsWith('#')) {
            const sh = t.match(/^#+\s*(.+?)\s*(?:\[\s*\d+\s*pts?\s*\])?$/i);
            if (sh) {
                const title = sh[1].trim();
                if (/character|epic|hero|hq/i.test(title)) currentSection = 'CHARACTER';
                else currentSection = 'OTHER DATASHEETS';
            }
            continue;
        }

        // Unit lines at section level
        const um = t.match(unitLineRe);
        if (um) {
            const qty = um[1] ? `${um[1]}x` : '1x';
            const name = (um[2] || '').trim();
            const pts = parseInt(um[3], 10) || 0;
            const inline = um[4] || '';
            const unit = { quantity: qty, name, points: pts, items: [], isComplex: false, nameshort: '' };
            if (!currentSection) currentSection = 'OTHER DATASHEETS';
            result[currentSection] = result[currentSection] || [];
            result[currentSection].push(unit);
            currentUnit = unit;
            if (inline) {
                inline.split(',').map(s => s.trim()).filter(Boolean).forEach(it => {
                    addItemToTarget(currentUnit, it, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
                });
            }
            continue;
        }

        // Bullet lines: subunits or items
        const bm = raw.match(bulletRe);
        if (bm && currentUnit) {
            const content = bm[1].trim();
            // handle 'N with X, Y' style
            const withMatch = content.match(/^(\d+)\s+with\s+(.*)$/i);
            if (withMatch && currentUnit) {
                const n = parseInt(withMatch[1], 10) || 1;
                const rest = withMatch[2];
                const target = (currentUnit.items && currentUnit.items.length > 0) ? currentUnit.items[currentUnit.items.length - 1] : currentUnit;
                rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(target, `${n}x ${it}`, target.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
                continue;
            }

            // subunit with colon: '1x Stealth Shas'vre: ...'
            const subColon = content.match(/^(\d+x?)\s+([^:]+):\s*(.*)$/i);
            if (subColon) {
                const subQty = subColon[1];
                let subName = subColon[2].trim();
                const rest = subColon[3] || '';
                // If subName contains ' w/ ...' drop the w/ part (redundant with the post-colon list)
                subName = subName.replace(/\s+w\/.*$/i, '').trim();
                const sub = { quantity: subQty, name: subName, items: [], type: 'subunit' };
                // populate sub.items from the rest
                if (rest) {
                    const withInline = rest.match(/^(\d+)\s+with\s+(.*)$/i);
                    if (withInline) {
                        const n = parseInt(withInline[1], 10) || 1;
                        const list = withInline[2];
                        list.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(sub, `${n}x ${it}`, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
                    } else {
                        rest.split(',').map(s => s.trim()).filter(Boolean).forEach(it => addItemToTarget(sub, it, sub.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true));
                    }
                }
                currentUnit.items = currentUnit.items || [];
                // keep subunit as-is (do not flatten into parent)
                currentUnit.items.push(sub);
                continue;
            }

            const subMatch = content.match(/^(\d+x?)\s+(.*)$/i);
            if (subMatch && currentUnit) {
                // Normalize subunit name by trimming any trailing " w/ ..." to avoid
                // creating distinct entries for the same subunit (e.g., "Jakhal w/ X").
                let subName = subMatch[2].trim();
                subName = subName.replace(/\s+w\/.*$/i, '').trim();
                const sub = { quantity: subMatch[1], name: subName, items: [], type: 'subunit' };
                currentUnit.items = currentUnit.items || [];
                currentUnit.items.push(sub);
                continue;
            }

            // fallback: add item to current unit
            addItemToTarget(currentUnit, content, currentUnit.name, result.SUMMARY.FACTION_KEYWORD || '', currentUnit.name, true);
            continue;
        }
    }

    // Add item helper (modeled after wtc_compact.addItemToTarget)
    function addItemToTarget(target, itemString, unitContextName, factionKeyword, unitTopName = '', skipIfMatchesUnitName = false, itemType = 'wargear') {
        if (!target) return;
        target.items = target.items || [];
        const raw = String(itemString || '').trim();
        const parsed = parseItemString(raw);
        const qtyToken = parsed.quantity ? String(parsed.quantity) : '1x';
        const hasExplicitQty = /^\s*\d+x?\s+/i.test(raw);
        let name = parsed.name || '';
        // Prefer inner parenthetical for Drone items: 'Missile Drone (Missile pod)' -> 'Missile pod'
        const mParen = name.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (mParen) {
            const outer = (mParen[1] || '').trim();
            const inner = (mParen[2] || '').trim();
            if (/\bDrone\b/i.test(outer) || /\bDrone\b/i.test(name)) {
                name = inner;
            }
        }
        const key = normalizeForComparison(name);
        if (skipIfMatchesUnitName) {
            const ctx = String(unitContextName || '');
            const top = String(unitTopName || '');
            if (normalizeForComparison(ctx) === normalizeForComparison(name) || (top && normalizeForComparison(top) === normalizeForComparison(name))) {
                return;
            }
        }
        // Calculate effective quantity: for subunits, default to the subunit's
        // quantity when no explicit quantity was provided on the item; when an
        // explicit quantity is present, use that number directly (do not multiply).
        const baseQty = parseInt(String(qtyToken || '1x').replace(/x/i, ''), 10) || 1;
        let effectiveQty = baseQty;
        if (target && target.type === 'subunit') {
            const parentQty = parseInt(String(target.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 1;
            effectiveQty = hasExplicitQty ? baseQty : parentQty;
        }
        const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
        if (existing) {
            const exQ = parseInt(String(existing.quantity || '1x').replace(/x/i, ''), 10) || 0;
            existing.quantity = `${exQ + effectiveQty}x`;
        } else {
            const forcedType = (normalizeForComparison(name) === 'warlord') ? 'special' : itemType;
            target.items.push({ quantity: `${effectiveQty}x`, name: name, items: [], type: forcedType, nameshort: '' });
        }
    }

    // parseAndAddEnhancement (header-style) — left for compatibility though NRNR rarely uses these markers
    function parseAndAddEnhancement(content, target) {
        if (!content || !target) return;
        target.items = target.items || [];
        const raw = content.trim();
        const mPts = raw.match(/\(([^)]+)\)$/);
        const pts = mPts ? ` (${mPts[1]})` : '';
        const base = raw.replace(/\s*\([^)]+\)$/, '').trim();
        const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
        const nameshort = `E: ${abbr}${pts}`.trim();
        const item = { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
        target.items.push(item);
    }

    // Helper to add parsed item strings into target.items with quantity/name merging
    function addParsedItemToTarget(target, itemStr) {
        if (!target) return;
        target.items = target.items || [];
        const parsed = parseItemString(itemStr || '');
        const q = parsed.quantity || '1x';
        const name = parsed.name || '';
        const key = normalizeForComparison(name);
        const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
        if (existing) {
            const exQ = parseInt(String(existing.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
            const addQ = parseInt(String(q || '1x').replace(/[^0-9]/g, ''), 10) || 0;
            existing.quantity = `${exQ + addQ}x`;
        } else {
            // Generic heuristics to detect enhancements without a whitelist:
            // - If the raw name contains 'Enhancement' or 'Enhance'
            // - If it contains 'Prototype' or 'Internal' or 'Starflare' (common enhancement-like tokens)
            // - If it ends with a parenthetical that looks like points, e.g. '(+20 pts)' or '(+15 pts)'
            // - If it is exactly 'Warlord' (keep this special-case for backwards compatibility)
            // Only use generic signals (no static whitelist): explicit 'Enhancement' token,
            // a trailing parenthetical with points like '(+20 pts)', or exact 'Warlord'.
            const looksLikeEnhancement = /\bEnhanc|\bEnhance/i.test(name)
                || /\(\s*\+?\d+\s*pts?\s*\)$/i.test(name)
                || /^\s*Warlord\s*$/i.test(name);
            if (looksLikeEnhancement) {
                // Build a compact nameshort from initials, and include parenthetical pts if present
                const ptsMatch = name.match(/\(\s*([^)]*pts?[^)]*)\)$/i);
                const ptsSuffix = ptsMatch ? ` (${ptsMatch[1].trim()})` : '';
                const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('').slice(0,4);
                const nameshort = `E: ${abbr}${ptsSuffix}`.trim();
                target.items.push({ quantity: q, name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' });
            } else {
                target.items.push({ quantity: q, name, items: [], type: 'wargear', nameshort: '' });
            }
        }
    }

    // Aggregate subunits with identical names within each unit (after trimming 'w/ ...').
    // Merge their quantities and combine/dedupe their items like other parsers.
    for (const sec of ['CHARACTER', 'OTHER DATASHEETS']) {
        if (!Array.isArray(result[sec])) continue;
        for (const u of result[sec]) {
            if (!u || !Array.isArray(u.items) || u.items.length === 0) continue;
            const subs = u.items.filter(it => it && it.type === 'subunit');
            if (subs.length > 1) {
                const byName = new Map();
                const remainder = [];
                for (const it of u.items) {
                    if (!it || it.type !== 'subunit') { remainder.push(it); continue; }
                    const key = normalizeForComparison(it.name || '');
                    if (!byName.has(key)) {
                        // clone subunit shallowly
                        byName.set(key, { quantity: it.quantity || '1x', name: it.name, items: Array.isArray(it.items) ? it.items.slice() : [], type: 'subunit' });
                    } else {
                        const agg = byName.get(key);
                        const aq = parseInt(String(agg.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
                        const bq = parseInt(String(it.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
                        agg.quantity = `${aq + bq}x`;
                        // merge items by normalized name, summing quantities
                        const itemMap = new Map();
                        for (const x of agg.items || []) {
                            const k = normalizeForComparison(x && x.name || '');
                            if (!k) continue;
                            itemMap.set(k, { quantity: x.quantity || '1x', name: x.name, items: [], type: x.type || 'wargear', nameshort: x.nameshort || '' });
                        }
                        for (const x of (it.items || [])) {
                            const k = normalizeForComparison(x && x.name || '');
                            if (!k) continue;
                            if (itemMap.has(k)) {
                                const ex = itemMap.get(k);
                                const exq = parseInt(String(ex.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
                                const addq = parseInt(String(x.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
                                ex.quantity = `${exq + addq}x`;
                            } else {
                                itemMap.set(k, { quantity: x.quantity || '1x', name: x.name, items: [], type: x.type || 'wargear', nameshort: x.nameshort || '' });
                            }
                        }
                        agg.items = Array.from(itemMap.values());
                    }
                }
                u.items = [...remainder, ...Array.from(byName.values())];
            }
            // Normalize ordering for items and subunits
            if (u && Array.isArray(u.items) && u.items.length > 0) sortItemsByQuantityThenName(u.items);
            const aggSubs = (u && Array.isArray(u.items)) ? u.items.filter(it => it && it.type === 'subunit') : [];
            for (const su of aggSubs) if (su && Array.isArray(su.items) && su.items.length > 0) sortItemsByQuantityThenName(su.items);
        }
    }

    standardizeSummary(result);
    return result;
}

