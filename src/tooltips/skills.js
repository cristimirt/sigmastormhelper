import { SSH } from '../core/constants.js';
import { DATA } from '../core/data.js';
import { store } from '../core/storage.js';

export const skillInfo = (id) => store.get('skills', {})[id] || DATA.skills[id] || null;

let skillNames = null;

export function skillByName(name) {
  const k = String(name || '').trim().toLowerCase();
  if (!k) return null;
  if (!skillNames) {
    skillNames = new Map();
    Object.values(DATA.skills).forEach((s) => skillNames.set(s.n.toLowerCase(), s));
    Object.keys(DATA.extra).forEach((n) => skillNames.set(n, DATA.extra[n]));
  }
  return skillNames.get(k) || Object.values(store.get('skills', {})).find((s) => s.n.toLowerCase() === k) || null;
}

// The panel of a skill page: name, description, and the cost / duration lines.
function parseSkill(doc) {
  const tabs = [...doc.querySelectorAll('table[width="140"]')].filter((x) => x.rows.length && x.textContent.length < 900 && !/function|menuOpen|skillBoxData/.test(x.textContent));
  // the panel with a cost / duration line; passive skills only have the description and "Passive Skill"
  const t = tabs.find((x) => /Duration:|Energy:|Surge:/.test(x.textContent)) || tabs.find((x) => /Passive Skill/.test(x.textContent));
  if (!t) return null;
  const outer = t.parentElement && t.parentElement.closest('table');
  const nm = outer && outer.querySelector('b');
  // the server writes its en dash as a broken character ("2 � 4")
  const clean = (s) => String(s).replace(/ /g, ' ').replace(/�/g, '–').replace(/\s+/g, ' ').trim();
  const x = [];
  [...t.rows].forEach((r) => {
    if (r.cells.length !== 2) return;
    const k = clean(r.cells[0].textContent);
    const v = clean(r.cells[1].textContent);
    if (/:$/.test(k) && v) x.push(k + ' ' + v);
  });
  const d = clean(t.rows[0].textContent);
  return nm && d ? { n: clean(nm.textContent), d, x } : null;
}

export async function loadSkill(id) {
  const html = await (await fetch('index.php?cmd=skills&tree_id=0&skill_id=' + id, { credentials: 'same-origin' })).text();
  const s = parseSkill(new DOMParser().parseFromString(html, 'text/html'));
  if (s) { const l = store.get('skills', {}); l[id] = s; store.set('skills', l); }
  return s;
}

// "+0.2% Base Attack per point." at level 10 -> "+2% Base Attack."; "0.1% per point of the items level" -> "1% of the items level".
export function scaleDesc(desc, level) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // "50% (+0.25% per point) chance": a base value plus a bonus per point
  const base = (s) => s.replace(/(\d+(?:\.\d+)?)%\s*\(\s*\+\s*(\d+(?:\.\d+)?)%\s*per point\s*\)/gi, (m, b, p) => '<b>' + Math.round((parseFloat(b) + parseFloat(p) * level) * 100) / 100 + '</b>%');
  return base(esc(desc)).replace(/([+-]?)(\d+(?:\.\d+)?)(\s*%?)((?:(?!per point)[^.;\d])*?)\s*\bper point\b/gi, (m, sign, num, pct, words) => {
    const v = Math.round(parseFloat(num) * level * 100) / 100;
    return sign + '<b>' + v + '</b>' + pct.trim() + words;
  });
}

SSH.skills = { parseSkill, scaleDesc, skillInfo, loadSkill };
