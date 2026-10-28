import { pageParts } from '../core/page.js';
import { store } from '../core/storage.js';
import { https } from '../core/util.js';
import { mel } from './dom.js';

// The sidebars of the Modern layout, made of divs: every widget (Main Menu, Questions, Game Stats, Skills, ...) is a div with a
// title bar, a body and a bottom, and the two sidebars are two columns of those. A widget is dragged by its title bar from one
// place to another, also from one side to the other. The game's pieces inside the bodies (the skills box, the forms, the links)
// are moved, not copied, so the game's scripts keep finding them by their ids; leaving the Modern layout puts everything back where
// it was. The arrangement is kept in the browser.

// A widget's title is a table whose picture says what it is: infobox_sigmabox.gif, subhead_skillbox.gif, factioninfo_header.gif ...
const HEAD = /(infobox_(?!bg)\w+|subhead_(?!bottom)\w+|\w+_header)\.gif/i;
const headId = (t) => ((t.getAttribute('style') || '').match(HEAD) || [])[1] || '';
const isHead = (t) => t.tagName === 'TABLE' && !!headId(t);
const bgUrl = (el) => https(((el.getAttribute('style') || '').match(/background-image:\s*(url\([^)]*\))/i) || [])[1] || '');

// The widgets in a holder: a title table followed by its body and bottom tables (the spacers and scripts between are left).
function groups(holder) {
  const out = [];
  [...holder.children].forEach((k) => {
    if (!isHead(k)) return;
    const parts = { id: headId(k), head: k, body: null, foot: null };
    let n = k.nextElementSibling;
    if (n && n.tagName === 'TABLE' && !isHead(n)) { parts.body = n; n = n.nextElementSibling; }
    if (n && n.tagName === 'TABLE' && !isHead(n)) parts.foot = n;
    out.push(parts);
  });
  return out;
}

let built = null; // { undo: [functions], order }

