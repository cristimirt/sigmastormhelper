import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { steelContainer } from '../layout/steel.js';

// The Reserve Energy page (cmd=points&subcmd=reserve) for the Modern layout: the steel container (layout/steel.js) with the game's glass
// header, the intro as paragraphs, and a box with the numbers and the transfer form (a form of our own with the game's hidden fields: it posts
// like the original). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-re]{display:none!important}#ssh-re{display:none}html.ssh-modern #ssh-re{display:block}' +
  '#ssh-re p{margin:0 20px 12px;text-align:left}' +
  '#ssh-re .re-box{width:300px;max-width:100%;margin:16px auto;padding:10px 14px;box-sizing:border-box;background:#0d0f0f;border:1px solid #3a3d3d}' +
  '#ssh-re .re-box form{margin:0}#ssh-re .re-row{display:grid;grid-template-columns:130px 1fr;align-items:center;gap:8px;padding:4px 0}' +
  '#ssh-re .re-row input{width:100%;box-sizing:border-box;background:#000;border:1px solid #434347;color:#aeaaa4;padding:2px 6px}' +
  '#ssh-re .re-act{text-align:center;padding-top:8px}#ssh-re .re-act input{cursor:pointer}#ssh-re .re-act input[disabled]{cursor:default;opacity:.55}' +
  '#ssh-re .re-note{display:block;margin-top:6px;color:#9a9488}';

export const isReserveEnergy = () => !!document.getElementById('reserve-transfer') && !!document.querySelector('td[background*="header_reserveenergy"]');

export function initReserveEnergy() {
  const head = document.querySelector('td[background*="header_reserveenergy"]');
  const table = head && head.closest('table[width="640"]');
  const form = document.getElementById('reserve-transfer');
  const balance = table && table.querySelector('#reserve-balance');
  const info = balance && balance.closest('table'); // the numbers, the amount and the button
  if (!table || !form || !info || document.getElementById('ssh-re')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ header: head.getAttribute('background') });
  page.id = 'ssh-re';
  const cell = info.parentElement;
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;

  // the intro: the text before the numbers, a paragraph for every block of it
  let text = '';
  const flush = () => { if (text.trim()) { const p = mel('p'); p.textContent = text.replace(/\s+/g, ' ').trim(); page.body.append(p); } text = ''; };
  for (const n of cell.childNodes) {
    if (n === info) break;
    if (n.nodeName === 'BR') flush(); else text += n.textContent;
  }
  flush();

  const box = mel('div', 're-box');
  const f = form.cloneNode(false);
  f.removeAttribute('id');
  [...form.elements].filter((e) => e.type === 'hidden').forEach((e) => f.append(e.cloneNode(true)));
  [...info.rows].forEach((tr) => {
    const cells = [...tr.cells];
    if (cells.length > 1) {
      const row = mel('div', 're-row');
      cells.forEach((c) => {
        const d = mel('div');
        c.childNodes.forEach((n) => d.append(n.cloneNode(true)));
        d.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
        d.querySelectorAll('input').forEach((i) => i.removeAttribute('style'));
        row.append(d);
      });
      f.append(row);
    } else {
      const act = mel('div', 're-act');
      const btn = tr.querySelector('input[type="submit"]');
      const note = tr.querySelector('small');
      if (btn) act.append(btn.cloneNode(true));
      if (note) { const s = mel('span', 're-note'); s.textContent = note.textContent.trim(); act.append(s); }
      f.append(act);
    }
  });
  box.append(f);
  page.body.append(box);
  table.setAttribute('data-ssh-re', '1');
  table.after(page);
  // the game's answer to a transfer is a box that may sit in the hidden table: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
