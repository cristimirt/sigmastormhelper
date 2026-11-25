import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { steelContainer } from '../layout/steel.js';

// A faction's page (cmd=guild&subcmd=view&guild_id=...) for the Modern layout: the steel container (layout/steel.js) with the faction's
// name, the links under it, and the game's two columns made of divs: logo, statistics, bank, structures and artifacts on the left,
// history and members on the right. Links, pictures and tooltips are copies of the game's. The game's table stays in the page, hidden in
// the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-fp]{display:none!important}#ssh-fp{display:none}html.ssh-modern #ssh-fp{display:block}' +
  '#ssh-fp .ssh-content-body{padding-top:12px;padding-bottom:14px}' +
  '#ssh-fp .fp-links{text-align:center;margin:0 14px 10px}' +
  '#ssh-fp .fp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:0 8px;margin:0 12px;align-items:start;text-align:left}' +
  '#ssh-fp .fp-sec{margin-bottom:12px}#ssh-fp .fp-t{padding:3px 8px;background:#313130;font-weight:bold;color:#fff;margin-bottom:4px}' +
  '#ssh-fp .fp-logo{position:relative;width:200px;height:200px;margin:0 auto 6px}#ssh-fp .fp-logo i{position:absolute;left:0;top:0;right:0;bottom:0}' +
  '#ssh-fp .fp-site{text-align:center;overflow-wrap:anywhere}' +
  '#ssh-fp .fp-stat{display:flex;justify-content:space-between;gap:8px;padding:2px 8px}#ssh-fp .fp-stat>:last-child{font-weight:bold;color:#fff}' +
  '#ssh-fp .fp-bank{display:flex;justify-content:center;align-items:center;gap:6px;padding:2px 8px;font-size:14px;font-weight:bold;color:#fff}' +
  '#ssh-fp .fp-st,#ssh-fp .fp-art,#ssh-fp .fp-mem{padding:3px 6px;border-bottom:1px solid #1c2020}' +
  '#ssh-fp .fp-st{display:grid;grid-template-columns:minmax(0,1fr) 34px 52px;gap:6px;align-items:center}' +
  '#ssh-fp .fp-st>:nth-child(2){text-align:center}#ssh-fp .fp-st>:nth-child(3){display:flex;justify-content:flex-end;align-items:center;gap:2px}' +
  '#ssh-fp .fp-art{display:flex;align-items:center;gap:8px}#ssh-fp .fp-art img{flex:none}' +
  '#ssh-fp .fp-mem{display:grid;grid-template-columns:minmax(0,1.3fr) 30px minmax(0,1fr) auto;gap:5px;align-items:center}' +
  '#ssh-fp .fp-mem>:nth-child(2),#ssh-fp .fp-mem>:nth-child(3){text-align:center;overflow-wrap:anywhere}#ssh-fp .fp-mem>:last-child{text-align:right}' +
  '#ssh-fp .fp-who{display:flex;align-items:center;gap:4px;min-width:0}#ssh-fp .fp-who img{flex:none}#ssh-fp .fp-who a{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '#ssh-fp .fp-head{background:#212323;font-weight:bold;color:#fff}' +
  '#ssh-fp .fp-st:not(.fp-head):hover,#ssh-fp .fp-mem:not(.fp-head):hover{background:#171a1a}' +
  '#ssh-fp .fp-text{padding:2px 8px;overflow-wrap:anywhere;overflow-x:auto}#ssh-fp .fp-text img{max-width:100%;height:auto}';

export const isFactionPage = () => /[?&]cmd=guild(?:&|$)/.test(location.search) && /[?&]subcmd=view(?:&|$)/.test(location.search) &&
  !!document.querySelector('td[width="50%"] td[bgcolor="#313130"]');

// the nodes of a cell, copied into d; the tables the game wraps single things in (a name with its picture, an amount with its coin) are
// taken apart: only what is in their cells is kept
const take = (from, d) => {
  from.childNodes.forEach((n) => {
    if (n.nodeName === 'TABLE') [...n.rows].forEach((r) => [...r.cells].forEach((c) => take(c, d)));
    else if (n.nodeType === 1 || n.textContent.trim()) d.append(n.cloneNode(true));
  });
  return d;
};
const cellDiv = (cell, cls) => take(cell, mel('div', cls));

// a list of the game's rows as rows of divs: the entries are the rows marked with `mark`, `head` the row of titles above them
function rows(content, mark, cls, build) {
  const first = content.querySelector('tr[' + mark + ']');
  const table = first.closest('table');
  const out = [];
  const title = table.rows[0];
  if (title && !title.hasAttribute(mark) && title.cells.length > 1 && title.textContent.trim()) out.push(build([...title.cells], mel('div', cls + ' fp-head'), true));
  table.querySelectorAll(':scope > tbody > tr[' + mark + '], :scope > tr[' + mark + ']').forEach((tr) => out.push(build([...tr.cells], mel('div', cls), false)));
  return out;
}

