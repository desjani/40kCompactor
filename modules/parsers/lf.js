import { getIndent, normalizeForComparison, parseItemString, sortItemsByQuantityThenName } from '../utils.js';
import { standardizeSummary } from '../summary.js';

function toQtyTokenMaybe(line) {
  const m = String(line || '').trim().match(/^(\d+)\s+(.*)$/);
  if (m && !/^\d+x\b/i.test(String(line || ''))) return `${m[1]}x ${m[2]}`;
  return line;
}

function parseEnhancement(content) {
  const raw = String(content || '').trim().replace(/^E:\s*/i, '').replace(/^Enhancement:\s*/i, '').trim();
  const ptsMatch = raw.match(/\(([^)]*pts?[^)]*)\)\s*$/i);
  const base = raw.replace(/\s*\([^)]*\)\s*$/,'').trim();
  const abbr = base.split(/\s+/).map(w => w[0] ? w[0].toUpperCase() : '').join('');
  const nameshort = `E: ${abbr}${ptsMatch ? ` (${ptsMatch[1].trim()})` : ''}`.trim();
  return { quantity: '1x', name: `Enhancement: ${base}`, nameshort, items: [], type: 'special' };
}

function addItemToTarget(target, itemStr) {
  if (!target) return;
  target.items = target.items || [];
  const normalized = toQtyTokenMaybe(String(itemStr || '').trim());
  // enhancements inline (E: or Enhancement:)
  if (/^(E:|Enhancement:)/i.test(normalized)) {
    const enh = parseEnhancement(normalized);
    // skip duplicate enhancement names
    const normBase = normalizeForComparison(enh.name.replace(/^Enhancement:\s*/i, ''));
    const exists = (target.items || []).some(it => /^Enhancement:/i.test(it.name || '') && normalizeForComparison(String(it.name).replace(/^Enhancement:\s*/i, '').replace(/\s*\([^)]*\)\s*$/,'')) === normBase);
    if (!exists) target.items.push(enh);
    return;
  }
  // treat 'with' lists naïvely: split on commas after removing leading 'with'
  const parts = normalized.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const parsed = parseItemString(part.replace(/^with\s+/i, ''));
    const qty = parsed.quantity || '1x';
    const name = parsed.name || '';
    if (!name) continue;
    const key = normalizeForComparison(name);
    const existing = target.items.find(it => normalizeForComparison(it.name || '') === key);
    if (existing) {
      const ex = parseInt(String(existing.quantity || '1x').replace(/[^0-9]/g, ''), 10) || 0;
      const add = parseInt(String(qty || '1x').replace(/[^0-9]/g, ''), 10) || 0;
      existing.quantity = `${ex + add}x`;
    } else {
      target.items.push({ quantity: qty, name, items: [], type: 'wargear', nameshort: '' });
    }
  }
}

function shouldTreatAsSubunitHeader(lines, idx) {
  const line = lines[idx] || '';
  const indent = getIndent(line);
  // Peek next non-empty line; if more indented and bulleted, consider header
  for (let j = idx + 1; j < lines.length; j++) {
    const n = lines[j] || '';
    if (!n.trim()) continue;
    const ni = getIndent(n);
    const isBullet = /^\s*•\s*/.test(n);
    return ni > indent && isBullet;
  }
  return false;
}

