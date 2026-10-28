import { pageParts } from '../core/page.js';
import { S } from '../core/state.js';
import { attachViewer } from '../game/viewer.js';
import { mel, proxify } from './dom.js';

// The world page for the Modern layout, made of divs from the game's table: the title bar, the map (the helper's own viewer),
// the two strips (Quick Links, Active Buffs), the Location Details and Local Comms panels, and the footer. The game's table stays
// in the page, hidden: the helper reads the map and the actions from it. The pieces are copies of the game's (links, pictures and
// tooltips come along; the chat is its own page in a frame, which loads again). The page is built again after every move, because
// the page content is replaced with the new one then.

// the picture on a title / bar cell: a style (background: url(...)) or the background attribute
const bgOf = (el) => ((el.getAttribute('style') || '').match(/url\(["']?([^)"']*)["']?\)/) || [])[1] || el.getAttribute('background') || '';
const url = (u) => (u ? 'url("' + u + '")' : 'none');

const gameTable = (body) => [...body.querySelectorAll('table[background*="large_content_bg"]')].find((t) => t.querySelector('#mapDiv'));

export function buildWorldPage() {
  const p = pageParts();
  if (!p || !p.modern) return null;
  p.body.querySelectorAll('#ssh-wp').forEach((e) => e.remove());
  const table = gameTable(p.body);
  const low = table && table.querySelector('#mapDiv').closest('table'); // the table of the strips and panels under the map
  if (!low || !low.rows[0] || low.rows[0].cells.length < 2) return null;
  const [lc, rc] = low.rows[0].cells;
  const mainTd = low.closest('td');

  const root = mel('div');
  root.id = 'ssh-wp';
  const title = mel('div', 'wp-t');
  title.style.backgroundImage = url(bgOf(table.rows[0].cells[0]));
  const map = mel('div', 'wp-m');
  const lowBox = mel('div', 'wp-low');
  const foot = mel('div', 'wp-f');
  foot.style.backgroundImage = url(bgOf(table.rows[table.rows.length - 1].cells[0]));

  // anything else the game puts above the map (a message, say) comes along
  const extra = mel('div', 'wp-x');
  [...mainTd.childNodes].forEach((n) => {
    if (n === low || n.id === 'ssh-map' || (n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName)) || (n.nodeType === 3 && !n.textContent.trim())) return;
    extra.append(proxify(n));
  });

  // the strips: a row of items (a link with its picture, with a number or a time under it)
  const left = mel('div', 'wp-left');
  ['quicklinks_bg', 'activebuffs_bg'].forEach((k) => {
    const src = lc.querySelector('table[style*="' + k + '"]');
    if (!src) return;
    const strip = mel('div', 'wp-strip ' + (k === 'quicklinks_bg' ? 'ql' : 'ab'));
    strip.style.backgroundImage = url(bgOf(src));
    [...src.querySelectorAll('td')].filter((td) => !td.querySelector('td') && (td.querySelector('a, img') || td.textContent.trim())).forEach((td) => {
      const it = mel('div', 'wp-i');
      td.childNodes.forEach((n) => it.append(proxify(n)));
      strip.append(it);
    });
    left.append(strip);
  });

  // Location Details (the list of what is here is in the helper's floating Action List) and Local Comms
  const right = mel('div', 'wp-right');
  const rt = rc.querySelector(':scope > table');
  const bar = (k, cls) => {
    const td = rt && rt.querySelector('td[background*="' + k + '"]');
    if (!td) return null;
    const b = mel('div', 'wp-bar ' + cls);
    b.style.backgroundImage = url(td.getAttribute('background'));
    return b;
  };
  const loc = bar('location_header', 'loc');
  const chatBar = bar('chatbox_header', 'chat');
  if (loc) right.append(loc);
  if (chatBar) {
    right.append(chatBar);
    const cb = mel('div', 'wp-chat');
    const small = rt.querySelector('small');
    const frame = rt.querySelector('iframe');
    if (small) cb.append(proxify(small));
    if (frame) { const f = mel('div', 'wp-frame'); f.append(proxify(frame)); cb.append(f); }
    right.append(cb);
  }

  lowBox.append(left, right);
  root.append(title);
  if (extra.childNodes.length) root.append(extra);
  root.append(map, lowBox, foot);
  table.setAttribute('data-ssh-orig', '1');
  table.parentNode.insertBefore(root, table);
  if (S.viewer) {
    map.append(S.viewer);
  }
  return root;
}

// Back to the game's own page content: its table shows again and the viewer goes back where the game's map was.
export function unbuildWorldPage() {
  const r = document.getElementById('ssh-wp');
  if (!r) return;
  const t = r.nextElementSibling;
  r.remove();
  if (t && t.hasAttribute('data-ssh-orig')) t.removeAttribute('data-ssh-orig');
  if (S.viewer) attachViewer();
}

export const worldCss = (contentBg) => {
  const W = '#ssh-wp ';
  return '#ssh-wp{width:640px;margin:0 auto;background:' + contentBg + '}' +
    W + '.wp-t{height:54px;background-repeat:no-repeat}' +
    W + '.wp-m{width:605px;margin:0 auto}' +
    // 192 px under the map, as the game's table leaves: the strips and panels sit at their own offsets in it
    W + '.wp-low{display:flex;align-items:flex-start;box-sizing:border-box;height:192px;padding-left:33px}' +
    W + '.wp-left{width:341px;margin:27px 22px 0 0}' +
    W + '.wp-strip{box-sizing:border-box;width:341px;height:60px;display:flex;align-items:flex-start;padding-top:20px;background-repeat:no-repeat;font:8pt tahoma,sans-serif;color:#fff}' +
    // the game's table shrinks its 70 px cells to what fits: 50 px for the first, 44 px for the others, 5 px apart
    W + '.wp-strip.ql{gap:5px;padding-left:24px}' + W + '.wp-strip.ql .wp-i{width:44px}' + W + '.wp-strip.ql .wp-i:first-child{width:50px}' + W + '.wp-strip.ab{justify-content:center;gap:8px}' +
    W + '.wp-i{text-align:center}' + W + '.wp-i img{border:0}' +
    W + '.wp-right{width:218px;margin-top:17px}' +
    W + '.wp-bar{width:218px;height:19px;background-repeat:no-repeat}.wp-bar.loc{margin-bottom:10px}' +
    W + '.wp-chat{padding-top:7px;font:8pt tahoma,sans-serif;color:#fff}.wp-chat small{display:block}' +
    W + '.wp-frame{margin-top:17px;text-align:center}' + W + '.wp-frame iframe{border:0}' +
    W + '.wp-f{height:54px;background-repeat:no-repeat}';
};