function sectionBody(content) {
  if (content.querySelector('td[id^="logo_"]')) {
    const logo = mel('div', 'fp-logo');
    content.querySelectorAll('td[id^="logo_"][background]').forEach((td) => {
      const layer = mel('i');
      layer.style.backgroundImage = 'url("' + td.getAttribute('background').replace(/"/g, '%22') + '")';
      layer.style.backgroundRepeat = 'no-repeat';
      logo.append(layer);
    });
    const site = mel('div', 'fp-site');
    content.querySelectorAll('a[href]').forEach((a) => site.append(a.cloneNode(true)));
    return site.childNodes.length ? [logo, site] : [logo];
  }
  if (content.querySelector('tr[data-faction-structure]')) {
    return rows(content, 'data-faction-structure', 'fp-st', (cells, row) => { cells.forEach((c) => row.append(cellDiv(c))); return row; });
  }
  if (content.querySelector('tr[data-faction-relic]')) {
    return rows(content, 'data-faction-relic', 'fp-art', (cells, row) => { cells.forEach((c) => row.append(cellDiv(c))); return row; });
  }
  if (content.querySelector('tr[data-faction-member]')) {
    // the cells: the online light, the name with its class picture, level, rank, XP. The titles' first cell covers the first two.
    return rows(content, 'data-faction-member', 'fp-mem', (cells, row, head) => {
      const who = mel('div', 'fp-who');
      cells.slice(0, head ? 1 : 2).forEach((c) => take(c, who));
      row.append(who, ...cells.slice(head ? 1 : 2).map((c) => cellDiv(c)));
      return row;
    });
  }
  const table = content.querySelector(':scope > td > table');
  const lines = table ? [...table.rows].filter((r) => r.textContent.trim() || r.querySelector('img')) : [];
  // statistics: a name and its number on every row
  if (lines.length > 0 && lines.every((r) => r.cells.length === 2 && /:/.test(r.cells[0].textContent))) {
    return lines.map((r) => { const d = mel('div', 'fp-stat'); [...r.cells].forEach((c) => d.append(cellDiv(c))); return d; });
  }
  // the bank: one amount and its coin
  if (lines.length === 1 && lines[0].cells.length === 2 && /^[\d,.\s]+$/.test(lines[0].textContent.trim())) return [take(content.cells[0], mel('div', 'fp-bank'))];
  // text (the history): what the faction wrote, as it is
  const text = mel('div', 'fp-text');
  const only = lines.length === 1 && lines[0].cells.length === 1 ? lines[0].cells[0] : content.cells[0];
  only.childNodes.forEach((n) => text.append(n.cloneNode(true)));
  return [text];
}

// A column of the game: a title row (on a darker background) before each section's content.
function column(table) {
  const col = mel('div');
  let sec = null;
  [...table.rows].forEach((tr) => {
    const c = tr.cells[0];
    if (!c) return;
    if (c.hasAttribute('bgcolor') && !tr.querySelector('table')) {
      sec = mel('div', 'fp-sec');
      const t = mel('div', 'fp-t');
      t.textContent = tr.textContent.replace(/\s+/g, ' ').trim();
      sec.append(t);
      col.append(sec);
    } else if (sec && (tr.querySelector('table, img, a') || tr.textContent.trim())) sec.append(...sectionBody(tr));
  });
  return col;
}

export function initFactionPage() {
  const mark = document.querySelector('td[width="50%"] td[bgcolor="#313130"]');
  const colCell = mark && mark.closest('table').closest('td[width="50%"]');
  const main = colCell && colCell.closest('table'); // the name, the links and the two columns
  const table = main && main.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-fp')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const all = [...main.rows];
  const at = all.indexOf(colCell.parentElement);
  const name = all[0].textContent.replace(/\s+/g, ' ').trim();
  const page = steelContainer({ title: name });
  page.id = 'ssh-fp';
  const cs = getComputedStyle(colCell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;

  // under the name: the links ("Join this Faction")
  all.slice(1, at).forEach((tr) => {
    if (!tr.textContent.trim() && !tr.querySelector('img, input')) return;
    page.body.append(take(tr.cells[0], mel('div', 'fp-links')));
  });

  const cols = mel('div', 'fp-cols');
  [...all[at].cells].forEach((c) => {
    const t = c.querySelector(':scope > table');
    if (t) cols.append(column(t));
  });
  page.body.append(cols);
  table.setAttribute('data-ssh-fp', '1');
  table.after(page);
  // the game's answer may be a box in the hidden table: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
