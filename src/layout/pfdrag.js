import { store } from '../core/storage.js';
import { mel } from './dom.js';

// The panels of the profile page (Statistics, Inventory, ...): dragged by their title bar to another place in either column, and
// hidden or shown with a switch on the title bar. The arrangement is kept in `store` ('pfsec': { cols: [[names], [names]], shut: [names] }).
// A panel that is not in the saved arrangement (a new one) stays where the game puts it.
// Two arrangements: your own profile (it has a Backpack panel) and any other player's (it has none; one arrangement for all of them).
const grid = () => document.querySelector('#ssh-prof .pf-cols');
const keyOf = (g) => (g && g.querySelector('.s-backpack') ? 'pfsec' : 'pfsec_other');
const KEY = () => keyOf(grid());
const names = (col) => [...col.querySelectorAll(':scope > .sec')].map((s) => s.dataset.sec);
const saved = (g) => store.get(g ? keyOf(g) : KEY(), null) || {};

function persist() {
  const cols = [...document.querySelectorAll('#ssh-prof .pf-cols > .col')];
  const o = saved();
  o.cols = cols.map(names);
  store.set(KEY(), o);
}

// Put the panels of a fresh profile where the player left them, and fold the ones that were folded.
export function applyPfOrder(grid) {
  const cols = [...grid.querySelectorAll(':scope > .col')];
  const secs = [...grid.querySelectorAll('.sec')];
  secs.forEach((s) => { s.dataset.sec = s.className.replace(/^.*\bs-([\w-]+).*$/, '$1'); });
  const o = saved(grid);
  if (Array.isArray(o.cols)) {
    const byName = new Map(secs.map((s) => [s.dataset.sec, s]));
    const listed = new Set([].concat(...o.cols));
    const placed = new Set();
    const plan = cols.map((c, i) => {
      const mine = (o.cols[i] || []).map((n) => byName.get(n)).filter((s) => s && !placed.has(s));
      mine.forEach((s) => placed.add(s));
      return mine;
    });
    cols.forEach((c, i) => {
      const rest = [...c.querySelectorAll(':scope > .sec')].filter((s) => !listed.has(s.dataset.sec));
      c.append(...plan[i], ...rest);
    });
  }
  const shut = new Set(o.shut || []);
  secs.forEach((s) => {
    s.classList.toggle('shut', shut.has(s.dataset.sec));
    const hd = s.querySelector(':scope > .hd');
    if (hd && !hd.querySelector('.pf-tg')) hd.append(mel('button', 'pf-tg')); // the switch that shows or hides the panel
    const tg = s.querySelector(':scope > .hd > .pf-tg');
    if (tg) { tg.type = 'button'; tg.setAttribute('role', 'switch'); tg.setAttribute('aria-checked', String(!s.classList.contains('shut'))); tg.title = 'Show or hide this panel'; }
  });
}

function toggle(sec) {
  const o = saved();
  const shut = new Set(o.shut || []);
  const now = sec.classList.toggle('shut');
  const tg = sec.querySelector(':scope > .hd > .pf-tg');
  if (tg) tg.setAttribute('aria-checked', String(!now));
  if (now) shut.add(sec.dataset.sec); else shut.delete(sec.dataset.sec);
  o.shut = [...shut];
  store.set(KEY(), o);
}

let drag = null;
let ghost = null;
let marker = null;
let suppress = false;

function start() {
  const r = drag.s.getBoundingClientRect();
  drag.dx = drag.x - r.left;
  drag.dy = drag.y - r.top;
  ghost = drag.s.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  ghost.classList.add('pf-ghost');
  ghost.style.width = r.width + 'px';
  document.body.append(ghost);
  marker = mel('div', 'pf-drop');
  drag.s.classList.add('pf-ph');
  document.body.classList.add('ssh-dragging');
  drag.on = true;
}

