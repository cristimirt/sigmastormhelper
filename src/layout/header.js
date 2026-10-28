import { S } from '../core/state.js';
import { copyOn } from './dom.js';

// The top banner for the Modern layout, built again with absolutely placed divs. The game's own table (kept in the page,
// hidden) is the source of the data and of the links and tooltips, which are copied; the pieces are placed on the exact
// slots of the banner picture (1000 x 150), which the game's table layout misses by a few pixels.
const SKIN = 'https://cdn.sigmastorm.com/skin/';

// the black slots of top_banner_x4.jpg: x, y, width, height
const SLOT = {
  icons: [12, 55, 185, 26],
  hp: [48, 92, 132, 12],
  flux: [240, 111, 55, 17],
  xp: [402, 107, 210, 12],
  energy: [706, 111, 55, 17],
  news: [801, 12, 187, 68],
  surge: [824, 92, 131, 12],
  surgeIcon: [960, 88, 18, 18],
};

export const bannerCss = () =>
  '#ssh-hdr{display:none;position:relative;width:1000px;height:150px;margin:0 auto 6px;background:url("' + SKIN + 'top_banner_x4.jpg") no-repeat 0 0;overflow:hidden}' +
  'html.ssh-modern #ssh-hdr{display:block}#ssh-hdr img{border:0}' +
  '#ssh-hdr .n{text-align:center;font:bold 9px Verdana,Arial,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 2px #000,0 0 2px #000,1px 1px 1px #000;pointer-events:none}';

const box = (x, y, w, h, css) => {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' + (w ? 'width:' + w + 'px;' : '') + (h ? 'height:' + h + 'px;' : '') + (css || '');
  return d;
};
const inSlot = (s, css) => box(s[0], s[1], s[2], s[3], css);

// A copy of a link / picture of the game's table (its address and tooltip come along) put at a place.
function place(src, x, y, w, h, own) {
  if (!src) return null;
  const el = (src.closest('a') || src).cloneNode(true);
  el.removeAttribute('id');
  // `own`: a smoother picture of the helper's own (media/ of its site) instead of the game's, when the site is known
  const pic = el.tagName === 'IMG' ? el : el.querySelector('img');
  if (own && S.base && pic) pic.setAttribute('src', S.base + 'media/' + own);
  el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;display:block;width:' + w + 'px;height:' + h + 'px';
  el.querySelectorAll('img').forEach((i) => { i.removeAttribute('align'); i.removeAttribute('id'); i.style.cssText = 'display:block;width:' + w + 'px;height:' + h + 'px'; });
  if (el.tagName === 'IMG') el.style.border = '0';
  return el;
}

// How full a bar's picture says it is: its style (which the game's skill buttons set) or its width attribute.
const fillWidth = (img) => {
  const w = img.style.width || img.getAttribute('width') || '0';
  return /%/.test(w) ? w : parseFloat(w) + 'px';
};

// The fill of a bar (a picture whose width says how full it is) in its slot, with the tooltip of the game's cell. `key` names
// the bar and its number so modernNumbers() can update them.
function bar(img, slot, tipFrom, text, key) {
  if (!img) return null;
  const s = inSlot(slot, 'overflow:hidden');
  if (tipFrom) copyOn(tipFrom, s);
  const f = img.cloneNode(false);
  f.removeAttribute('id');
  f.style.cssText = 'position:absolute;left:0;top:1px;height:9px;width:' + fillWidth(img);
  f.dataset.b = key;
  s.appendChild(f);
  if (text) {
    const n = box(0, 0, slot[2], slot[3], 'line-height:' + slot[3] + 'px');
    n.className = 'n';
    n.dataset.n = key;
    n.textContent = text;
    s.appendChild(n);
  }
  return s;
}

// The durability bar (S.dur: the equipped items added up): its fill, colour, text and the time of the last check.
function drawDur(g) {
  const dur = S.dur;
  const pct = dur && dur.max ? (dur.cur / dur.max) * 100 : 0;
  const col = pct < 30 ? '#b32a22,#6e1510' : pct < 60 ? '#c98f1d,#7b560c' : '#4fbf63,#256f35';
  g.title = 'Durability of the equipped items' + (dur && dur.t ? ' (checked ' + new Date(dur.t).toLocaleTimeString() + ')' : '');
  g.firstChild.style.cssText = 'height:100%;width:' + pct + '%;background:linear-gradient(' + col + ')';
  g.lastChild.textContent = dur ? 'Gear ' + dur.cur + ' / ' + dur.max + ' (' + pct.toFixed(1) + '%)' : 'Gear ...';
}

