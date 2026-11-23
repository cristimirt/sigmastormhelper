import { S } from '../core/state.js';
import { cssUrl } from '../core/util.js';
import { mel } from './dom.js';
import { tableToDivs } from './tablediv.js';

// The steel container: the frame most of the game's content pages have (a title bar, a body on a background that repeats down, a footer),
// one set of rules for all pages that use it. It sits in .cf-body:
//
//   .ssh-content
//     .ssh-content-header   the title bar: a picture with the title baked in (the game's own, "header" = its address), or the helper's
//                           steel bar (media/page_header_steel.png) with the title as text on it ("title")
//     .ssh-content-body     the page's content (the repeating background is on .ssh-content, behind the three parts)
//     .ssh-content-footer   the helper's footer picture
//
//   const box = steelContainer({ title: 'Faction Inventory' });        // the helper's bar and a title
//   const box = steelContainer({ header: 'https://.../header_x.jpg' }); // the game's bar, the title is in the picture
//   const box = steelContainer({ header: 'https://.../header_x.jpg', glass: true }); // the game's glass header (a mission's page)
//   box.body.append(...);  cfBody.append(box);

const SKIN = 'https://cdn.sigmastorm.com/skin/';
// The game's title bars that are glass (dark blue); the others are steel. The class `glass` on the header says it (see steelContainer).
const GLASS = /(bank_header|header_(artifacts|clear|engineering|factionmanage|ignorelist|missiondetails|msgoutbox|recruitment|skillguide|transitportal))\.jpg/;

export function steelCss() {
  if (document.getElementById('ssh-steel-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-steel-css';
  const media = S.base ? S.base + 'media/' : '';
  s.textContent =
    (media ? "@font-face{font-family:'Marcellus';font-weight:400;font-style:normal;font-display:swap;src:url('" + media + "marcellus.ttf') format('truetype')}" : '') +
    '.ssh-content{width:640px;max-width:100%;margin:0 auto;background:url("' + SKIN + 'large_content_bg.jpg") repeat-y center top}' + // behind all three parts: the pictures of the bar and the footer have see-through edges
    '.ssh-content-body{padding:0 20px}' +
    '.ssh-content-header,.ssh-content-footer{height:54px;background-repeat:no-repeat;background-position:center top}' +
    '.ssh-content-header{display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding-bottom:6px}' +
    '.ssh-content-header span{display:inline-block;transform:scaleX(.93);white-space:nowrap;text-transform:uppercase;' + // the title is a little narrower than the font makes it, like the game's own
    "font:20px/1 Marcellus,'Times New Roman',serif;color:#161412;-webkit-text-stroke:.4px #161412;text-shadow:0 1px 0 rgba(200,200,200,.18)}" +
    '.ssh-content-header.plain span{color:#fff;-webkit-text-stroke:0;text-shadow:none}' +
    '.ssh-content-footer{background-image:' + (media ? cssUrl(media + 'large_content_footer.png') : cssUrl(SKIN + 'large_content_footer.jpg')) + ';background-size:640px auto}';
  document.head.append(s);
}

export function steelContainer({ header, title, glass, bare } = {}) {
  steelCss();
  const box = mel('div', 'ssh-content');
  if (bare) { // only the body on its background (a pop-up): no title bar, no footer
    box.body = mel('div', 'ssh-content-body');
    box.append(box.body);
    return box;
  }
  const hd = mel('div', 'ssh-content-header');
  if (glass || (header && GLASS.test(header))) hd.classList.add('glass'); // the glass header: the game's own dark blue picture with the title baked in
  if (header) hd.style.backgroundImage = cssUrl(header);
  else if (S.base) hd.style.backgroundImage = cssUrl(S.base + 'media/page_header_steel.png');
  else hd.classList.add('plain'); // no pictures of the helper's own (no loader): the title on the page's dark colour
  if (title && !header) {
    const t = mel('span');
    t.textContent = title;
    hd.append(t);
  }
  const body = mel('div', 'ssh-content-body');
  const ft = mel('div', 'ssh-content-footer');
  box.append(hd, body, ft);
  box.body = body;
  return box;
}

// The steel container made from the game's table of a page (640 wide: a row with the title bar, the rows of the page, a row with the footer):
// the title bar's picture becomes the header, the footer row is left out (the container has its own), the other rows are converted to divs
// (layout/tablediv.js) in the body. -> the container (.body, and .grid: the converted rows)
export function steelFromTable(table, opts = {}) {
  const head = table.querySelector('td[background*="header_"], td[background*="bank_header"], td[background*="instance_banner"], td[style*="header_"]');
  const m = head && ((head.getAttribute('background') || '') || ((head.getAttribute('style') || '').match(/url\(["']?([^"')]+)/) || [])[1]);
  const box = steelContainer({ header: m, ...opts });
  const work = table.cloneNode(true);
  work.removeAttribute('background');
  work.querySelectorAll('td[background*="header_"], td[background*="bank_header"], td[background*="instance_banner"], td[style*="header_"], td[background*="large_content_footer"]').forEach((td) => {
    const tr = td.parentElement;
    if (tr && tr.closest('table') === work && tr.cells.length === 1) tr.remove();
  });
  box.grid = tableToDivs(work);
  box.body.append(box.grid);
  return box;
}
