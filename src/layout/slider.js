import { digits } from '../core/util.js';
import { mel } from './dom.js';

// A slider in the colours of the game's panels (dark inset track with a cyan fill, grey metal handle), tied to a number box: moving
// the slider fills the box, typing in the box moves the slider. Used by the Bank page; usable under any text box.
//
//   const s = addSlider(box, { max: 5000 });          // under `box` (or: { after: someElement } to put it elsewhere)
//   s.setMax(7000);                                   // when the limit changes
//   s.remove();
//
// options: min (default 0), max, step (default 1), after (an element to place the slider after; default: the box's cell), width (px).

function css() {
  if (document.getElementById('ssh-slider-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-slider-css';
  const T = 'height:10px;border:1px solid #5a5f5f;background:linear-gradient(90deg,#2f7f9c 0,#9fe0ff var(--p,0%),#0a1011 var(--p,0%),#0a1011 100%);box-shadow:inset 0 1px 3px #000;border-radius:0;';
  const H = 'box-sizing:border-box;width:12px;height:18px;margin-top:-5px;border:1px solid #9a9a8c;border-bottom-color:#9fe0ff;border-radius:0;background:linear-gradient(#8d8d80,#4b4b44);box-shadow:0 1px 2px #000;cursor:pointer;';
  s.textContent = '.ssh-bs{margin-top:6px}' +
    '.ssh-bs input[type=range]{display:block;width:100%;height:18px;margin:0;padding:0;background:transparent;cursor:pointer;-webkit-appearance:none;appearance:none}' +
    '.ssh-bs input[type=range]:disabled{opacity:.4;cursor:default}' +
    '.ssh-bs input[type=range]::-webkit-slider-runnable-track{' + T + '}' +
    '.ssh-bs input[type=range]::-moz-range-track{' + T + '}' +
    '.ssh-bs input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;' + H + '}' +
    '.ssh-bs input[type=range]::-moz-range-thumb{' + H.replace('margin-top:-5px;', '') + '}' +
    '.ssh-bs input[type=range]:hover::-webkit-slider-thumb{border-color:#fff;border-bottom-color:#9fe0ff}';
  document.head.append(s);
}

export function addSlider(box, opt = {}) {
  if (box.sshSlider && box.sshSlider.el.isConnected) { if (opt.max !== undefined) box.sshSlider.setMax(opt.max); return box.sshSlider; } // one per box, however often the page is set up
  css();
  const min = opt.min || 0;
  let max = Math.max(min, +opt.max || 0);
  const wrap = mel('div', 'ssh-bs');
  wrap.style.width = (opt.width || 250) + 'px';
  const r = mel('input');
  r.type = 'range';
  r.step = String(opt.step || 1);
  const fill = () => r.style.setProperty('--p', (max > min ? (100 * (r.value - min)) / (max - min) : 0) + '%');
  const fit = () => {
    r.min = String(min);
    r.max = String(max);
    r.disabled = max <= min;
    r.value = String(Math.min(max, Math.max(min, digits(box.value))));
    fill();
  };
  fit();
  r.addEventListener('input', () => { box.value = +r.value === min ? '' : r.value; fill(); });
  box.addEventListener('input', () => { r.value = String(Math.min(max, Math.max(min, digits(box.value)))); fill(); });
  wrap.append(r);
  if (opt.after) opt.after.after(wrap);
  else (box.closest('td') || box.parentElement).append(wrap);
  return (box.sshSlider = {
    el: wrap,
    input: r,
    setMax(m) { max = Math.max(min, +m || 0); fit(); },
    remove() { wrap.remove(); box.sshSlider = null; },
  });
}
