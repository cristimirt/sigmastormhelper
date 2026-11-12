import { findFrame, frameRow } from '../core/page.js';
import { S } from '../core/state.js';
import { cssUrl, https } from '../core/util.js';
import { mel } from './dom.js';

// The page around the content for the Modern layout: a fixed background and the page as divs. The game's table (header, the
// three columns, the bottom caps, the bottom banner) is replaced by one grid of divs; the content of its cells moves into them
// (the game's scripts and the helper find things by id, which does not change). The content frame, the game's second table (a top
// picture, two border columns, the content cell, a bottom picture), becomes divs too. The tables are kept out of the page and
// come back with the Original layout.
let built = null; // { table, page, cells: [header, left, center, right], content: { table, cf, cell } }

// The content frame as divs: .ssh-cf > .cf-top, .cf-mid (.cf-l, .cf-body, .cf-r), .cf-bot. The pictures are the game's own, read
// from the table; the content of its middle cell (the page itself) moves into .cf-body.
function frameContent(center) {
  const table = findFrame(center);
  if (!table) return null;
  const mi = frameRow(table); // the row with the page (a spacer row above the top picture is left out)
  const r0 = table.rows[mi - 1];
  const r1 = table.rows[mi];
  const r2 = table.rows[table.rows.length - 1];
  const extra = [...table.rows].slice(mi + 1, -1); // rows the game puts between the columns and the bottom picture (an alert): they belong to the page
  const imgOf = (cell) => { const i = cell && cell.querySelector('img'); return i ? i.getAttribute('src') : ''; };
  const cf = mel('div', 'ssh-cf');
  const top = mel('div', 'cf-top');
  top.style.backgroundImage = cssUrl(imgOf(r0.cells[0]));
  const mid = mel('div', 'cf-mid');
  const l = mel('div', 'cf-l');
  l.style.backgroundImage = cssUrl(imgOf(r1.cells[0])) + ',' + cssUrl(r1.cells[0].getAttribute('background'));
  const body = mel('div', 'cf-body');
  body.style.backgroundImage = cssUrl(r1.cells[1].getAttribute('background'));
  const r = mel('div', 'cf-r');
  r.style.backgroundImage = cssUrl(imgOf(r1.cells[2])) + ',' + cssUrl(r1.cells[2].getAttribute('background'));
  const bot = mel('div', 'cf-bot');
  bot.style.backgroundImage = cssUrl(imgOf(r2.cells[0]));
  mid.append(l, body, r);
  cf.append(top, mid, bot);
  body.append(...r1.cells[1].childNodes);
  extra.forEach((r) => body.append(...r.cells[0].childNodes));
  table.replaceWith(cf);
  return { table, cf, cell: r1.cells[1], body };
}

export function buildFrame() {
  const m = document.getElementById('mainContentDiv');
  // the game's page table has four rows (header, columns, bottom caps, banner); a page like "this mission has not been started" has three
  // (no caps row) and a right column that is only a picture: the frame is built the same way, the caps are left out
  if (built || !m || !m.rows || m.rows.length < 3 || m.rows[1].cells.length < 3) return false;
  const r0 = m.rows[0];
  const r1 = m.rows[1];
  const r2 = m.rows.length >= 4 ? m.rows[2] : null;
  const r3 = m.rows[m.rows.length - 1];
  const page = mel('div');
  page.id = 'ssh-page';
  const part = (cls) => { const d = mel('div', cls); page.append(d); return d; };
  const hd = part('ssh-hd');
  const left = part('ssh-left');
  const center = part('ssh-center');
  const right = part('ssh-right');
  const lb = mel('div', 'ssh-lb'); // the bottom caps belong to the sidebars: they end in them
  const rb = mel('div', 'ssh-rb');
  const banner = part('ssh-banner');
  const cells = [r0.cells[0], r1.cells[0], r1.cells[1], r1.cells[2]];
  [hd, left, center, right].forEach((d, i) => d.append(...cells[i].childNodes));
  left.append(lb);
  right.append(rb);
  const content = frameContent(center);
  // the pictures the game puts on the cells of the bottom rows
  const bgOf = (c) => https(c.style.backgroundImage && c.style.backgroundImage !== 'none' ? c.style.backgroundImage : c.getAttribute('background') ? 'url("' + c.getAttribute('background') + '")' : '');
  if (r2) {
    lb.style.backgroundImage = bgOf(r2.cells[0]);
    rb.style.backgroundImage = bgOf(r2.cells[r2.cells.length - 1]);
  }
  banner.style.backgroundImage = bgOf(r3.cells[0]);
  m.replaceWith(page);
  built = { table: m, page, cells, content };
  return true;
}

