// Gear comparing: the tooltip of an item that is not worn is shown next to the tooltip of the worn item of the same kind
// (Weapon, Helmet, Weapon Add-On, ...), and its numbers are coloured and followed by the difference, e.g. "+27 (+13)".
// Item data is the game's own fetchitem.php answer.
const GROUPS = ['Bonuses', 'Enhancements', 'Resistances'];
const UP = '#7fe08a';
const DOWN = '#ff6b5a';

// An item answer as data: { name, type, stats: { Bonuses: { Attack: 27, ... }, ... }, rows, last, doc }. `rows` are the table
// rows of each number and `last` the row new numbers go after. Only the three stat tables are read, so the set bonuses and the
// requirements further down do not count.
export function parseItem(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const b = d.querySelector('b');
  const ty = d.querySelector('font[color="yellow" i]');
  const it = { name: b ? b.textContent.trim() : '', type: ty ? ty.textContent.trim() : '', stats: {}, rows: {}, last: {}, none: {}, doc: d };
  d.querySelectorAll('td').forEach((td) => {
    const g = td.textContent.trim();
    if (!GROUPS.includes(g) || it.stats[g] || td.querySelector('td')) return;
    it.stats[g] = {};
    it.rows[g] = {};
    it.last[g] = td.closest('tr');
    // Enhancements and Resistances share one table: read the rows after the header up to the next header
    for (let tr = td.closest('tr').nextElementSibling; tr; tr = tr.nextElementSibling) {
      if ([...tr.cells].some((c) => GROUPS.includes(c.textContent.trim()))) break;
      if (tr.cells.length === 1 && /^\[none\]$/i.test(tr.textContent.trim())) it.none[g] = tr;
      if (tr.cells.length !== 2) continue;
      const v =parseFloat(tr.cells[1].textContent.replace(/[^\d.+-]/g, ''));
      if (isNaN(v)) continue;
      const k = tr.cells[0].textContent.replace(':', '').trim();
      it.stats[g][k] = v;
      it.rows[g][k] = tr;
      it.last[g] = tr;
    }
  });
  return it;
}

// The items worn, read from a page (the pictures whose tooltip says "[Click to Unequip]").
function wornFrom(root) {
  const seen = new Set();
  const out = [];
  root.querySelectorAll('img[onmouseover*="Unequip"]').forEach((im) => {
    const m = (im.getAttribute('onmouseover') || '').match(/ajaxLoadItem\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m && !seen.has(m[2])) { seen.add(m[2]); out.push(m.slice(1)); }
  });
  return out;
}

// The worn items: from the page when it shows the character (the profile), otherwise (a shop, the loot of a fight) from the
// profile page, read once and kept for two minutes.
let wornCache = null;
async function wornIds() {
  const here = wornFrom(document);
  if (here.length) return here;
  if (!wornCache || Date.now() - wornCache.t > 120000) {
    const p = fetch('index.php?cmd=profile', { credentials: 'same-origin' }).then((r) => r.text())
      .then((h) => wornFrom(new DOMParser().parseFromString(h, 'text/html')));
    wornCache = { t: Date.now(), p };
    p.catch(() => { wornCache = null; });
  }
  return wornCache.p;
}

const fmt = (n) => (n > 0 ? '+' : '') + (Math.round(n * 100) / 100);

function paint(td, text, d) {
  td.innerHTML = '<font color="' + (d > 0 ? UP : DOWN) + '">' + text + ' (' + fmt(d) + ')&nbsp;</font>';
}

// The hovered item's numbers coloured against the worn item's, with the difference in brackets; numbers only the worn item
// has are added as rows of 0.
function annotate(it, w) {
  for (const g of GROUPS) {
    if (!it.stats[g]) continue;
    const x = it.stats[g];
    const y = w.stats[g] || {};
    for (const k of Object.keys(x)) {
      const d = x[k] - (y[k] || 0);
      if (d) paint(it.rows[g][k].cells[1], it.rows[g][k].cells[1].textContent.replace(/ /g, '').trim(), d);
    }
    for (const k of Object.keys(y)) {
      if (k in x || !w.rows[g] || !w.rows[g][k]) continue;
      const tr = it.doc.importNode(w.rows[g][k], true);
      paint(tr.cells[1], '0', -y[k]);
      it.last[g].after(tr);
      it.last[g] = tr;
      if (it.none[g]) { it.none[g].remove(); it.none[g] = null; }
    }
  }
  return it.doc.body.innerHTML;
}

// What to show for an item's answer: { html, worn } (the item with its numbers coloured, and the worn item's answer), or null
// when nothing worn is of the same kind. load(itemId, invId, type, pid) gives an item's answer (cached by the caller).
export async function compareParts(html, load) {
  const it = parseItem(html);
  if (!it.type || !Object.keys(it.stats).length) return null;
  const all = await Promise.all((await wornIds()).map((a) => load(...a).then((h) => ({ h, p: parseItem(h) }), () => null)));
  const w = all.find((o) => o && o.p.type === it.type && o.p.name);
  return w ? { html: annotate(it, w.p), worn: w.h } : null;
}
