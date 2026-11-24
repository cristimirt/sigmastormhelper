import { harvest, idFor, knownId, knownName, nameFor } from '../core/players.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';

// The Faction Log (cmd=guild&subcmd=log): the game writes "Player #1333545" for players it does not name (members who have left, say). The
// number becomes the player's name, as a link to the player's page. The name is read from the page of the player ("= Name =" at the top);
// names found are kept, so the next visit shows them at once.
const ID = /Player #(\d+)|Faction member (\S+?)(?= purchased|\s|$)/gi;

export const isFactionLog = () => /[?&]cmd=guild/.test(location.search) && /[?&]subcmd=log(?:&|$)/.test(location.search);

const CSS = 'html.ssh-modern [data-ssh-fl]{display:none!important}#ssh-fl{display:none}html.ssh-modern #ssh-fl{display:block}' +
  '#ssh-fl h3{margin:0 0 8px;font-size:14px;color:#e6dcc8}' +
  '#ssh-fl form{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}#ssh-fl form input[type=submit]{cursor:pointer}' +
  '#ssh-fl .fl-list{margin:0 0 10px}#ssh-fl .fl-row{display:grid;grid-template-columns:16px 118px 1fr;gap:0 8px;padding:5px 4px;border-bottom:1px solid #1c2020}' +
  '#ssh-fl .fl-head{background:#1b1f1f;color:#fff;border-bottom:1px solid #3a3d3d;padding:4px;font-weight:bold}#ssh-fl .fl-row:not(.fl-head):hover{background:#12181a}' +
  '#ssh-fl .fl-date{color:#9a9488;white-space:nowrap}#ssh-fl .fl-msg{min-width:0;overflow-wrap:anywhere}#ssh-fl .fl-ic img{display:block}';

// The page for the Modern layout: the steel container with the faction's name, the page form (a copy: it works like the original) and the
// entries as rows of divs (icon, date, message). The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched.
function convert() {
  const form = document.querySelector('.cf-body form input[name="subcmd"][value="log"]');
  const f0 = form && form.form;
  const cell = f0 && f0.parentElement;
  const table = cell && cell.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-fl')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ title: 'Faction Log' });
  page.id = 'ssh-fl';
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  [...cell.children].forEach((c) => {
    if (c.tagName === 'H3' || c.tagName === 'FORM') page.body.append(c.cloneNode(true));
    else if (c.tagName === 'TABLE') {
      const list = mel('div', 'fl-list');
      [...c.rows].forEach((tr) => {
        const cells = [...tr.cells];
        if (cells.length < 3 || !cells.some((x) => x.textContent.trim() || x.querySelector('img'))) return; // the spacer rows between the entries
        const row = mel('div', 'fl-row' + (cells[0].tagName === 'TH' ? ' fl-head' : ''));
        cells.forEach((x, i) => { const d = mel('div', ['fl-ic', 'fl-date', 'fl-msg'][i] || ''); x.childNodes.forEach((n) => d.append(n.cloneNode(true))); row.append(d); });
        list.append(row);
      });
      page.body.append(list);
    }
  });
  table.setAttribute('data-ssh-fl', '1');
  table.after(page);
}

// A player's name as a link (to the number remembered; found when it is not known yet).
function nameLink(name) {
  const a = document.createElement('a');
  a.textContent = name;
  const id = knownId(name);
  if (id) a.href = 'index.php?cmd=profile&player_id=' + id;
  else idFor(name).then((i) => { if (i) a.href = 'index.php?cmd=profile&player_id=' + i; });
  return a;
}

// Messages that name players in plain text: "Name changed the rank of Name to Rank." (the rank in bold), "Name deposit 50000 credits."
const RANK = /^(\s*)(\S+) changed the rank of (\S+) to (.+?)(\.?\s*)$/;
const MONEY = /^(\s*)(\S+) (deposit(?:ed)?|withdr\w+|withdrew) (.*)$/;

function plain(node) {
  const t = node.nodeValue;
  let m = t.match(RANK);
  if (m) {
    const b = document.createElement('b');
    b.textContent = m[4];
    node.replaceWith(m[1], nameLink(m[2]), ' changed the rank of ', nameLink(m[3]), ' to ', b, m[5]);
    return true;
  }
  m = t.match(MONEY);
  if (m && !/^(Faction|Player)$/i.test(m[2])) {
    node.replaceWith(m[1], nameLink(m[2]), ' ' + m[3] + ' ' + m[4]);
    return true;
  }
  return false;
}

export function initFactionLog() {
  convert();
  harvest(); // the names already linked on the page: their numbers are remembered
  const hits = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (n.parentElement && n.parentElement.closest('script, style, a')) continue;
    if (/Player #\d+|Faction member \S/i.test(n.nodeValue)) hits.push(n);
    else if (n.parentElement && n.parentElement.closest('.fl-msg, td[width="80%"]') && (RANK.test(n.nodeValue) || MONEY.test(n.nodeValue))) hits.push(n);
  }
  const link = (id, name) => {
    const a = document.createElement('a');
    a.href = 'index.php?cmd=profile&player_id=' + id;
    a.textContent = name;
    return a;
  };
  hits.forEach((node) => {
    if (plain(node)) return;
    const frag = document.createDocumentFragment();
    const text = node.nodeValue;
    let last = 0;
    ID.lastIndex = 0;
    for (let m; (m = ID.exec(text));) {
      if (m[1]) { // "Player #1234567": the number becomes the name
        frag.append(text.slice(last, m.index));
        const a = link(m[1], knownName(m[1]) || 'Player #' + m[1]);
        if (!knownName(m[1])) nameFor(m[1]).then((nm) => { if (nm) a.textContent = nm; });
        frag.append(a);
      } else { // "Faction member Name": the name is linked
        const name = m[2].replace(/[.,;:]+$/, '');
        const start = m.index + 'Faction member '.length;
        frag.append(text.slice(last, start), nameLink(name));
        last = start + name.length;
        ID.lastIndex = last;
        continue;
      }
      last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  });
}
