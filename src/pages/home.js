import { cssUrl } from '../core/util.js';
import { mel, proxify, proxyKids } from '../layout/dom.js';

// The Home page (index.php) for the Modern layout, made of divs. The game draws it with a table of two columns, every panel (Updates,
// Bulletin Board, Featured Faction, Live Comms) being a table with a tiled background, header and footer pictures and tables inside
// for the news and the messages. Here: .ssh-home > .hm-col > .hm-p (a panel) with .hm-img (a picture), .hm-news (.hm-item: .hm-ih the
// head line, .hm-tx the text, .hm-sep a line), .hm-msgs (a grid of names and messages) and .hm-note (a line of text or a link).
// The game's table stays in the page, hidden in the Modern layout (the copies keep the links, pictures and tooltips; form controls are
// proxies of the originals), so switching back to the Original layout needs no work.

const CSS = '#ssh-home{display:none;justify-content:center;align-items:flex-start;gap:5px}' +
  'html.ssh-modern #ssh-home{display:flex}html.ssh-modern [data-ssh-home]{display:none!important}' +
  '#ssh-home .hm-col{display:flex;flex-direction:column;gap:8px;flex:none}' +
  '#ssh-home .hm-img{line-height:0;text-align:center}#ssh-home .hm-img img{display:inline-block;max-width:100%}' +
  '#ssh-home .hm-p{box-sizing:border-box}#ssh-home .hm-news{padding:4px 17px}' +
  '#ssh-home .hm-ih{display:flex;align-items:flex-start;padding-top:4px}' +
  '#ssh-home .hm-ih>div:nth-child(2){flex:1;min-width:0;padding-left:4px}#ssh-home .hm-ih>div:last-child:not(:first-child){margin-left:auto}' +
  '#ssh-home .hm-ih nobr{white-space:normal}' +
  '#ssh-home .hm-tx{padding:6px 0 4px;overflow-wrap:anywhere}' +
  '#ssh-home .hm-sep{height:1px;margin:8px 0}' +
  '#ssh-home .hm-msgs{display:grid;grid-template-columns:auto 1fr;column-gap:6px;width:216px;margin:0 auto;padding:4px 0}' +
  '#ssh-home .hm-msgs>div{padding:2px 0;overflow-wrap:anywhere}#ssh-home .hm-msgs>.hm-sep{grid-column:1/-1;padding:0;margin:3px 0}' +
  '#ssh-home .hm-note{width:224px;margin:0 auto;padding:6px 0;text-align:center}' +
  '#ssh-home .hm-note>div+div{margin-top:6px}';

const filled = (td) => !!(td.textContent.trim() || td.querySelector('img, input, a'));

// A picture row: a cell with nothing but a picture (the header and footer of a panel).
const isPicture = (td) => !td.textContent.trim() && td.querySelector('img') && !td.querySelector('table, input, a');

const line = (td) => { const s = mel('div', 'hm-sep'); s.style.background = td.getAttribute('bgcolor'); return s; };

// The news: a head line row (icon, title and date, feed link), a text row, and the lines between the items.
function news(t) {
  const box = mel('div', 'hm-news');
  [...t.rows].forEach((tr) => {
    const cells = [...tr.cells];
    if (cells.length > 1) {
      const ih = mel('div', 'hm-ih');
      cells.forEach((td) => ih.append(proxyKids(td, mel('div'))));
      box.append(ih);
    } else if (cells[0] && cells[0].getAttribute('bgcolor') && !filled(cells[0])) box.append(line(cells[0]));
    else if (cells[0] && filled(cells[0])) box.append(proxyKids(cells[0], mel('div', 'hm-tx')));
  });
  return box;
}

// The Live Comms messages: the name (a link) and the message in two columns, with a line between messages.
function messages(t) {
  const box = mel('div', 'hm-msgs');
  [...t.rows].forEach((tr) => {
    const cells = [...tr.cells];
    if (cells.length > 1) cells.forEach((td) => box.append(proxyKids(td, mel('div'))));
    else if (cells[0] && cells[0].getAttribute('bgcolor') && !filled(cells[0])) box.append(line(cells[0]));
  });
  return box;
}

// Anything else: the filled cells of the table, one line each.
function note(t) {
  const box = mel('div', 'hm-note');
  [...t.querySelectorAll('td')].filter((td) => !td.querySelector('td') && filled(td)).forEach((td) => box.append(proxyKids(td, mel('div'))));
  return box;
}

// The game's table of the left column holds both panels (Updates, Bulletin Board) one under the other with a single footer picture at
// the end: a picture row that comes after content and is followed by more is the head of the next panel, and every panel gets the footer.
function panels(t) {
  const rows = [...t.rows].filter((tr) => tr.cells[0]);
  const last = rows[rows.length - 1];
  const foot = last && isPicture(last.cells[0]) ? last.cells[0] : null;
  const list = [];
  let p = null;
  let filledP = false;
  const open = () => {
    p = mel('div', 'hm-p');
    p.style.backgroundImage = cssUrl(t.getAttribute('background'));
    if (/^\d+$/.test(t.getAttribute('width') || '')) p.style.width = t.getAttribute('width') + 'px';
    filledP = false;
    list.push(p);
  };
  const picture = (td) => {
    const im = proxyKids(td, mel('div', 'hm-img'));
    if (td.getAttribute('bgcolor')) im.style.background = td.getAttribute('bgcolor');
    return im;
  };
  open();
  rows.forEach((tr) => {
    const td = tr.cells[0];
    if (isPicture(td)) {
      if (td === foot) return; // added at the end of every panel
      if (filledP) { if (foot) p.append(picture(foot)); open(); } // the head of the next panel
      p.append(picture(td));
      return;
    }
    filledP = true;
    [...td.childNodes].forEach((n) => {
      if (n.nodeType !== 1) { if (n.textContent.trim()) p.append(proxify(n)); return; }
      if (n.tagName !== 'TABLE') { if (filled(n) || n.tagName === 'INPUT') { const w = mel('div', 'hm-note'); w.append(proxify(n)); p.append(w); } return; }
      if (n.querySelector('.NEWS_SUBJECT')) p.append(news(n));
      else if (n.classList.contains('shoutbox')) p.append(messages(n));
      else p.append(note(n));
    });
  });
  if (foot) p.append(picture(foot));
  return list;
}

export function initHome() {
  const first = document.querySelector('table[background*="latestnews_bg"]');
  const outer = first && first.parentElement.closest('table');
  if (!outer || document.getElementById('ssh-home')) return;
  const cols = [...outer.rows[0].cells].filter((td) => td.querySelector('table[background]'));
  if (!cols.length) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const root = mel('div');
  root.id = 'ssh-home';
  cols.forEach((td) => {
    const col = mel('div', 'hm-col');
    [...td.querySelectorAll('table[background]')].filter((t) => t.closest('td') === td).forEach((t) => col.append(...panels(t)));
    root.append(col);
  });
  outer.setAttribute('data-ssh-home', '1');
  outer.after(root);
}