function move(e) {
  ghost.style.left = e.clientX - drag.dx + 'px';
  ghost.style.top = e.clientY - drag.dy + 'px';
  const cols = [...document.querySelectorAll('#ssh-prof .pf-cols > .col')];
  if (!cols.length) return;
  const dist = (c) => { const r = c.getBoundingClientRect(); return e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0; };
  const col = cols.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const next = [...col.querySelectorAll(':scope > .sec')].find((s) => s !== drag.s && s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2 > e.clientY);
  if (next) { if (marker.nextSibling !== next || marker.parentNode !== col) col.insertBefore(marker, next); } else if (marker.parentNode !== col || marker.nextSibling) col.append(marker);
}

function end(commit) {
  if (!drag) return;
  if (drag.on) {
    if (commit && marker.parentNode) { marker.parentNode.insertBefore(drag.s, marker); persist(); }
    marker.remove();
    ghost.remove();
    drag.s.classList.remove('pf-ph');
    document.body.classList.remove('ssh-dragging');
    suppress = true; // the click that ends the drag must not fold the panel
    setTimeout(() => { suppress = false; }, 60);
  }
  drag = null;
  ghost = null;
  marker = null;
}

export function bindPfDrag() {
  if (bindPfDrag.on) return;
  bindPfDrag.on = true;
  const head = (e) => (e.target && typeof e.target.closest === 'function' && !e.target.closest('a,button,input,select,textarea') ? e.target.closest('#ssh-prof .sec > .hd') : null);
  document.addEventListener('pointerdown', (e) => {
    const h = e.button === 0 && head(e);
    if (!h) return;
    drag = { s: h.parentNode, x: e.clientX, y: e.clientY, on: false };
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return; start(); }
    move(e);
  });
  document.addEventListener('pointerup', () => end(true));
  document.addEventListener('pointercancel', () => end(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') end(false); });
  document.addEventListener('click', (e) => {
    if (suppress) { e.preventDefault(); e.stopPropagation(); return; }
    const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('#ssh-prof .sec > .hd > .pf-tg') : null;
    if (t) { e.preventDefault(); toggle(t.closest('.sec')); }
  }, true);
}

// A small link at the top of the page: all panels back to the game's order, all open.
export function pfResetLink(root) {
  const a = mel('a', 'pf-reset', 'Reset panels');
  a.href = '#';
  a.title = 'Put the panels back in their places and open them all';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    store.set(KEY(), null);
    location.reload();
  });
  root.querySelector('.pf-title').append(a);
}

export const pfDragCss = () => {
  const P = '#ssh-prof ';
  return P + '.pf-title{position:relative}' +
    P + '.pf-reset{position:absolute;right:14px;bottom:2px;font-size:7pt;color:#7a8a8a;text-decoration:none}' + P + '.pf-reset:hover{color:#9fe0ff}' +
    P + '.col{min-height:60px}' +
    P + '.sec>.hd{cursor:grab;position:relative}' +
    // the switch: a small gray pill with a knob, at the right end of the title bar (the title and its buttons make room to its left)
    P + '.pf-tg{position:relative;flex:none;margin-left:8px;width:22px;height:11px;padding:0;box-sizing:border-box;border:1px solid #4a4d4d;border-radius:6px;background:#141616;cursor:pointer;transition:background .15s,border-color .15s}' +
    P + '.pf-tg::after{content:"";position:absolute;top:1px;left:1px;width:7px;height:7px;border-radius:50%;background:#6c7070;transition:left .15s,background .15s}' +
    P + '.pf-tg[aria-checked="true"]{background:#3a3d3d;border-color:#8a8f8f}' +
    P + '.pf-tg[aria-checked="true"]::after{left:12px;background:#d0d4d4}' +
    P + '.pf-tg:hover{border-color:#c2c6c6}' +
    P + '.sec.shut>.bd{display:none}' +
    P + '.sec.pf-ph{opacity:.3}' +
    '.pf-drop{height:4px;margin:4px 0;border-radius:2px;background:#9fe0ff;box-shadow:0 0 8px #9fe0ff;pointer-events:none}' +
    '.pf-ghost{position:fixed;z-index:9700;margin:0;opacity:.6;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.85))}';
};
