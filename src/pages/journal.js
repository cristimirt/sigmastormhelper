import { https } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { tableToDivs } from '../layout/tablediv.js';

// The Journal (cmd=log), its Ignore List (subcmd=ignorelist) and its Outbox (subcmd=outbox) for the Modern layout, in the steel container (layout/steel.js): .jr-top (the game's notes and links), the page form (a copy,
// it works like the original: a GET with the page number) and .jr-list, one .jr-row per entry (.jr-ic, .jr-dt, .jr-msg). The game's table stays in
// the page, hidden in the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-jr]{display:none!important}#ssh-jr{display:none}html.ssh-modern #ssh-jr{display:block}' +
  '#ssh-jr .ssh-content-body{padding-top:14px;padding-bottom:14px;text-align:left}' +
  '#ssh-jr .jr-top p{margin:0 0 8px}' +
  '#ssh-jr form{margin:0 0 8px}' +
  '#ssh-jr .jr-row{display:flex;align-items:flex-start;gap:6px;padding:7px 4px;border-top:1px solid #1a1d1d;font-size:12px;line-height:1.4}' +
  '#ssh-jr .jr-row.hd{padding:3px 4px;border-top:0;background:#212323;font-weight:bold;color:#fff}' +
  '#ssh-jr .jr-ic{flex:0 0 16px;line-height:0}#ssh-jr .jr-dt{flex:0 0 130px}#ssh-jr .jr-msg{flex:1;min-width:0}';

const HEAD = 'img[src*="header_loghistory"], img[src*="header_ignorelist"], img[src*="header_msgoutbox"]';
export const isJournal = () => !!document.querySelector(HEAD);

// The entries of the Journal: one row each (the game's table has two more empty rows after every entry).
function entries(table, copy) {
  const list = mel('div', 'jr-list');
  const hd = mel('div', 'jr-row hd');
  hd.append(mel('div', 'jr-ic'), mel('div', 'jr-dt', 'Date'), mel('div', 'jr-msg', 'Message'));
  list.append(hd);
  table.querySelectorAll('td.log').forEach((m) => {
    const tr = m.parentElement;
    const row = mel('div', 'jr-row');
    const ic = mel('div', 'jr-ic');
    const im = tr.querySelector('img');
    if (im) ic.append(copy(im));
    const dt = mel('div', 'jr-dt');
    dt.append(...[...tr.cells[1].childNodes].map(copy));
    const msg = mel('div', 'jr-msg');
    msg.append(...[...m.childNodes].map(copy));
    row.append(ic, dt, msg);
    list.append(row);
  });
  return list;
}

export function initJournal() {
  const head = document.querySelector(HEAD);
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-jr')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const root = steelContainer({ header: https(new URL(head.getAttribute('src'), location.href).href) });
  root.id = 'ssh-jr';
  const copy = (n) => {
    const c = n.cloneNode(true);
    if (c.nodeType === 1) c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
    return c;
  };
  const cell = table.rows[1] && table.rows[1].cells[0];
  const top = mel('div', 'jr-top');
  root.body.append(top);
  [...(cell ? cell.children : [])].forEach((n) => {
    if (n.tagName === 'P') top.append(copy(n));
    else if (n.tagName === 'FORM') root.body.append(copy(n));
    else if (n.tagName === 'TABLE' && n.querySelector('td.log')) root.body.append(entries(n, copy)); // the Journal
    else if (n.tagName === 'TABLE') { // the Ignore List
      n.setAttribute('data-tg-trim', '1');
      root.body.append(tableToDivs(n));
    }
  });
  table.setAttribute('data-ssh-jr', '1');
  table.after(root);
}
