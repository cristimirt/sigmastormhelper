import { store } from '../core/storage.js';
import { mel } from './dom.js';

// Panels that can be dragged by their title bar to another place in either column and hidden or shown with a switch on the title bar, for a page
// other than the profile (the same behaviour as layout/pfdrag.js, with its own selectors). The arrangement is kept in `store` under `key`:
// { cols: [[names], [names]], shut: [names] }. A panel that is not in the saved arrangement stays where the page puts it.
//
//   sections({ root, key: 'gmsec', cols: '.gm-col', sec: '.sec', head: '.gm-h', scope: '#ssh-gm' })
//
// root: the element that holds the columns (events are bound once per root), cols: the selector of the columns inside it, sec: of the panels
// inside a column (direct children, each with a data-sec name), head: of the title bar parts inside a panel (all of them drag the panel, the
// switch is added to the last one, or to what `switchIn(headPart)` gives). A hidden panel keeps only its title bar (CSS in `sectionsCss`).

export function sections(o) {
  const { root, key, cols: colSel, sec: secSel, head: headSel } = o;
  const cols = () => [...root.querySelectorAll(colSel)];
  const secsOf = (c) => [...c.querySelectorAll(':scope > ' + secSel)];
  const names = (c) => secsOf(c).map((s) => s.dataset.sec);
  const saved = () => store.get(key, null) || {};

  // the saved order and the folded panels, and a switch on every title bar
  const all = cols().flatMap(secsOf);
  const s0 = saved();
  if (Array.isArray(s0.cols)) {
    const byName = new Map(all.map((s) => [s.dataset.sec, s]));
    const listed = new Set([].concat(...s0.cols));
    const placed = new Set();
    const plan = cols().map((c, i) => {
      const mine = (s0.cols[i] || []).map((n) => byName.get(n)).filter((s) => s && !placed.has(s));
      mine.forEach((s) => placed.add(s));
      return mine;
    });
    cols().forEach((c, i) => c.append(...plan[i], ...secsOf(c).filter((s) => !listed.has(s.dataset.sec))));
  }
  const shut0 = new Set(s0.shut || []);
  all.forEach((s) => {
    s.classList.toggle('shut', shut0.has(s.dataset.sec));
    const heads = s.querySelectorAll(headSel);
    const last = heads[heads.length - 1];
    if (last && !s.querySelector('.sc-tg')) {
      last.classList.add('sc-hl'); // the part of the title bar that holds the switch (it makes room for it)
      const tg = mel('button', 'sc-tg');
      tg.type = 'button';
      tg.setAttribute('role', 'switch');
      tg.setAttribute('aria-checked', String(!s.classList.contains('shut')));
      tg.title = 'Show or hide this panel';
      (o.switchIn ? o.switchIn(last) : last).append(tg);
    }
  });

  if (root.dataset.scBound) return;
  root.dataset.scBound = '1';
  const toggle = (s) => {
    const st = saved();
    const shut = new Set(st.shut || []);
    const now = s.classList.toggle('shut');
    const tg = s.querySelector('.sc-tg');
    if (tg) tg.setAttribute('aria-checked', String(!now));
    if (now) shut.add(s.dataset.sec); else shut.delete(s.dataset.sec);
    st.shut = [...shut];
    store.set(key, st);
  };
  let drag = null;
  let ghost = null;
  let marker = null;
  let suppress = false;
  const start = () => {
    const r = drag.s.getBoundingClientRect();
    drag.dx = drag.x - r.left;
    drag.dy = drag.y - r.top;
    ghost = drag.s.cloneNode(true);
    ghost.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    ghost.classList.add('sc-ghost');
    ghost.style.width = r.width + 'px';
    document.body.append(ghost);
    marker = mel('div', 'sc-drop');
    drag.s.classList.add('sc-ph');
    document.body.classList.add('ssh-dragging');
    drag.on = true;
  };
  const move = (e) => {
    ghost.style.left = e.clientX - drag.dx + 'px';
    ghost.style.top = e.clientY - drag.dy + 'px';
    const cs = cols();
    if (!cs.length) return;
    const dist = (c) => { const r = c.getBoundingClientRect(); return e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0; };
    const col = cs.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    const next = secsOf(col).find((s) => s !== drag.s && s.getBoundingClientRect().top + s.getBoundingClientRect().height / 2 > e.clientY);
    if (next) { if (marker.nextSibling !== next || marker.parentNode !== col) col.insertBefore(marker, next); } else if (marker.parentNode !== col || marker.nextSibling) col.append(marker);
  };
  const end = (commit) => {
    if (!drag) return;
    if (drag.on) {
      if (commit && marker.parentNode) {
        marker.parentNode.insertBefore(drag.s, marker);
        const st = saved();
        st.cols = cols().map(names);
        store.set(key, st);
      }
      marker.remove();
      ghost.remove();
      drag.s.classList.remove('sc-ph');
      document.body.classList.remove('ssh-dragging');
      suppress = true; // the click that ends the drag must not fold the panel
      setTimeout(() => { suppress = false; }, 60);
    }
    drag = null;
    ghost = null;
    marker = null;
  };
  const headOf = (e) => (e.target && typeof e.target.closest === 'function' && !e.target.closest('a,button,input,select,textarea') ? e.target.closest(headSel) : null);
  root.addEventListener('pointerdown', (e) => {
    const h = e.button === 0 && headOf(e);
    const s = h && h.closest(secSel);
    if (!s) return;
    drag = { s, x: e.clientX, y: e.clientY, on: false };
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
  root.addEventListener('click', (e) => {
    if (suppress) { e.preventDefault(); e.stopPropagation(); return; }
    const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('.sc-tg') : null;
    if (t) { e.preventDefault(); toggle(t.closest(secSel)); }
  }, true);
}

// The look of the switch, the folded panel, the drop mark and the dragged copy; `scope` is the page's root selector.
export const sectionsCss = (scope, head, body) =>
  scope + ' ' + head + '{cursor:grab}' +
  scope + ' .sc-hl{position:relative;padding-right:36px!important}' +
  scope + ' .sc-tg{position:absolute;right:8px;top:50%;margin-top:-6px;width:22px;height:11px;padding:0;box-sizing:border-box;border:1px solid #4a4d4d;border-radius:6px;background:#141616;cursor:pointer;transition:background .15s,border-color .15s}' +
  scope + ' .sc-tg::after{content:"";position:absolute;top:1px;left:1px;width:7px;height:7px;border-radius:50%;background:#6c7070;transition:left .15s,background .15s}' +
  scope + ' .sc-tg[aria-checked="true"]{background:#3a3d3d;border-color:#8a8f8f}' +
  scope + ' .sc-tg[aria-checked="true"]::after{left:12px;background:#d0d4d4}' +
  scope + ' .sc-tg:hover{border-color:#c2c6c6}' +
  scope + ' .shut ' + body + '{display:none!important}' +
  scope + ' .sc-ph{opacity:.3}' +
  '.sc-drop{height:4px;margin:4px 0;border-radius:2px;background:#9fe0ff;box-shadow:0 0 8px #9fe0ff;pointer-events:none}' +
  '.sc-ghost{position:fixed;z-index:9700;margin:0;opacity:.6;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.85))}';
