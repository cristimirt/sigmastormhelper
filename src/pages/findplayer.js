import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { unbreak } from '../layout/unbreak.js';

// The Locate Player page (cmd=findplayer) for the Modern layout: the steel container (layout/steel.js) with the intro and the game's form (a
// copy: it posts like the original) in one row. The game's table stays in the page, hidden in the Modern layout, so Original is untouched.

const CSS = 'html.ssh-modern [data-ssh-fp]{display:none!important}#ssh-fp{display:none}html.ssh-modern #ssh-fp{display:block}' +
  '#ssh-fp .fp-intro{text-align:center;margin:0 0 10px}#ssh-fp form{margin:0 0 14px}' +
  '#ssh-fp .fp-row{display:flex;gap:8px;align-items:center;justify-content:center}#ssh-fp input[type=submit]{cursor:pointer}';

const find = () => {
  if (!/[?&]cmd=findplayer/.test(location.search)) return null;
  const form = document.querySelector('.cf-body table[width="640"] form');
  return form && form.querySelector('input[type="text"]') ? form : null;
};
export const isFindPlayer = () => !!find();

export function initFindPlayer() {
  const form = find();
  const table = form && form.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-fp')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const head = table.querySelector('td[background*="header_"], td[style*="header_"]');
  const m = head && (head.getAttribute('background') || ((head.getAttribute('style') || '').match(/url\(["']?([^"')]+)/) || [])[1]);
  const page = steelContainer({ header: m });
  page.id = 'ssh-fp';
  const cs = getComputedStyle(form.closest('td')); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  const root = page.body;
  const center = table.querySelector('center');
  if (center) { const i = mel('div', 'fp-intro'); center.childNodes.forEach((n) => i.append(n.cloneNode(true))); root.append(i); }
  const f = form.cloneNode(false);
  [...form.children].forEach((c) => { if (c.tagName !== 'TABLE') f.append(c.cloneNode(true)); });
  const row = mel('div', 'fp-row');
  form.querySelectorAll('td').forEach((c) => { if (!c.querySelector('td')) c.childNodes.forEach((n) => row.append(n.cloneNode(true))); });
  f.append(row);
  root.append(unbreak(f));
  table.setAttribute('data-ssh-fp', '1');
  table.after(page);
}
