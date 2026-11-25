import { S } from '../core/state.js';
import { cssUrl } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';

// The Buy Crystals page (cmd=points&subcmd=buy) for the Modern layout. The game sends it as a bare table (a title and a sentence: purchases
// are unavailable), without the content frame the other pages have: the frame is made here (the same divs and pictures, styled by
// layout/frame.js), with the steel container (layout/steel.js, the helper's steel header with the page's title) in it. Only a page of plain text
// is converted: should the game offer purchases there again, its own page is left as it is. The game's table stays in the page, hidden in
// the Modern layout, so the Original layout is untouched.

const SKIN = 'https://cdn.sigmastorm.com/skin/';
const CSS = 'html.ssh-modern [data-ssh-bc]{display:none!important}#ssh-bc{display:none}html.ssh-modern #ssh-bc{display:block}' +
  '#ssh-bc p{margin:20px 20px 24px;text-align:center}';

const gameTable = () => {
  if (!/[?&]cmd=points(?:&|$)/.test(location.search) || !/[?&]subcmd=buy(?:&|$)/.test(location.search)) return null;
  const center = document.querySelector('#ssh-page .ssh-center');
  const t = center && center.querySelector(':scope > table[width="640"]');
  return t && t.querySelector('h2') && !t.querySelector('form, input, iframe, script, a') ? t : null;
};

export const isBuyCrystals = () => !!gameTable();

function frame() {
  const pic = (...names) => names.map((n) => cssUrl(SKIN + n)).join(',');
  const part = (cls, bg) => { const d = mel('div', cls); if (bg) d.style.backgroundImage = bg; return d; };
  const cf = part('ssh-cf');
  const mid = part('cf-mid');
  const body = part('cf-body', pic('inner_bg.jpg'));
  mid.append(part('cf-l', pic('inner_lefttop.jpg', 'inner_left.jpg')), body, part('cf-r', pic('inner_righttop.jpg', 'inner_right.jpg')));
  cf.append(part('cf-top', pic('inner_top.jpg')), mid, part('cf-bot', pic('inner_bottom.jpg')));
  return { cf, body };
}

export function initBuyCrystals() {
  const table = gameTable();
  if (!table || S.layout !== 'modern' || document.getElementById('ssh-bc')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ title: table.querySelector('h2').textContent.trim() });
  page.id = 'ssh-bc';
  const cs = getComputedStyle(table.querySelector('p') || table); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  table.querySelectorAll('p').forEach((p) => page.body.append(p.cloneNode(true)));
  const { cf, body } = frame();
  table.before(cf);
  table.setAttribute('data-ssh-bc', '1');
  body.append(table, page);
}
