// Gear comparing: the tooltip of an item that is not worn is shown next to the tooltip of the worn item of the same kind
// (Weapon, Helmet, Weapon Add-On, ...), and its numbers are coloured and followed by the difference, e.g. "+27 (+13)".
// Item data is the game's own fetchitem.php answer.
const GROUPS = ['Bonuses', 'Enhancements', 'Resistances'];

// An item's answer from fetchitem.php, kept for a minute (cleared whenever the bag or profile is reloaded) and shared by every
// tooltip that shows an item.
const cache = new Map();
const pending = new Map();
export const peekItem = (itemId, invId) => {
  const hit = cache.get(itemId + '_' + invId);
  return hit && Date.now() - hit.t < 60000 ? hit.html : null;
};
export const clearItems = () => cache.clear();
export function loadItem(itemId, invId, type, pid) {
  const key = itemId + '_' + invId;
  const hit = peekItem(itemId, invId);
  if (hit !== null) return Promise.resolve(hit);
  let p = pending.get(key);
  if (!p) {
    p = fetch('fetchitem.php?item_id=' + itemId + '&inv_id=' + invId + '&t=' + type + '&p=' + pid + '&uid=' + Date.now(), { credentials: 'same-origin' })
      .then((r) => r.text())
      .then((html) => { cache.set(key, { t: Date.now(), html }); return html; });
    pending.set(key, p);
    const done = () => pending.delete(key);
    p.then(done, done);
  }
  return p;
}

// CSS for the pair of tooltips side by side (.cw holds .cm, the hovered item, and .ce, the worn one). `root` is the tooltip's
// selector; it gets the class `flip` when it opens to the left of the pointer, which puts the hovered item on the pointer's side.
export const pairCss = (root) =>
  root + ' .cw{display:flex;align-items:flex-start}' + root + '.flip .cw{flex-direction:row-reverse}' + root + ' .cm,' + root + ' .ce{flex:1 1 0;min-width:0}' +
  root + ' .ce{padding-left:8px;margin-left:8px;border-left:1px solid #555}' + root + '.flip .ce{padding:0 8px 0 0;margin:0 8px 0 0;border:0;border-right:1px solid #555}' +
  root + ' .eqh{margin-bottom:3px;color:#9a9488;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px}';

// The game's own tooltip settings: the look every tooltip of the helper shares.
export function tipLook() {
  const cfg = (typeof window.config === 'object' && window.config) || {};
  return {
    box: 'padding:' + (cfg.Padding || 3) + 'px;background:' + (cfg.BgColor && cfg.BgColor !== '#000000' ? cfg.BgColor : 'rgba(0,0,0,.95)') +
      ';border:' + (cfg.BorderWidth || 1) + 'px solid ' + (cfg.BorderColor || '#666') + ';color:' + (cfg.FontColor || '#fff') +
      ';font:' + (cfg.FontSize || '8pt') + ' ' + (cfg.FontFace || 'Helvetica') + ',Arial,sans-serif;text-align:left;',
    title: cfg.TitleBgColor || '#333',
    offX: cfg.OffsetX || 14,
    offY: cfg.OffsetY || 8,
  };
}
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
