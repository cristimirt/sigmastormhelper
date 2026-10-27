import { mel } from './dom.js';

// The game's own messages in a response page: boxes with a head line like "INFORMATION ALERT".
export function gAlerts(doc) {
  return [...doc.querySelectorAll('table')].filter((t) => !t.querySelector('table') && /^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*$/i.test((t.querySelector('b') || {}).textContent || ''));
}

export function alertModal(alerts) {
  if (!alerts.length) return;
  const body = mel('div', 'mm-al');
  alerts.forEach((t) => body.append(document.importNode(t, true)));
  mModal('Message', body, [{ text: 'OK' }]);
}

// A small draggable dialog (title bar, body, buttons). Esc or a click outside closes it.
export function mModal(title, body, buttons) {
  const old = document.getElementById('ssh-mm');
  if (old) old.remove();
  const o = mel('div');
  o.id = 'ssh-mm';
  o.innerHTML = '<div class="box"><div class="ph"><span class="t"></span><span class="x" title="Close">&#10006;</span></div><div class="pb"></div><div class="pf"></div></div>';
  o.querySelector('.t').textContent = title;
  o.querySelector('.pb').append(body);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { o.remove(); document.removeEventListener('keydown', onKey); };
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