export function buildSidebars() {
  const p = pageParts();
  if (!p || !p.modern || built) return;
  const sides = { left: p.left, right: p.right };
  const undo = [];
  // moving a node remembers where it was, so that the Original layout can put it back
  const take = (node, to) => {
    const parent = node.parentNode;
    const next = node.nextSibling;
    to.appendChild(node);
    undo.push(() => parent.insertBefore(node, next && next.parentNode === parent ? next : null));
  };
  const takeKids = (from, to) => [...from.childNodes].forEach((n) => take(n, to));
  const drop = (node) => { // leaves the page for now
    const parent = node.parentNode;
    const next = node.nextSibling;
    node.remove();
    undo.push(() => parent.insertBefore(node, next && next.parentNode === parent ? next : null));
  };

  // A layout table becomes divs: the table a div, each row a div (a flex row when it has several cells), each cell a div that keeps
  // its alignment, size and padding. The content of the cells moves; innermost tables first.
  const divTables = (root) => {
    [...root.querySelectorAll('table')].reverse().forEach((tb) => {
      const box = mel('div', 'dt' + (tb.className ? ' ' + tb.className : ''));
      const w = tb.getAttribute('width');
      if (w) box.style.width = /%/.test(w) ? w : w + 'px';
      if (tb.getAttribute('align') === 'center') box.style.margin = '0 auto';
      if (tb.getAttribute('bgcolor')) box.style.background = tb.getAttribute('bgcolor');
      const pad = +tb.getAttribute('cellpadding') || 0;
      [...tb.rows].forEach((tr) => {
        const row = mel('div', 'dr');
        const cells = [...tr.cells];
        if (cells.length > 1) row.style.display = 'flex';
        cells.forEach((td) => {
          const c = mel('div', 'dc');
          c.style.padding = pad + 'px';
          if (td.getAttribute('align')) c.style.textAlign = td.getAttribute('align');
          if (td.getAttribute('height')) c.style.height = td.getAttribute('height') + 'px';
          if (td.getAttribute('bgcolor')) c.style.background = td.getAttribute('bgcolor');
          const cw = td.getAttribute('width');
          if (cells.length > 1) c.style.flex = cw ? '0 0 ' + (/%/.test(cw) ? cw : cw + 'px') : '1 1 0';
          takeKids(td, c);
          row.append(c);
        });
        box.append(row);
      });
      tb.replaceWith(box);
      undo.push(() => box.replaceWith(tb));
    });
  };
  // the game's style sheets inside its sidebar tables (the skills box, for one) belong to the page, not to the tables
  const keepStyles = (root) => root.querySelectorAll('style, link[rel="stylesheet"]').forEach((s) => take(s, document.head));
  // Its scripts too: the page runs them late (Cloudflare's Rocket Loader), and a script that is not in the page any more never runs
  // (the skills data, the menu function). They go to a hidden div.
  const keepScripts = (root, host) => {
    const keep = mel('div', 'ssh-scripts');
    keep.hidden = true;
    host.append(keep);
    undo.push(() => keep.remove());
    root.querySelectorAll('script').forEach((s) => take(s, keep));
  };

  const widgets = []; // { id, side, el }
  const caps = {};
  const widget = (id, side) => {
    const w = mel('div', 'ssh-w');
    w.dataset.w = id;
    widgets.push({ id, side, el: w });
    return w;
  };

  // the title bar: the picture the game puts on its title table (the Main Menu's one also holds a link)
  const makeHead = (w, headTable) => {
    const h = mel('div', 'wh ssh-wh');
    h.style.backgroundImage = bgUrl(headTable);
    h.style.height = (headTable.getAttribute('height') || 28) + 'px';
    headTable.querySelectorAll('td').forEach((td) => takeKids(td, h));
    w.append(h);
  };
  const makeBody = (w, bodyTable) => {
    const b = mel('div', 'wb');
    const td = bodyTable.rows[0] && bodyTable.rows[0].cells[0];
    b.style.backgroundImage = bgUrl(bodyTable);
    b.style.padding = (+bodyTable.getAttribute('cellpadding') || 0) + 'px';
    b.style.textAlign = (td && td.getAttribute('align')) || 'left';
    if (td) takeKids(td, b);
    divTables(b);
    w.append(b);
  };
  const makeFoot = (w, footTable) => {
    const f = mel('div', 'wf');
    if (footTable) f.style.backgroundImage = bgUrl(footTable);
    w.append(f);
  };

  // the Main Menu: the button pictures are links; each opens a list of links (a div whose id the game's own menu function finds)
  const makeMenu = (side, inner) => {
    const w = widget('subhead_mainmenu', side);
    const headTable = inner.querySelector('table[style*="subhead_mainmenu"]');
    makeHead(w, headTable);
    const list = mel('div', 'wm');
    [...inner.querySelectorAll('td')].forEach((td) => {
      if (td.closest('table') !== inner) return;
      [...td.children].forEach((k) => {
        if (k.tagName === 'A' && k.querySelector('img')) take(k, list);
        else if (k.tagName === 'DIV' && /^menuSource_/.test(k.id)) {
          const kids = [...k.childNodes];
          const items = mel('div', 'mm');
          k.querySelectorAll('a[href], b').forEach((e) => {
            if (e.tagName === 'B' && e.closest('a')) return;
            if (e.tagName === 'B') { const h = mel('div', 'mm-h'); h.append(mel('span', '', e.textContent.replace(/ /g, ' ').trim())); items.append(h); return; }
            const row = mel('div', 'mm-l');
            row.append(e.cloneNode(true));
            items.append(row);
          });
          kids.forEach((n) => n.remove());
          k.append(items);
          undo.push(() => { items.remove(); kids.forEach((n) => k.append(n)); });
          take(k, list);
        }
      });
    });
    w.append(list);
    makeFoot(w, inner.querySelector('table[style*="subhead_bottom"]'));
    return w;
  };

  Object.keys(sides).forEach((side) => {
    const c = sides[side];
    const outer = c.querySelector(':scope > table');
    if (!outer) return;
    caps[side] = outer.querySelector('img');
    const inner = outer.querySelector('table[width="120"]');
    if (!inner) return;
    // the widgets other than the Main Menu sit in the holder cells
    [...inner.querySelectorAll('td')].forEach((td) => {
      if (td.closest('table') !== inner) return;
      groups(td).forEach((g) => {
        if (g.id === 'subhead_mainmenu') return;
        const w = widget(g.id, side);
        makeHead(w, g.head);
        if (g.body) makeBody(w, g.body);
        makeFoot(w, g.foot);
      });
    });
    const moved = c.querySelector('#ssh-moved'); // Game Stats and Kill Logs moved to the left by the helper's option
    if (moved) groups(moved).forEach((g) => {
      const w = widget(g.id, side);
      makeHead(w, g.head);
      if (g.body) makeBody(w, g.body);
      makeFoot(w, g.foot);
    });
    if (inner.querySelector('table[style*="subhead_mainmenu"]')) { makeMenu(side, inner); widgets.unshift(widgets.pop()); } // the Main Menu is first in its column
    keepStyles(outer);
    keepScripts(outer, c);
    if (moved) { keepStyles(moved); keepScripts(moved, c); }
    drop(outer);
    if (moved) drop(moved);
  });
  if (!widgets.length) return;

  // the arrangement: the saved one, else where the widgets are
  const saved = store.get('sidebars', null) || {};
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const order = { left: [], right: [] };
  ['left', 'right'].forEach((s) => (saved[s] || []).forEach((id) => { if (byId.has(id) && !order.left.includes(id) && !order.right.includes(id)) order[s].push(id); }));
  widgets.forEach((w) => { if (!order.left.includes(w.id) && !order.right.includes(w.id)) order[w.side].push(w.id); });

  Object.keys(sides).forEach((side) => {
    const col = mel('div', 'ssh-col');
    col.dataset.side = side;
    if (caps[side]) { const cap = caps[side].cloneNode(true); cap.className = 'ssh-cap'; col.append(cap); }
    order[side].forEach((id) => col.append(byId.get(id).el));
    sides[side].append(col);
  });
  built = { undo };
  syncMenu();
  bindDrag();
  bindMenu();
}

