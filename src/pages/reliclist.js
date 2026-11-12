import { mel } from '../layout/dom.js';
import { tableToDivs } from '../layout/tablediv.js';

// The page that lists all artifacts (cmd=guild&subcmd=reliclist) for the Modern layout: a copy of the game's table made of divs
// (layout/tablediv.js). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched. The links and the
// page forms (a GET with the page number) are copies that work like the originals.

const CSS = 'html.ssh-modern [data-ssh-rll]{display:none!important}#ssh-rll{display:none}html.ssh-modern #ssh-rll{display:block}';

export const isRelicList = () => !!document.querySelector('td[background*="header_artifacts"]') && !!document.querySelector('form select[name="page"]');

export function initRelicList() {
  const head = document.querySelector('td[background*="header_artifacts"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-rll')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-rll', '1');
  const root = mel('div');
  root.id = 'ssh-rll';
  root.append(tableToDivs(table));
  table.after(root);
}
