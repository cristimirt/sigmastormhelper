import { mel } from './dom.js';

// The game's own messages in a response page: boxes with a head line like "INFORMATION ALERT".
export function gAlerts(doc) {
  return [...doc.querySelectorAll('table')].filter((t) => !t.querySelector('table') && /^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*$/i.test((t.querySelector('b') || {}).textContent || ''));
}

// The game's message as a plain dialog: the head line ("INFORMATION ALERT") is the title, the text is the body.
export function alertModal(alerts) {
  if (!alerts.length) return;
  const body = mel('div', 'mm-al');
  let title = '';
  alerts.forEach((t) => {
    const c = document.importNode(t, true);
    const b = c.querySelector('b');
    if (!title) title = b.textContent.trim();
    const row = b.closest('tr');
    if (row && c.rows.length > 1) row.remove(); else b.remove();
    const cells = [...c.querySelectorAll('td')].filter((td) => !td.querySelector('td'));
    const p = mel('div', 'msg');
    p.innerHTML = (cells.length ? cells.map((td) => td.innerHTML.trim()).filter(Boolean).join('<br>') : c.innerHTML).trim();
    body.append(p);
  });
  mModal(title || 'Message', body, [{ text: 'OK' }], { center: true });
}

// A small draggable dialog (title bar, body, buttons). Esc or a click outside closes it.
// opts: { center: true } centers the title; { keep: true } leaves this dialog open when another one is shown on top of it; { onClose } runs when it closes.
export function mModal(title, body, buttons, opts) {
  document.querySelectorAll('#ssh-mm:not(.keep)').forEach((e) => e.remove());
  const o = mel('div');
  o.id = 'ssh-mm';
  if (opts && opts.keep) o.classList.add('keep');
  if (opts && opts.center) o.classList.add('ctr');
  o.innerHTML = '<div class="box"><div class="ph"><span class="t"></span><span class="x" title="Close">&#10006;</span></div><div class="pb"></div><div class="pf"></div></div>';
  o.querySelector('.t').textContent = title;
  o.querySelector('.pb').append(body);
  const onKey = (e) => { if (e.key === 'Escape' && [...document.querySelectorAll('#ssh-mm')].pop() === o) close(); };
  const close = () => {
    if (!o.isConnected) return;
    o.remove();
    document.removeEventListener('keydown', onKey);
    if (opts && opts.onClose) opts.onClose();
  };
  const pf = o.querySelector('.pf');
  buttons.forEach((b) => {
    const x = mel('input', 'custombutton ' + (b.cls || ''));
    x.type = 'button';
    x.value = b.text;
    x.addEventListener('click', () => { close(); if (b.fn) b.fn(); });
    pf.append(x);
  });
  o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
  o.querySelector('.x').addEventListener('click', close);
  const box = o.querySelector('.box');
  const ph = o.querySelector('.ph');
  let drag = null;
  ph.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.x')) return;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(box.style.transform || '');
    drag = { x: e.clientX, y: e.clientY, tx: m ? +m[1] : 0, ty: m ? +m[2] : 0 };
    ph.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  ph.addEventListener('pointermove', (e) => { if (drag) box.style.transform = 'translate(' + (drag.tx + e.clientX - drag.x) + 'px,' + (drag.ty + e.clientY - drag.y) + 'px)'; });
  const end = () => { drag = null; };
  ph.addEventListener('pointerup', end);
  ph.addEventListener('pointercancel', end);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(o);
  const first = pf.firstChild;
  if (first) first.focus();
  return close;
}