// The Main Menu's buttons open and close their lists. The game's own function keeps a list of what is open that does not know the section
// that is open when the page loads, so the first click on it does nothing and its button picture is out of step. Here the state is
// what is on the screen: a list is open when it is shown, and the button picture says so (name_on.gif when open).
const MENU = /changeMenu\(\s*(\d+)\s*,\s*'([^']+)'/;
function menuState(a) {
  const m = (a.getAttribute('href') || '').match(MENU);
  if (!m) return null;
  return { id: m[1], name: m[2], list: document.getElementById('menuSource_' + m[1]), img: document.getElementById('menu_img_' + m[1]) };
}
function menuShow(s, open) {
  if (!s || !s.list || !s.img) return;
  s.list.style.display = open ? 'block' : 'none';
  s.img.src = s.img.src.replace(/[^/]*$/, '') + s.name + (open ? '_on' : '') + '.gif';
  if (Array.isArray(window.menuOpen)) window.menuOpen[s.id] = open ? 1 : 0; // the game's own list agrees
}
function syncMenu() {
  document.querySelectorAll('.ssh-w .wm > a[href*="changeMenu"]').forEach((a) => { const s = menuState(a); if (s && s.list) menuShow(s, getComputedStyle(s.list).display !== 'none'); });
}

// Back to the game's own sidebars.
export function unbuildSidebars() {
  if (!built) return;
  document.querySelectorAll('.ssh-col').forEach((c) => c.remove());
  built.undo.reverse().forEach((u) => u());
  built = null;
}

const save = () => {
  const o = {};
  document.querySelectorAll('.ssh-col').forEach((c) => { o[c.dataset.side] = [...c.querySelectorAll(':scope > .ssh-w')].map((w) => w.dataset.w); });
  store.set('sidebars', o);
};

let drag = null;
let ghost = null;
let marker = null;
let suppress = false;

function dragStart() {
  const r = drag.w.getBoundingClientRect();
  drag.dx = drag.x - r.left;
  drag.dy = drag.y - r.top;
  ghost = drag.w.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id')); // the real widget keeps the ids
  ghost.className = 'ssh-ghost';
  ghost.style.width = r.width + 'px';
  document.body.appendChild(ghost);
  marker = mel('div', 'ssh-drop');
  drag.w.classList.add('ssh-ph');
  document.body.classList.add('ssh-dragging');
  drag.on = true;
}

function dragMove(e) {
  ghost.style.left = e.clientX - drag.dx + 'px';
  ghost.style.top = e.clientY - drag.dy + 'px';
  // the column under the pointer (else the nearest), and the place in it: before the first widget whose middle is below the pointer
  const cols = [...document.querySelectorAll('.ssh-col')];
  if (!cols.length) return;
  const dist = (c) => { const r = c.parentNode.getBoundingClientRect(); return e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0; };
  const col = cols.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const next = [...col.querySelectorAll(':scope > .ssh-w')].find((w) => w !== drag.w && w.getBoundingClientRect().top + w.getBoundingClientRect().height / 2 > e.clientY);
  if (next) { if (marker.nextSibling !== next || marker.parentNode !== col) col.insertBefore(marker, next); } else if (marker.parentNode !== col || marker.nextSibling) col.appendChild(marker);
}

