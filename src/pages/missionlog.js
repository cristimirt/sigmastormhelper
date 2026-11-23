import { withToken } from '../core/net.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { tableToDivs } from '../layout/tablediv.js';

// The Mission Log (cmd=questbook: Active / Completed / Not Started) for the Modern layout: a copy of the game's table made of divs
// (layout/tablediv.js) in the steel container (layout/steel.js: the game's title bar, the list, the footer). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched. Before the wiki
// button of each mission (the last column) there is a "G" button to the mission's page in the in-game Guide (the number is the row's data-mission-id).

const CSS = 'html.ssh-modern [data-ssh-ml]{display:none!important}#ssh-ml{display:none}html.ssh-modern #ssh-ml{display:block}' +
  '#ssh-ml .ssh-content-body>.tg{margin:0 auto}' +
  '#ssh-ml .ml-g{display:inline-block;box-sizing:border-box;width:20px;height:20px;line-height:17px;margin-right:4px;vertical-align:middle;text-align:center;' +
  'font:bold 14px Georgia,"Times New Roman",serif;color:#fff;background:#000;border:1px solid #d8d8d8;text-decoration:none}' +
  '#ssh-ml .ml-g:hover{border-color:#a7fffd;color:#a7fffd}' +
  '#ssh-ml .tgc a img{vertical-align:middle}';

export const isMissionLog = () => !!document.querySelector('td[background*="header_missionlog"]') && !!document.querySelector('form[id^="mission-book-page"]');

export function initMissionLog() {
  const head = document.querySelector('td[background*="header_missionlog"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-ml')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const list = table.querySelector('table[width="580"]'); // the list, with the tabs and the filters, in the cell between the game's title bar and footer
  if (!list) return;
  const copy = list.cloneNode(true); // the game's table is not touched: the buttons go into the copy
  copy.querySelectorAll('tr[data-mission-id]').forEach((tr) => {
    const id = tr.getAttribute('data-mission-id');
    const cell = tr.cells[tr.cells.length - 1];
    if (!id || !cell) return;
    const g = mel('a', 'ml-g');
    g.textContent = 'G';
    g.target = '_blank';
    g.rel = 'noopener';
    g.title = 'Open this mission in the Guide';
    g.href = withToken('index.php?cmd=guide&section=missions&id=' + id);
    cell.insertBefore(g, cell.firstChild);
  });
  // the game's page gives the last row of the list one column where the other rows have three: the list was only as wide as the first column
  const lr = copy.rows[copy.rows.length - 1];
  if (lr && lr.cells.length === 1) lr.cells[0].colSpan = Math.max(...[...copy.rows].map((r) => r.cells[0].colSpan || 1));
  table.setAttribute('data-ssh-ml', '1');
  const root = steelContainer({ header: head.getAttribute('background') });
  root.id = 'ssh-ml';
  root.body.append(tableToDivs(copy));
  table.after(root);
}
