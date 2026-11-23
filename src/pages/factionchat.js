import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';

// The faction's chat page (cmd=guild&subcmd=chat) for the Modern layout: the steel container (layout/steel.js, the helper's steel header with
// "Faction Chat"), the faction's name and the intro, the game's forms (copies: they post like the originals) and the messages as rows of divs
// (date, player, message). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-fc]{display:none!important}#ssh-fc{display:none}html.ssh-modern #ssh-fc{display:block}' +
  '#ssh-fc h3{margin:0 0 8px;font-size:14px;color:#e6dcc8}#ssh-fc .fc-intro{margin:0 0 10px}' +
  '#ssh-fc form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}#ssh-fc form input[type=submit]{cursor:pointer}' +
  '#ssh-fc #faction-chat-message{flex:1;min-width:200px}' +
  '#ssh-fc .fc-list{margin:0 0 10px}#ssh-fc .fc-row{display:grid;grid-template-columns:118px 92px 1fr;gap:0 8px;padding:5px 4px;border-bottom:1px solid #1c2020}' +
  '#ssh-fc .fc-head{background:#1b1f1f;color:#fff;border-bottom:1px solid #3a3d3d;padding:4px}#ssh-fc .fc-row:not(.fc-head):hover{background:#12181a}' +
  '#ssh-fc .fc-date{color:#9a9488;white-space:nowrap}#ssh-fc .fc-msg{min-width:0;overflow-wrap:anywhere}';

export const isFactionChat = () => /[?&]cmd=guild/.test(location.search) && /[?&]subcmd=chat/.test(location.search) && !!document.getElementById('faction-chat-send');

export function initFactionChat() {
  const send = document.getElementById('faction-chat-send');
  const table = send && send.closest('table[width="640"]');
  const cell = send && send.parentElement;
  if (!table || !cell || document.getElementById('ssh-fc')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ title: 'Faction Chat' });
  page.id = 'ssh-fc';
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  const root = page.body;
  [...cell.children].forEach((c) => {
    if (c.tagName === 'H3') root.append(c.cloneNode(true));
    else if (c.tagName === 'P') { const p = c.cloneNode(true); p.classList.add('fc-intro'); root.append(p); } else if (c.tagName === 'FORM') root.append(c.cloneNode(true));
    else if (c.tagName === 'TABLE') {
      const list = mel('div', 'fc-list');
      [...c.rows].forEach((tr) => {
        const cells = [...tr.cells];
        if (cells.length < 3 || !cells.some((x) => x.textContent.trim())) return; // the empty rows between the messages
        const row = mel('div', 'fc-row' + (cells[0].tagName === 'TH' ? ' fc-head' : ''));
        cells.forEach((x, i) => { const d = mel('div', ['fc-date', 'fc-who', 'fc-msg'][i] || ''); x.childNodes.forEach((n) => d.append(n.cloneNode(true))); row.append(d); });
        list.append(row);
      });
      root.append(list);
    }
  });
  table.setAttribute('data-ssh-fc', '1');
  table.after(page);
}