// The game's tables again, with the content as it is now.
export function unbuildFrame() {
  if (!built) return;
  const { table, page, cells, content } = built;
  page.querySelectorAll('.ssh-lb, .ssh-rb').forEach((e) => e.remove());
  if (content) {
    content.cell.append(...content.body.childNodes);
    content.cf.replaceWith(content.table);
  }
  [page.querySelector('.ssh-hd'), page.querySelector('.ssh-left'), page.querySelector('.ssh-center'), page.querySelector('.ssh-right')].forEach((d, i) => cells[i].append(...d.childNodes));
  page.replaceWith(table);
  built = null;
}

export function frameCss(contentBg) {
  // the HD picture comes with the helper; without its site (no loader) the game's own background stays
  const bg = S.base ? S.base + 'media/bgalt2_hd.png' : 'https://cdn.sigmastorm.com/skin/bgalt2.jpg';
  const P = '#ssh-page';
  return 'html.ssh-modern,html.ssh-modern body{background:#000 url("' + bg + '") no-repeat center top / cover fixed}' +
    P + '{display:grid;grid-template-columns:140px 723px 140px;width:1003px;margin:0 auto;align-items:stretch}' +
    P + ' .ssh-hd{grid-column:1/-1;height:150px;position:relative}' +
    // a sidebar is a column: its widgets, then its bottom cap (42 px) at its foot
    P + ' .ssh-left,' + P + ' .ssh-right{display:flex;flex-direction:column;background:url("https://cdn.sigmastorm.com/skin/sidebar_bg.gif") repeat-y;min-width:0}' +
    // the middle column is as dark as the content, also where a short page leaves it empty (the background must not show
    // through between the sidebars)
    P + ' .ssh-center{background:#080a0a ' + contentBg + ';min-width:0}' +
    // the content frame: 14 px top picture, 27 px borders around the content, 5 px bottom picture (723 px wide, like the column)
    // it grows down to the bottom of the page, so the frame (its borders and its background) never ends above the sidebars' end
    P + ' .ssh-center{display:flex;flex-direction:column;margin-bottom:12px}' + // a small gap above the banner
    P + ' .ssh-cf{width:723px;flex:1;display:flex;flex-direction:column}' +
    P + ' .ssh-center>section:has(>.ssh-cf){flex:1;display:flex;flex-direction:column}' + // the world page: the game wraps the frame in a section (with its small forms)
    P + ' .cf-top{height:14px;background-repeat:no-repeat;background-position:0 0}' +
    P + ' .cf-mid{display:grid;grid-template-columns:27px 669px 27px;flex:1}' +
    P + ' .cf-l{background-repeat:no-repeat,repeat-y;background-position:right top,0 0}' +
    P + ' .cf-r{background-repeat:no-repeat,repeat-y;background-position:left top,0 0}' +
    P + ' .cf-body{min-width:0;background-repeat:repeat}' +
    // the world page fills it: its lower panels grow and its footer picture sits at the bottom
    P + ' .cf-body:has(>#ssh-wp){display:flex;flex-direction:column}' +
    P + ' .cf-body>#ssh-wp~br{display:none}' + // the game's line break under its content
    P + ' .cf-bot{height:5px;background-repeat:no-repeat;background-position:0 0}' +
    P + ' .ssh-lb,' + P + ' .ssh-rb{flex:none;order:2;height:42px;background-repeat:no-repeat}' +
    P + ' .ssh-banner{grid-column:1/-1;height:85px;background-repeat:no-repeat}' +
    // The game's pages put a 640x54 header picture (bank_header.jpg, ...) and footer picture on a cell that is 54 px high plus 20 px of
    // padding above and below, so the picture was drawn twice (it repeats). One picture, in its own 54 px; the footer is the helper's own.
    P + ' .ssh-center td[background*="_header.jpg"],' + P + ' .ssh-center td[background*="/skin/header_"],' + P + ' .ssh-center td[background*="large_content_footer"]{padding-top:0!important;padding-bottom:0!important;height:54px;background-repeat:no-repeat!important;background-position:center top!important}' +
    (S.base ? P + ' .ssh-center td[background*="large_content_footer"]{background-image:url("' + S.base + 'media/large_content_footer.png")!important}' : '');
}
