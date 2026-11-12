import { mel } from '../layout/dom.js';
import { tableToDivs } from '../layout/tablediv.js';

// The Faction Recruitment page (cmd=guild&subcmd=recruit) for the Modern layout: a copy of the game's table made of divs (layout/tablediv.js).
// The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched. The forms are copies that work like the
// originals. Accept and Deny sit on one row, Deny with a red tint.

const CSS = 'html.ssh-modern [data-ssh-rc]{display:none!important}#ssh-rc{display:none}html.ssh-modern #ssh-rc{display:block}' +
  '#ssh-rc form[id^="faction-acceptjoin-"],#ssh-rc form[id^="faction-denyjoin-"]{display:inline-block;margin:0}' +
  '#ssh-rc form[id^="faction-denyjoin-"]{margin-left:5px}' +
  '#ssh-rc form[id^="faction-denyjoin-"] input[type="submit"]{background:#3a1212;border-color:#7a2a2a;color:#ffb0b0}' +
  '#ssh-rc form[id^="faction-denyjoin-"] input[type="submit"]:hover{background:#4d1818;color:#fff}';

export const isRecruit = () => !!document.querySelector('td[background*="header_recruitment"]');

export function initRecruit() {
  const head = document.querySelector('td[background*="header_recruitment"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-rc')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-rc', '1');
  const root = mel('div');
  root.id = 'ssh-rc';
  const grid = tableToDivs(table);
  // the list of requests: the game gives the Action column 20%, which is less than the two buttons need, so the table grew wider than the page;
  // here that column is as wide as its buttons and the other two share what is left
  const list = grid.querySelector('form[id^="faction-acceptjoin-"]');
  const lg = list && list.closest('.tg'); // the grid that holds the buttons, not the ones around it
  const og = lg && lg.parentElement.closest('.tg'); // the table around it (600 wide): its first column takes what the others leave, so nothing is wider than the page
  if (og) og.style.gridTemplateColumns = 'minmax(0,1fr) auto auto';
  if (lg) lg.style.gridTemplateColumns = 'minmax(min-content,1fr) minmax(min-content,3fr) max-content';
  root.append(grid);
  table.after(root);
}