export function parseLf(lines) {
  const result = { SUMMARY: {}, CHARACTER: [], 'OTHER DATASHEETS': [] };
  if (!Array.isArray(lines)) return result;

  // Header parsing: support two variants
  const head = lines.slice(0, 30).map(l => String(l || ''));
  // Variant A: key: value
  let foundAnyKey = false;
  for (const h of head) {
    const m = h.match(/^\s*([A-Za-z ][A-Za-z ]*):\s*(.*)$/);
    if (!m) continue;
    const k = m[1].trim().toLowerCase();
    const v = m[2].trim();
    if (k === 'list name') { result.SUMMARY.LIST_TITLE = v; foundAnyKey = true; }
    if (k === 'factions used') { result.SUMMARY.FACTION_KEYWORD = v; foundAnyKey = true; }
    if (k === 'army points') { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); if (n) { result.SUMMARY.TOTAL_ARMY_POINTS = `${n}pts`; foundAnyKey = true; } }
    if (k === 'detachment rule') { result.SUMMARY.DETACHMENT = v; foundAnyKey = true; }
  }
  // Variant B: single title line "Title - Faction - Detachment (NNNN Points)"
  if (!foundAnyKey) {
    const firstNonEmpty = lines.find(l => String(l || '').trim());
    if (firstNonEmpty) {
      const m = String(firstNonEmpty).match(/^(.*?)\s*-\s*(.*?)\s*-\s*(.*?)\s*\((\d+)\s*Points?\)/i);
      if (m) {
        result.SUMMARY.LIST_TITLE = m[1].trim();
        result.SUMMARY.FACTION_KEYWORD = m[2].trim();
        result.SUMMARY.DETACHMENT = m[3].trim();
        result.SUMMARY.TOTAL_ARMY_POINTS = `${parseInt(m[4], 10)}pts`;
      }
    }
  }

  // Body parsing
  const sectionHeaderRe = /^\s*([A-Za-z ]+):\s*$/;
  const unitLineRe = /^\s*(.*?)\s*\((\d+)\s*pts?\)\s*$/i;
  const bulletRe = /^\s*•\s*(.*)$/;

  let currentSection = null; // 'CHARACTER' | 'OTHER DATASHEETS'
  const stack = []; // [{ indent, node }]

  for (let i = 0; i < lines.length; i++) {
    const raw = String(lines[i] || '');
    const t = raw.trim();
    if (!t) continue;

    // Section header
    const sh = raw.match(sectionHeaderRe);
    if (sh) {
      const title = sh[1].trim().toLowerCase();
      currentSection = (/hero|character/.test(title)) ? 'CHARACTER' : 'OTHER DATASHEETS';
      stack.length = 0;
      continue;
    }

    // Unit line
    const um = raw.match(unitLineRe);
    if (um && getIndent(raw) === 0) {
      const name = um[1].trim();
      const pts = parseInt(um[2], 10) || 0;
      const unit = { quantity: '1x', name, points: pts, items: [], isComplex: false, nameshort: '' };
      const sec = currentSection === 'CHARACTER' ? 'CHARACTER' : 'OTHER DATASHEETS';
      result[sec] = result[sec] || [];
      result[sec].push(unit);
      stack.length = 0;
      stack.push({ indent: 0, node: unit });
      continue;
    }

    // Bullets and nested content under current unit/subunit
    const bm = raw.match(bulletRe);
    if (!bm) continue;
    const contentRaw = bm[1].trim();
    const indent = getIndent(raw);
    // Maintain stack parentage
    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
    if (!parent) continue;

    // Ignore block labels like 'B:'
    if (/^B:\s*/i.test(contentRaw)) {
      // Do not create a node for B:; children will attach to the same parent
      continue;
    }

    // Enhancement line directly
    if (/^(E:|Enhancement:)/i.test(contentRaw)) {
      const enh = parseEnhancement(contentRaw);
      // Add enhancement to the top-level unit (first stack element)
      const top = stack[0] ? stack[0].node : parent;
      top.items = top.items || [];
      const exists = (top.items || []).some(it => /^Enhancement:/i.test(it.name || '') && normalizeForComparison(it.name) === normalizeForComparison(enh.name));
      if (!exists) top.items.push(enh);
      continue;
    }

    const isHeader = shouldTreatAsSubunitHeader(lines, i);
    if (isHeader) {
      const parsed = parseItemString(toQtyTokenMaybe(contentRaw));
      let subName = parsed.name || '';
      // Trim trailing ' w/ ...' from subunit name
      subName = subName.replace(/\s+w\/.*$/i, '').trim();
      const sub = { quantity: parsed.quantity || '1x', name: subName, items: [], type: 'subunit' };
      parent.items = parent.items || [];
      parent.items.push(sub);
      stack.push({ indent, node: sub });
      continue;
    }

    // Otherwise treat as wargear for current context
    addItemToTarget(parent, contentRaw);
  }

  // Aggregate subunits with identical names within each unit (sum quantities and merge wargear)
  function qtyToInt(q) {
    const n = parseInt(String(q || '1x').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  for (const sec of ['CHARACTER', 'OTHER DATASHEETS']) {
    const units = result[sec] || [];
    for (const u of units) {
      const items = Array.isArray(u.items) ? u.items : [];
      const subunits = items.filter(it => it && it.type === 'subunit');
      if (subunits.length <= 1) continue;
      const groups = new Map();
      for (const su of subunits) {
        const key = normalizeForComparison((su.name || '').replace(/\s+w\/.*/i, '').trim());
        if (!groups.has(key)) {
          groups.set(key, { name: su.name, qty: 0, wargear: new Map() });
        }
        const g = groups.get(key);
        g.qty += qtyToInt(su.quantity);
        const wItems = Array.isArray(su.items) ? su.items : [];
        for (const wi of wItems) {
          const wkey = normalizeForComparison(wi.name || '');
          const prev = g.wargear.get(wkey) || { name: wi.name, qty: 0, type: wi.type || 'wargear' };
          prev.qty += qtyToInt(wi.quantity);
          // Preserve canonical casing/name from earliest occurrence
          if (!g.wargear.has(wkey)) g.wargear.set(wkey, prev);
          else g.wargear.set(wkey, prev);
        }
      }
      // Rebuild subunits: remove old subunits, append aggregated ones
      const nonSubs = items.filter(it => !(it && it.type === 'subunit'));
      const aggSubs = [];
      for (const [, g] of groups) {
        const sub = { quantity: `${g.qty}x`, name: g.name, items: [], type: 'subunit' };
        for (const [, w] of g.wargear) {
          sub.items.push({ quantity: `${w.qty}x`, name: w.name, items: [], type: w.type || 'wargear', nameshort: '' });
        }
        aggSubs.push(sub);
      }
      u.items = [...nonSubs, ...aggSubs];
    }
  }

  // Trim Faction Key from the beginnings of unit and subunit names (LF only)
  const factionKey = (result.SUMMARY && result.SUMMARY.FACTION_KEYWORD) ? String(result.SUMMARY.FACTION_KEYWORD).trim() : '';
  function trimFactionPrefix(name) {
    if (!name || !factionKey) return name;
    const re = new RegExp('^' + factionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
    return String(name).replace(re, '').trim();
  }
  if (factionKey) {
    for (const sec of ['CHARACTER', 'OTHER DATASHEETS']) {
      const units = result[sec] || [];
      for (const u of units) {
        u.name = trimFactionPrefix(u.name);
        const subs = (u.items || []).filter(it => it && it.type === 'subunit');
        for (const su of subs) su.name = trimFactionPrefix(su.name);
      }
    }
  }

  // Sort items in a deterministic way
  for (const sec of ['CHARACTER', 'OTHER DATASHEETS']) {
    const arr = result[sec] || [];
    for (const u of arr) {
      if (Array.isArray(u.items) && u.items.length > 0) sortItemsByQuantityThenName(u.items);
      const subs = (u.items || []).filter(it => it && it.type === 'subunit');
      for (const su of subs) if (Array.isArray(su.items) && su.items.length > 0) sortItemsByQuantityThenName(su.items);
    }
  }

  standardizeSummary(result);
  return result;
}

export default { parseLf };
