import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { unbreak } from '../layout/unbreak.js';

// The Transmit Message page (cmd=message) for the Modern layout: the steel container (layout/steel.js) with the intro, and a box with the
// game's form (a copy: it posts like the original) whose rows are divs. The game's table stays in the page, hidden in the Modern layout, so
// the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-tm]{display:none!important}#ssh-tm{display:none}html.ssh-modern #ssh-tm{display:block}' +
  '#ssh-tm .tm-intro{text-align:center;margin:0 0 14px}' +
  '#ssh-tm .tm-box{width:550px;max-width:100%;margin:0 auto 14px;border:1px solid #5f5f5f}' +
  '#ssh-tm .tm-title{background:#212323;text-align:center;padding:1px 0}' +
  '#ssh-tm .tm-box form{margin:0;padding:10px}#ssh-tm .tm-row{display:flex;gap:10px;align-items:flex-start;margin:0 0 10px}' +
  '#ssh-tm .tm-row>:first-child{flex:0 0 100px}#ssh-tm .tm-row>:last-child{flex:1}#ssh-tm .tm-row textarea{width:100%;box-sizing:border-box}' +
  '#ssh-tm .tm-act{text-align:center}#ssh-tm input[type=submit]{cursor:pointer}';

export const isTransmit = () => !!document.querySelector('.cf-body form#message-send');

export function initTransmit() {
  const form = document.querySelector('.cf-body form#message-send');
  const table = form && form.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-tm')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const head = table.querySelector('td[style*="header_"]');
  const m = head && (head.getAttribute('style') || '').match(/url\(["']?([^"')]+)/);
  const page = steelContainer({ header: m && m[1] });
  page.id = 'ssh-tm';
  const cs = getComputedStyle(form.closest('td')); // the page is in quirks mode: text in a table has the game's own font for td, not the page's
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  const root = page.body;
  const center = table.querySelector('td[align="left"] > center');
  if (center) { const i = mel('div', 'tm-intro'); center.childNodes.forEach((n) => i.append(n.cloneNode(true))); root.append(i); }
  const box = mel('div', 'tm-box');
  const title = mel('div', 'tm-title');
  title.textContent = 'Message Details';
  const f = form.cloneNode(false);
  [...form.children].forEach((c) => { if (c.tagName !== 'TABLE') f.append(c.cloneNode(true)); });
  [...form.querySelector('table').rows].forEach((tr) => {
    const cells = [...tr.cells];
    const row = mel('div', cells.length > 1 ? 'tm-row' : 'tm-act');
    cells.forEach((c) => { const d = mel('div'); c.childNodes.forEach((n) => d.append(n.cloneNode(true))); row.append(d); });
    f.append(row);
  });
  box.append(title, f);
  root.append(unbreak(box));
  table.setAttribute('data-ssh-tm', '1');
  table.after(page);
}