function dragEnd(commit) {
  if (!drag) return;
  if (drag.on) {
    if (commit && marker.parentNode) { marker.parentNode.insertBefore(drag.w, marker); save(); }
    marker.remove();
    ghost.remove();
    drag.w.classList.remove('ssh-ph');
    document.body.classList.remove('ssh-dragging');
    suppress = true; // the click that ends the drag must not open the title's link
    setTimeout(() => { suppress = false; }, 60);
  }
  drag = null;
  ghost = null;
  marker = null;
}

function bindMenu() {
  if (bindMenu.on) return;
  bindMenu.on = true;
  document.addEventListener('click', (e) => {
    const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('.ssh-w .wm > a[href*="changeMenu"]') : null;
    const s = a && menuState(a);
    if (!s || !s.list) return;
    e.preventDefault();
    e.stopPropagation();
    menuShow(s, getComputedStyle(s.list).display === 'none');
  }, true);
}

function bindDrag() {
  if (bindDrag.on) return;
  bindDrag.on = true;
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.target || typeof e.target.closest !== 'function') return;
    const h = e.target.closest('.ssh-wh');
    const w = h && h.closest('.ssh-w');
    if (!w) return;
    drag = { w, x: e.clientX, y: e.clientY, on: false };
    e.preventDefault(); // no text selection, no picture drag
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return; dragStart(); }
    dragMove(e);
  });
  document.addEventListener('pointerup', () => dragEnd(true));
  document.addEventListener('pointercancel', () => dragEnd(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dragEnd(false); });
  document.addEventListener('click', (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
}

export const sidebarCss = () =>
  '.ssh-col{display:flex;flex-direction:column;align-items:center;box-sizing:border-box;flex:1 0 auto;order:1;padding-bottom:12px}' +
  '.ssh-cap{display:block;margin-bottom:6px}' +
  '.ssh-w{width:133px;margin:0 0 12px;flex:none;font:8pt tahoma,sans-serif;color:#fff}' +
  '.ssh-w .wh{box-sizing:border-box;width:133px;background-repeat:no-repeat;background-position:0 0;cursor:grab}' +
  '.ssh-w .wh img{display:block;border:0}' +
  '.ssh-w .wb{box-sizing:border-box;width:133px;background-repeat:repeat-y}' +
  '.ssh-w .wf{width:133px;height:17px;background-repeat:no-repeat}' +
  '.ssh-w .wm{width:133px;display:flex;flex-direction:column;align-items:flex-start}' +
  '.ssh-w .wm>a{display:block;margin:0}.ssh-w .wm>a img{display:block;border:0}' +
  '.ssh-w .wm>div{width:128px}' +
  '.ssh-w .mm{background:url("https://cdn.sigmastorm.com/skin/menu_open_bg.gif") repeat-y}' +
  '.ssh-w .mm{font:8.2pt tahoma,sans-serif;color:#fff;text-align:left}.ssh-w .mm-l{height:20px;line-height:20px;padding-left:20px}.ssh-w .mm-l a{color:#a7ffff}' +
  // a heading is a 20 px row with a 13 px bar in it, 11 px in from the left and 113 px wide, as in the game's own menu
  '.ssh-w .mm-h{box-sizing:border-box;height:20px;padding:4px 0 3px 11px;color:#fff;font-weight:bold}.ssh-w .mm-h span{display:block;box-sizing:border-box;width:113px;height:13px;line-height:13px;padding-left:7px;background:#222;white-space:nowrap;overflow:hidden}' +
  '.ssh-w .dt{box-sizing:border-box}.ssh-w .dc{box-sizing:border-box}' +
  'body.ssh-dragging,body.ssh-dragging *{cursor:grabbing!important;user-select:none!important;-webkit-user-select:none!important}' +
  '.ssh-w.ssh-ph{opacity:.3}' +
  '.ssh-drop{width:133px;height:4px;margin:-8px 0 4px;flex:none;border-radius:2px;background:#9fe0ff;box-shadow:0 0 8px #9fe0ff;pointer-events:none}' +
  '.ssh-ghost{position:fixed;z-index:9700;margin:0;opacity:.6;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.85))}' +
  // the menu answers the pointer
  '.ssh-w a img{transition:filter .12s}.ssh-w a:hover img{filter:brightness(1.3)}' +
  '.ssh-w .mm-l a{display:inline-block;transition:color .12s,background .12s;text-decoration:none}.ssh-w .mm-l a:hover{color:#fff;background:rgba(159,224,255,.14)}';
