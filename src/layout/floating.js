import { S } from '../core/state.js';
import { store } from '../core/storage.js';

// A panel on the page itself (not in the map): it scrolls with the page and is dragged anywhere by its title bar. Where it was left is
// kept in `store` under `key` ({ x, y }). `home()` gives the first place ({ x, y } in page pixels, relative to the map viewer's box).
// Whatever in the title bar matches `skip` (a button) is not a handle.
export function floatPanel(p, { key, skip, home }) {
  const head = p.querySelector('.hd');
  const clamp = () => {
    if (!p.offsetWidth) return; // hidden: nothing to measure
    const doc = document.documentElement;
    p.style.left = Math.max(0, Math.min(p.offsetLeft, doc.scrollWidth - p.offsetWidth)) + 'px';
    p.style.top = Math.max(0, Math.min(p.offsetTop, doc.scrollHeight - 40)) + 'px';
  };
  const pos = store.get(key, null) || home(S.viewer.getBoundingClientRect());
  p.style.left = pos.x + 'px';
  p.style.top = pos.y + 'px';
  clamp();
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (skip && e.target.closest(skip)) return;
    drag = { dx: e.pageX - p.offsetLeft, dy: e.pageY - p.offsetTop };
    head.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    p.style.left = e.pageX - drag.dx + 'px';
    p.style.top = e.pageY - drag.dy + 'px';
    clamp();
  });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    try { head.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
    store.set(key, { x: p.offsetLeft, y: p.offsetTop });
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
  window.addEventListener('resize', clamp);
}
