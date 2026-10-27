import { bpHeadBtns, pfBack } from './backpack.js';
import { copyOn, leaf, mel, mq, proxify, proxyKids } from './dom.js';

// ---- profile: the page is a stack of framed sections (a head picture, a body, a bottom picture) in two columns
export function pfSections(col) {
  const out = [];
  let cur = null;
  for (const tr of col.rows) {
    const c0 = tr.cells[0];
    const bg = (c0 && c0.getAttribute('background')) || '';
    if (/_head\./.test(bg)) {
      cur = { name: (bg.match(/([^\/]+?)_head\./) || [])[1] || 'x', bg, head: c0, rows: [] };
      out.push(cur);
    } else if (/profile_sub_bottom/.test(bg)) cur = null;
    else if (cur) cur.rows.push(tr);
  }
  return out;
}

// Statistics: label/value pairs, two per row; empty rows are small gaps.
function pfStats(rows) {
  const st = mq(rows, 'table').find((t) => t.querySelector('td > b'));
  if (!st) return null;
  const box = mel('div', 'st');
  const val = (td) => (td.querySelector('table') ? [...td.querySelectorAll('td')].map((c) => c.innerHTML.trim()).filter(Boolean).join(' ') : td.innerHTML);
  for (const tr of st.rows) {
    const labs = [...tr.cells].filter((td) => td.querySelector(':scope > b'));
    if (!labs.length) {
      const g = mel('i', 'gap');
      const c = tr.cells[0];
      const line = c && c.getAttribute('bgcolor'); // some empty rows are drawn as a thin line
      g.style.height = Math.round(tr.offsetHeight) + 'px';
      if (line) g.style.background = 'linear-gradient(' + line + ',' + line + ') center / 100% ' + Math.max(1, Math.round(c.offsetHeight)) + 'px no-repeat';
      box.append(g);
      continue;
    }
    labs.forEach((td, i) => {
      if (i) box.append(mel('i', 'sp'));
      box.append(mel('b', 'k', td.innerHTML), mel('span', 'v', val(td.nextElementSibling)));
    });
    if (labs.length === 1) box.append(mel('i', 'sp'), mel('i', 'e'));
  }
  return box;
}

// Enhancements and resistances: a label and a progress bar. The bar width in the game is the picture's own width.
function pfBars(rows, s) {
  const bars = mq(rows, 'table[onmouseover]');
  if (!bars.length) return null;
  const box = mel('div', 'bars ' + (s.name === 'resistances' ? 'res' : 'enh'));
  bars.forEach((bar) => {
    const lab = bar.closest('tr').cells[1];
    const im = bar.querySelector('img');
    const row = mel('div', 'r');
    const lb = mel('div', 'lb');
    const tb = lab.querySelector('table');
    if (tb) { const ic = tb.querySelector('img'); if (ic) lb.append(proxify(ic)); lb.append(document.createTextNode(tb.textContent.trim())); } else proxyKids(lab, lb);
    const br = copyOn(bar, mel('div', 'bar'));
    br.style.width = (parseFloat(bar.getAttribute('width')) || 130) + 'px';
    const fill = mel('i');
    fill.style.width = (im ? parseFloat(im.getAttribute('width')) || 0 : 0) + 'px';
    br.append(fill);
    row.append(lb, br);
    box.append(row);
  });
  return box;
}

function pfText(rows, s) {
  const b = mel('div', 'tx s-' + s.name);
  leaf(rows).forEach((td) => b.append(proxyKids(td, mel('div'))));
  return b;
}

function pfDeco(rows) {
  const imgs = mq(rows, 'img');
  if (!imgs.length) return null;
  const b = mel('div', 'deco');
  imgs.forEach((im) => { const w = mel('div'); w.append(proxify(im.closest('a') || im)); b.append(w); });
  return b;
}

function pfPeople(rows, s) {
  const links = mq(rows, 'a');
  if (!links.length) return pfText(rows, s);
  const g = mel('div', 'ppl');
  links.forEach((a) => {
    const tr = a.closest('tr');
    const im = tr && tr.querySelector('img');
    const p = mel('div', 'p');
    if (im) p.append(proxify(im));
    p.append(proxify(a));
    g.append(p);
  });
  return g;
}

