import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { steelContainer } from '../layout/steel.js';

// The Create a Faction page (cmd=guild&subcmd=create) for the Modern layout: the steel container (layout/steel.js) with the game's
// header, the intro, and a box with the name, the game's note and the button (a form of our own with the game's hidden fields: it posts
// like the original). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-cr]{display:none!important}#ssh-cr{display:none}html.ssh-modern #ssh-cr{display:block}' +
  '#ssh-cr p{margin:0 20px 12px;text-align:center}' +
  '#ssh-cr .cr-box{width:380px;max-width:calc(100% - 40px);margin:16px auto;padding:10px 14px;box-sizing:border-box;background:#0d0f0f;border:1px solid #3a3d3d}' +
  '#ssh-cr .cr-box form{margin:0}#ssh-cr .cr-row{display:flex;align-items:center;gap:8px;padding:4px 0}' +
  '#ssh-cr .cr-row input{flex:1;min-width:0;height:24px!important;box-sizing:border-box;background:#000;border:1px solid #434347;color:#aeaaa4;padding:2px 6px;font:12px Arial,sans-serif}' +
  '#ssh-cr .cr-note{padding:8px 0;text-align:center}' +
  '#ssh-cr .cr-act{text-align:center;padding-top:4px}#ssh-cr .cr-act input{cursor:pointer}#ssh-cr .cr-act input[disabled]{cursor:default;opacity:.45}';

export const isCreateFaction = () => !!document.getElementById('faction-create') && !!document.querySelector('td[background*="header_createfaction"]');

export function initCreateFaction() {
  const head = document.querySelector('td[background*="header_createfaction"]');
  const table = head && head.closest('table[width="640"]');
  const form = document.getElementById('faction-create');
  const fields = form && form.querySelector('table'); // the name, the note and the button, with spacer rows between
  if (!table || !fields || document.getElementById('ssh-cr')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ header: head.getAttribute('background') });
  page.id = 'ssh-cr';
  const cell = form.closest('td');
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;

  // the intro: the rows above the form that say something
  for (const tr of cell.parentElement.parentElement.children) {
    if (tr.contains(form)) break;
    const text = tr.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const p = mel('p');
    p.textContent = text;
    page.body.append(p);
  }

  const box = mel('div', 'cr-box');
  const f = form.cloneNode(false);
  f.removeAttribute('id');
  [...form.elements].filter((e) => e.type === 'hidden').forEach((e) => f.append(e.cloneNode(true)));
  [...fields.rows].forEach((tr) => {
    if (!tr.textContent.trim() && !tr.querySelector('input')) return; // a spacer
    const cells = [...tr.cells];
    const row = mel('div', cells.length > 1 ? 'cr-row' : tr.querySelector('input') ? 'cr-act' : 'cr-note');
    cells.forEach((c) => {
      const d = cells.length > 1 && !c.querySelector('input') ? mel('span') : row;
      c.childNodes.forEach((n) => d.append(n.cloneNode(true)));
      if (d !== row) row.append(d);
    });
    f.append(row);
  });
  box.append(f);
  page.body.append(box);
  table.setAttribute('data-ssh-cr', '1');
  table.after(page);
  // the game's answer may be a box in the hidden table: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
