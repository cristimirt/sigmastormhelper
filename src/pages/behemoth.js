import { withToken } from '../core/net.js';
import { mel } from '../layout/dom.js';
import { tableToDivs } from '../layout/tablediv.js';
import { BM_CSS, behMenu } from './behmenu.js';

// Behemoth Rewards (cmd=guild&subcmd=titanrewards) and Behemoth Kills (cmd=titan) for the Modern layout: the game's table made of divs
// (layout/tablediv.js), the game's own staying in the page, hidden in the Modern layout. Both get the menu of the behemoth pages on top. On the
// kills page the picture and the name of each behemoth link to its Guide page, and the contributors of the faction are highlighted.

const CSS = BM_CSS + 'html.ssh-modern [data-ssh-bh]{display:none!important}#ssh-bh{display:none}html.ssh-modern #ssh-bh{display:block}' +
  '#ssh-bh .tgc.mine{background:#123a1c!important;color:#d6ffd9}#ssh-bh .tgc.mine a{color:#9dffb0}' +
  '#ssh-bh .bm-menu{margin-top:10px}#ssh-bh .tgc.enough,#ssh-bh .tgc.enough *{color:#4cdc4c!important;font-weight:bold}#ssh-bh .bh-it{text-align:center}#ssh-bh .bh-it img{margin:0 auto}#ssh-bh .bh-nm{margin-top:3px;font-size:10px;line-height:1.3}';

const PAGES = {
  rewards: 'td[background*="header_behemothrewards"]',
  kills: 'td[background*="header_behemothkilllog"]',
};

export const behemothPage = () => Object.keys(PAGES).find((k) => document.querySelector(PAGES[k])) || '';

// the faction of the player: the form of the faction chat (the sidebar) has its number
function myGuild() {
  const i = document.querySelector('input[name="guild_id"]');
  return i ? i.value : '';
}

export function initBehemoth(kind) {
  const head = document.querySelector(PAGES[kind]);
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-bh')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  if (kind === 'kills') { // the contributors of my faction: their cells get a class, which the copy takes over
    const g = myGuild();
    if (g) {
      table.querySelectorAll('a[href*="guild_id="]').forEach((a) => {
        if (new URL(a.href, location.href).searchParams.get('guild_id') !== g) return;
        const tr = a.closest('tr');
        if (tr) [...tr.cells].forEach((td) => { td.dataset.tgClass = 'mine'; });
      });
    }
  }
  if (kind === 'rewards') { // the points the faction has are enough for the item: that cell gets a class, which the copy takes over
    table.querySelectorAll('tr').forEach((tr) => {
      const c = tr.cells;
      if (c.length !== 5 || !/BKP/.test(c[2].textContent)) return;
      const need = parseInt(c[2].textContent.replace(/[^\d]/g, ''), 10);
      const have = parseInt(c[3].textContent.replace(/[^\d]/g, ''), 10);
      if (need > 0 && have >= need) c[3].dataset.tgClass = 'enough';
    });
  }
  table.setAttribute('data-ssh-bh', '1');
  const root = mel('div');
  root.id = 'ssh-bh';
  const grid = tableToDivs(table);
  const menu = behMenu(kind);
  const back = [...grid.querySelectorAll('a[href*="subcmd=manage"]')].find((a) => /Back to/i.test(a.textContent));
  const cell = back && back.closest('.tgc');
  if (cell) { // the page's own "Back to ..." row becomes the menu
    cell.replaceChildren(mel('div'));
    cell.firstChild.append(menu);
  } else {
    menu.style.gridColumn = '1 / -1';
    grid.firstElementChild.after(menu);
  }
  if (kind === 'rewards') { // the name of the item under its picture, both linking to the Guide's page of the item
    grid.querySelectorAll('img[src*="items/"]').forEach((im) => {
      const id = (im.getAttribute('src').match(/items\/(\d+)/) || [])[1];
      const name = im.getAttribute('alt') || '';
      if (!id) return;
      const href = withToken('index.php?cmd=guide&section=items&id=' + id);
      const a = mel('a');
      a.href = href;
      im.replaceWith(a);
      a.append(im);
      const cell = a.closest('.tgc');
      if (cell) cell.classList.add('bh-it'); // the picture and the name are centred in their column
      if (name) {
        const n = mel('div', 'bh-nm');
        const l = mel('a');
        l.href = href;
        l.textContent = name;
        n.append(l);
        a.after(n);
      }
    });
  }
  if (kind === 'kills') {
    grid.querySelectorAll('img[src*="creatures/"]').forEach((im) => {
      const id = (im.getAttribute('src').match(/creatures\/(\d+)/) || [])[1];
      if (!id) return;
      const href = withToken('index.php?cmd=guide&section=entities&id=' + id);
      const a = mel('a');
      a.href = href;
      im.replaceWith(a);
      a.append(im);
      const f = a.parentNode.querySelector('font');
      if (f && f.textContent.trim()) {
        const n = mel('a');
        n.href = href;
        n.textContent = f.textContent;
        f.replaceChildren(n);
      }
    });
  }
  root.append(grid);
  table.after(root);
}
