import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { steelContainer } from '../layout/steel.js';

// The Join Faction Request page (cmd=guild&subcmd=join&joinrequest_guild_id=...) for the Modern layout: the steel container
// (layout/steel.js) with the game's glass header, the link back, the intro, and a box with the faction, the message and the button (a
// form of our own with the game's hidden fields: it posts like the original). The game's table stays in the page, hidden in the Modern
// layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-jf]{display:none!important}#ssh-jf{display:none}html.ssh-modern #ssh-jf{display:block}' +
  '#ssh-jf p{margin:0 20px 12px;text-align:left}#ssh-jf .jf-back{text-align:center;margin:0 20px 14px}' +
  '#ssh-jf .jf-box{width:440px;max-width:100%;margin:16px auto;padding:10px 14px;box-sizing:border-box;background:#0d0f0f;border:1px solid #3a3d3d}' +
  '#ssh-jf .jf-box form{margin:0}#ssh-jf .jf-row{display:grid;grid-template-columns:120px 1fr;align-items:start;gap:8px;padding:4px 0}' +
  '#ssh-jf .jf-row>:first-child{text-align:right}' +
  '#ssh-jf textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;background:#000;border:1px solid #434347;color:#aeaaa4;padding:4px 6px}' +
  '#ssh-jf .jf-act{text-align:center;padding-top:8px}#ssh-jf .jf-act input{cursor:pointer}#ssh-jf .jf-act input[disabled]{cursor:default;opacity:.45}';

export const isJoinFaction = () => !!document.getElementById('faction-application') && !!document.querySelector('td[background*="header_joinguildrequest"]');

export function initJoinFaction() {
  const head = document.querySelector('td[background*="header_joinguildrequest"]');
  const table = head && head.closest('table[width="640"]');
  const form = document.getElementById('faction-application');
  const fields = form && form.querySelector('table'); // the faction, the message and the button
  if (!table || !fields || document.getElementById('ssh-jf')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ header: head.getAttribute('background'), glass: true });
  page.id = 'ssh-jf';
  const cell = form.closest('td');
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;

  // what stands above the form: the link back, then the intro
  [...table.rows].forEach((tr) => {
    if (tr.contains(form) || tr.cells[0].hasAttribute('background')) return; // the form, the header and the footer picture
    const text = tr.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const back = !!tr.querySelector('a');
    const d = mel(back ? 'div' : 'p', back ? 'jf-back' : '');
    tr.cells[0].childNodes.forEach((n) => d.append(n.cloneNode(true)));
    d.querySelectorAll('center').forEach((c) => c.replaceWith(...c.childNodes));
    page.body.append(d);
  });

  const box = mel('div', 'jf-box');
  const f = form.cloneNode(false);
  f.removeAttribute('id');
  [...form.elements].filter((e) => e.type === 'hidden').forEach((e) => f.append(e.cloneNode(true)));
  [...fields.rows].forEach((tr) => {
    const cells = [...tr.cells];
    const row = mel('div', cells.length > 1 ? 'jf-row' : 'jf-act');
    cells.forEach((c) => {
      const d = cells.length > 1 ? mel('div') : row;
      c.childNodes.forEach((n) => d.append(n.cloneNode(true)));
      if (d !== row) row.append(d);
    });
    f.append(row);
  });
  box.append(f);
  page.body.append(box);
  table.setAttribute('data-ssh-jf', '1');
  table.after(page);
  // the game's answer may be a box in the hidden table: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