// Inventory: three columns (left slots, the character picture made of stacked pictures, right slots).
function pfSlot(td, cls) {
  const s = mel('div', 'slot ' + (cls || ''));
  if (td) { proxyKids(td, s); copyOn(td, s); }
  return s;
}

function pfInv(rows) {
  const tb = mq(rows, 'table').find((t) => t.getAttribute('width') === '280');
  const cells = tb && tb.rows[0] ? [...tb.rows[0].cells] : [];
  if (cells.length < 6) return null;
  const lt = cells[1].querySelector('table');
  const rt = cells[5].querySelector('table');
  const dt = cells[3].querySelector('td[background]');
  if (!lt || !rt || !dt) return null;
  const wrap = mel('div', 'invw');
  const inv = mel('div', 'inv');
  const frame = getComputedStyle(tb).backgroundImage; // the frames around the slots come from the table's own style
  if (frame && frame !== 'none') inv.style.backgroundImage = frame;
  const lc = mel('div', 'lc');
  lc.append(pfSlot(lt.rows[1] && lt.rows[1].cells[0], 'big'), pfSlot(lt.querySelector('td[width="45"]'), 'sm'));
  const doll = mel('div', 'doll');
  // the stacked tables are outermost first; in css the first picture is the one on top
  const layers = [...dt.querySelectorAll('table[background]')].reverse().map((t) => t.getAttribute('background')).concat(dt.getAttribute('background'));
  doll.style.backgroundImage = layers.map((u) => 'url("' + u + '")').join(',');
  const rc = mel('div', 'rc');
  rt.querySelectorAll('td[height="45"]').forEach((td) => rc.append(pfSlot(td)));
  inv.append(lc, doll, rc);
  wrap.append(inv);
  return wrap;
}

export function pfComp(rows) {
  const cd = mq(rows, 'div').find((d) => d.id === 'componentDiv');
  const slots = cd ? [...cd.querySelectorAll('td[background*="1x1mini"]')] : [];
  if (!slots.length) return null;
  const box = mel('div', 'comp');
  const g = mel('div', 'cg');
  slots.forEach((td) => g.append(proxyKids(td, mel('div', 'cs1'))));
  box.append(g);
  const pg = leaf([cd]).find((td) => /Page/.test(td.textContent) && !td.querySelector('img'));
  if (pg) box.append(proxyKids(pg, mel('div', 'pg')));
  return box;
}

function pfBuffs(rows) {
  const cells = leaf(rows).filter((td) => td.querySelector('img'));
  if (!cells.length) return null;
  const box = mel('div', 'buffs');
  cells.forEach((td) => box.append(proxyKids(td, mel('div', 'bf'))));
  return box;
}

// Anything this layout does not know: the original contents, but inside the new frame.
function pfGeneric(rows) {
  const box = mel('div', 'gen');
  rows.forEach((tr) => [...tr.cells].forEach((td) => { if (td.textContent.trim() || td.querySelector('img, input, select')) box.append(proxyKids(td, mel('div'))); }));
  return box;
}

const PF = { statistics: pfStats, enhancements: pfBars, resistances: pfBars, biography: pfText, decorations: pfDeco, enlistment: pfText, allies: pfPeople, enemies: pfPeople, inventory: pfInv, backpack: pfBack, components: pfComp, buffs: pfBuffs };

export function pfSection(s, T) {
  const sec = mel('div', 'sec s-' + s.name);
  const hd = mel('div', 'hd');
  const url = s.head.getAttribute('background');
  hd.style.setProperty('--hd', 'url("' + (T.head ? T.head(s.name, url) : url) + '")');
  const hx = s.head.querySelector('font');
  if (hx) {
    const x = proxify(hx);
    x.className = 'hx';
    hd.append(x);
  }
  if (s.name === 'backpack') hd.insertBefore(bpHeadBtns(), hd.firstChild);
  let bd = null;
  try { bd = (PF[s.name] || pfGeneric)(s.rows, s); } catch (e) { console.warn('[Sigmastorm Helper] section ' + s.name, e); }
  if (!bd) bd = pfGeneric(s.rows, s);
  bd.classList.add('bd');
  sec.append(hd, bd, mel('div', 'ft'));
  return sec;
}
