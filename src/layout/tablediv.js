import { cssUrl, https } from '../core/util.js';

// A copy of a piece of the game's markup in which every table is made of divs (CSS grid), for the pages that are big sets of nested tables.
// Each table becomes a grid: its columns come from the widest row (colspan counted), a cell is a div that spans its colspan / rowspan, the first
// cell of a row always starts a new line. The attributes the tables use for looks are turned into styles: width, height, align, valign, bgcolor,
// background, cellpadding, cellspacing, nowrap. Everything that is not a table is copied as it is (links, forms, fonts, pictures: the
// game's own handlers on them keep working, a form posts like the original), pictures on https.
//
//   const root = tableToDivs(table);   // a div, to be put where the table was

const CSS = '.tg{display:grid;box-sizing:border-box}.tg>.tgc{box-sizing:border-box}' +
  '.tg{max-width:100%}.tgc.r{text-align:right}.tgc.r>div>.tg{margin-left:auto}.tgc.ctr>div>.tg{margin-left:auto;margin-right:auto}.tgc.rt>div>.tg{margin-left:auto}'; // the page is in quirks mode: a table in a centred cell is centred too

function ensureCss() {
  if (document.getElementById('ssh-tg-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-tg-css';
  // the game's page is in quirks mode: text in a table does not take the font size of the page, it has the one the game gives to td
  const td = document.querySelector('.cf-body td') || document.querySelector('td');
  const cs = td && getComputedStyle(td);
  const font = cs ? '.tgc{font-size:' + cs.fontSize + ';font-family:' + cs.fontFamily + ';line-height:' + cs.lineHeight + ';color:' + cs.color + ';font-weight:' + cs.fontWeight + '}' : '';
  s.textContent = CSS + font;
  document.head.append(s);
}

const num = (v, d) => (v === null || v === '' || isNaN(parseFloat(v)) ? d : parseFloat(v));
const size = (v) => { v = String(v || '').trim(); return /%$/.test(v) ? parseFloat(v) + '%' : /^\d+(\.\d+)?$/.test(v) ? v + 'px' : ''; };

function cellStyle(td, pad) {
  const st = [];
  const h = td.getAttribute('height');
  if (h && size(h)) st.push('min-height:' + size(h));
  const a = (td.getAttribute('align') || '').toLowerCase();
  if (a) st.push('text-align:' + (a === 'center' ? 'center' : a === 'right' ? 'right' : a === 'left' ? 'left' : a));
  const v = (td.getAttribute('valign') || '').toLowerCase();
  // a cell fills its row; its content sits as the valign says (in the middle when it says nothing, as in a table)
  st.push('display:flex;flex-direction:column;justify-content:' + (v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center'));
  const bg = td.getAttribute('bgcolor');
  if (bg) st.push('background-color:' + bg);
  const img = td.getAttribute('background');
  if (img) st.push('background-image:' + cssUrl(img) + (/\/header_/.test(img) ? ';background-repeat:no-repeat' : '')); // a title bar picture is shorter than its cell: it is not repeated (the page's own background shows under it)
  if (td.hasAttribute('nowrap')) st.push('white-space:nowrap');
  st.push('padding:' + pad + 'px');
  return st.join(';');
}

function convTable(t) {
  ensureCss();
  const rows = [...t.rows];
  const cols = rows.reduce((m, r) => Math.max(m, [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)), 1);
  // the width of each column: the width of a one-column cell that has one (a px width, or a percentage)
  const w = new Array(cols).fill('');
  rows.forEach((r) => {
    let at = 0;
    [...r.cells].forEach((c) => {
      if ((c.colSpan || 1) === 1 && !w[at] && size(c.getAttribute('width') || '')) w[at] = size(c.getAttribute('width'));
      at += c.colSpan || 1;
    });
  });
  // a table with a width shares it between its columns by their widths (as a table does when the widths do not fit); one without a width is as wide as its columns
  const fixed = size(t.getAttribute('width') || '');
  const allPx = w.every((x) => /px$/.test(x));
  const track = w.map((x) => (!x ? 'auto' : /px$/.test(x) ? (fixed && allPx ? 'minmax(min-content,' + parseFloat(x) + 'fr)' : 'minmax(min-content,' + x + ')') : (fixed ? 'minmax(min-content,' + parseFloat(x) + 'fr)' : x)));
  // with data-tg-trim on the table: columns at the end that no one-column cell is in (a colspan that is wider than the table) take no width, as in a table
  const used = new Array(cols).fill(false);
  rows.forEach((r) => {
    let at = 0;
    [...r.cells].forEach((c) => { if ((c.colSpan || 1) === 1) used[at] = true; at += c.colSpan || 1; });
  });
  if (t.hasAttribute('data-tg-trim')) for (let i = cols - 1; i > 0 && !used[i] && track[i] === 'auto'; i--) track[i] = '0px'; // only for a table that asks for it: a cell that spans such columns may need their width
  const pad = num(t.getAttribute('cellpadding'), 1);
  const gap = num(t.getAttribute('cellspacing'), 2);
  const g = document.createElement('div');
  g.className = 'tg';
  if (t.id) g.id = t.id;
  const st = ['grid-template-columns:' + track.join(' '), 'gap:' + gap + 'px', 'padding:' + gap + 'px'];
  const tw = t.getAttribute('width');
  st.push(tw && size(tw) ? 'width:' + size(tw) : 'width:fit-content;max-width:100%');
  const th = t.getAttribute('height');
  if (th && size(th)) st.push('min-height:' + size(th));
  const al = (t.getAttribute('align') || '').toLowerCase();
  if (al === 'center') st.push('margin-left:auto;margin-right:auto');
  else if (al === 'right') st.push('margin-left:auto');
  const bg = t.getAttribute('background');
  if (bg) st.push('background-image:' + cssUrl(bg));
  const bc = t.getAttribute('bgcolor');
  if (bc) st.push('background-color:' + bc);
  const own = t.getAttribute('style');
  g.style.cssText = st.join(';') + (own ? ';' + own : '');
  rows.forEach((r) => {
    [...r.cells].forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'tgc';
      if (c.id) d.id = c.id;
      if (/^(center|middle)$/i.test(c.getAttribute('align') || '')) d.classList.add('ctr');
      if ((c.getAttribute('align') || '').toLowerCase() === 'right') d.classList.add('rt'); // a table in a right-aligned cell is at the right (quirks mode)
      if (c.dataset.tgClass) d.classList.add(c.dataset.tgClass); // a page can ask for its own class on a cell (data-tg-class)
      const span = c.colSpan || 1;
      d.style.cssText = (i === 0 ? 'grid-column:1 / span ' + span : span > 1 ? 'grid-column:span ' + span : '') + ';' + cellStyle(c, pad) + (c.getAttribute('style') ? ';' + c.getAttribute('style') : '');
      const inner = document.createElement('div'); // the content in one block, so that inline content stays inline inside the flex cell
      [...c.childNodes].forEach((n) => inner.append(conv(n)));
      d.append(inner);
      g.append(d);
    });
  });
  return g;
}

function conv(n) {
  if (n.nodeType !== 1) return n.cloneNode(true);
  if (n.tagName === 'TABLE') return convTable(n);
  if (n.tagName === 'SCRIPT') return document.createComment('');
  const c = n.cloneNode(false);
  if (c.tagName === 'IMG' && c.getAttribute('src')) c.src = https(c.getAttribute('src'));
  [...n.childNodes].forEach((x) => c.append(conv(x)));
  return c;
}

export const tableToDivs = (table) => convTable(table);