// The bars and numbers of the banner made by modernHeader(), written again from the game's banner (a skill used, say).
export function modernNumbers(hc, n) {
  const hdr = hc.querySelector('#ssh-hdr');
  const t = hc.querySelector('table.sidebars');
  if (!hdr || !t) return false;
  const dg = hdr.querySelector('[data-d]');
  if (dg) drawDur(dg);
  Object.keys(n).forEach((k) => {
    const e = hdr.querySelector('[data-n="' + k + '"]');
    if (e && n[k] !== null && n[k] !== undefined && n[k] !== '') e.textContent = n[k];
  });
  [['hp', 'img[src*="hp_progress"]'], ['xp', 'img[src*="xp_progress"]'], ['sp', '#surgeImg']].forEach(([k, sel]) => {
    const i = t.querySelector(sel);
    const f = hdr.querySelector('[data-b="' + k + '"]');
    if (i && f) f.style.width = fillWidth(i);
  });
  return true;
}

// n: the texts to write (hp, sp, flux, en); returns false when the game's banner is not there.
export function modernHeader(hc, n) {
  const t = hc.querySelector('table.sidebars');
  if (!t) return false;
  hc.querySelectorAll('#ssh-hdr').forEach((e) => e.remove());
  t.setAttribute('data-ssh-orig', '');
  const q = (s) => t.querySelector(s);
  const hdr = document.createElement('div');
  hdr.id = 'ssh-hdr';
  const add = (e) => { if (e) hdr.appendChild(e); return e; };

  // name and credits: the labels are in the picture
  [...t.querySelectorAll('font')].filter((f) => /b6c5cb/i.test(f.getAttribute('color') || '')).slice(0, 2).forEach((f, i) => {
    const d = box(75, 17 + i * 14, 120, 14, 'font:7.9pt Verdana,sans-serif;line-height:14px;color:#B6C5CB;white-space:nowrap;overflow:hidden');
    d.textContent = f.textContent.trim();
    add(d);
  });

  // the five quick icons, centred in their slot
  const links = [...t.querySelectorAll('table[align="center"] a')].slice(0, 5);
  const ix = SLOT.icons[0] + Math.round((SLOT.icons[2] - (links.length * 20 + (links.length - 1) * 10)) / 2);
  links.forEach((a, i) => add(place(a, ix + i * 30, SLOT.icons[1] + 3, 20, 20)));

  // HP, with the gear durability bar and its wrench under it
  const hpImg = q('img[src*="hp_progress"]');
  add(bar(hpImg, SLOT.hp, hpImg && hpImg.closest('td'), n.hp, 'hp'));
  if (S.cfg.durBar) {
    const top = 112;
    const g = box(SLOT.hp[0], top, SLOT.hp[2], 11, 'box-sizing:border-box;background:#0b0b0b;border:1px solid #4a4a4a');
    g.dataset.d = '1';
    g.innerHTML = '<div style="height:100%"></div><div class="n" style="position:absolute;left:0;right:0;top:0;line-height:9px;font-size:8px"></div>';
    drawDur(g);
    add(g);
    add(box(SLOT.hp[0] - 22, top - 2, 16, 16, 'box-sizing:border-box;border:1px solid #4a4a4a;background:#000 url(' + SKIN + 'quicklinks/8.gif) center / 14px 14px no-repeat'));
  }

  // Flux Crystals and Energy: the animations sit where the picture has its orbs, the numbers in their slots
  add(place(q('img[src*="animation_gem"]'), 220, 0, 97, 88, 'animation_gem_hd.gif'));
  add(place(q('img[src*="animation_cell"]'), 686, 0, 97, 88, 'animation_cell_hd.gif'));
  [['flux', SLOT.flux, n.flux, 11], ['en', SLOT.energy, n.en, 9]].forEach(([key, s, text, fs]) => {
    if (text === undefined || text === null) return;
    const d = inSlot(s, 'display:flex;align-items:center;justify-content:center');
    d.className = 'n';
    d.dataset.n = key;
    d.style.fontSize = fs + 'px';
    d.textContent = text;
    add(d);
  });

  // XP
  add(bar(q('img[src*="xp_progress"]'), SLOT.xp, null, '', 'xp'));

  // the news picture, centred in its slot, and the Skill Power bar with its icon
  const news = q('img[src*="instance_tip"]');
  if (news) add(place(news, SLOT.news[0] + Math.round((SLOT.news[2] - 165) / 2), SLOT.news[1] + Math.round((SLOT.news[3] - 50) / 2), 165, 50));
  const sp = q('#surgeImg');
  add(bar(sp, SLOT.surge, sp && sp.closest('[onmouseover]'), n.sp, 'sp'));
  const ico = [...t.querySelectorAll('img')].filter((i) => /\/4\.gif$/.test(i.getAttribute('src') || '') && !i.getAttribute('onmouseover')).pop(); // the icon row's 4.gif has a tooltip
  if (ico) add(place(ico, SLOT.surgeIcon[0] + 1, SLOT.surgeIcon[1] + 1, 16, 16));

  hc.insertBefore(hdr, hc.firstChild);
  return true;
}
