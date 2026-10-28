import { S } from '../core/state.js';
import { clearItems, compareParts, loadItem, pairCss, peekItem, tipLook } from './compare.js';
import { energyHtml, energyOn } from './energy.js';
import { loadSkill, scaleDesc, skillByName, skillInfo } from './skills.js';

// The game's tooltip library (wz_tooltip) places a tooltip on the next mouse move and hides it on the mouse-out it sees.
// With items that load slowly the tooltip can wait off-screen, or stay stuck to the mouse when the pointer already left.
// Tip() is replaced by a simple one: shown where the pointer is, follows it, and always goes away when the pointer
// leaves the element that opened it. Same look (the game's own settings), same Tip(html, ...) / tt_setWidth(w) calls.
export function initTips() {
  if (initTips.on) return;
  initTips.on = true;
  const cfg = (typeof window.config === 'object' && window.config) || {};
  const look = tipLook();
  const st = document.createElement('style');
  st.textContent = '#ssh-gtip{position:fixed;left:0;top:0;z-index:10000;display:none;box-sizing:content-box;' + look.box + 'pointer-events:none;}' +
    '#ssh-gtip .tt{margin:-1px -1px 3px;padding:2px 3px;font-weight:bold;background:' + look.title + '}' +
    '#ssh-gtip .sk{margin-top:5px;padding-top:4px;border-top:1px solid #3a3d3d;text-align:left;line-height:1.35}#ssh-gtip .sk b{color:#7fe08a}#ssh-gtip .sx{margin-top:4px;color:#9a9488;font-size:11px}' +
    // gear comparing: the hovered item and the worn one side by side, the hovered one on the side of the pointer
    pairCss('#ssh-gtip');
  document.head.appendChild(st);
  const box = document.createElement('div');
  box.id = 'ssh-gtip';
  document.body.appendChild(box);
  let mx = 0;
  let my = 0;
  let hov = null; // the element the pointer entered last: the one whose handler calls Tip()
  let trig = null; // the element the shown tooltip belongs to
  let curW = 0; // width of the tooltip shown now
  let pw = 0; // width set by tt_setWidth for the next tooltip
  let tipId = 0; // changes whenever a tooltip opens or closes: a late answer only fills the tooltip it was asked for
  const hide = () => { trig = null; tipId++; box.style.display = 'none'; };
  const place = () => {
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    // opens towards the middle of the window: left of the pointer on the right half, above it on the lower half
    const ox = cfg.OffsetX || 14;
    const oy = cfg.OffsetY || 8;
    const x = mx > vw / 2 ? mx - ox - w : mx + ox;
    const y = my > vh / 2 ? my - oy - h : my + oy;
    box.classList.toggle('flip', mx > vw / 2);
    box.style.left = Math.min(Math.max(4, x), Math.max(4, vw - w - 4)) + 'px';
    box.style.top = Math.min(Math.max(4, y), Math.max(4, vh - h - 4)) + 'px';
  };
  // A tooltip may only be opened by a handler running during a mouse-over. Later calls (the game calls Tip() again when an
  // item's data arrives) just refresh a tooltip that is still open; once the pointer has left they are ignored.
  let inOver = false;
  const show = (args) => {
    if (inOver) { if (!hov || !hov.isConnected) return; } else if (!trig) return;
    const a = [...args];
    const first = a.shift();
    let html = first === undefined ? '' : String(first);
    let title = '';
    let width = pw || cfg.Width || 375;
    for (let i = 0; i + 1 < a.length; i += 2) {
      const k = String(a[i]).toLowerCase();
      if (k === 'title') title = a[i + 1];
      else if (k === 'width' && a[i + 1] > 0) width = a[i + 1];
    }
    pw = 0;
    // a buff / skill: add what it does, scaled to its level
    const sk = inOver ? skillTip(html) : null;
    const info = sk && skillFor(sk);
    if (sk) width = Math.max(width, 250);
    // the banner's energy tooltip: a live countdown and when the energy will be full
    const en = inOver && energyOn(html) ? html : null;
    if (en) { html = energyHtml(en); width = Math.max(width, 260); }
    curW = width;
    box.style.width = width + 'px';
    box.innerHTML = (title ? '<div class="tt">' + title + '</div>' : '') + html + (sk ? skillBlock(info, sk.level) : '');
    if (inOver) { trig = hov; tipId++; }
    box.style.display = 'block';
    place();
    if (en) {
      const live = tipId;
      const iv = setInterval(() => { if (live !== tipId) clearInterval(iv); else refresh(live, energyHtml(en)); }, 1000);
    }
    if (sk && !info && sk.id !== null) { // not in the built-in list: read its skill page once and keep it
      const mine = tipId;
      loadSkill(sk.id).then((s) => { if (s && (!sk.name || s.n.toLowerCase() === sk.name.toLowerCase())) refresh(mine, html + skillBlock(s, sk.level)); }).catch(() => {});
    }
  };
  // A buff / skill tooltip: "<b>Strike</b> (Level: 10) ... [Click to De-Activate]" on an image. The skill id is in the picture's name
  // (skills/<id>_small.gif) when it is a skill-tree skill; stim buffs are found by name.
  // The "Skills" panel in the right column uses `a.skillBox#skill_<id>` boxes with the picture as a background
  // ("<b>Strike</b><br>(Level: 10)<br><br>Active at level: 10<br><br>[Click to deactivate]").
  const skillTip = (html) => {
    const lv = html.match(/\(Level:\s*(\d+)\)/);
    const el = hov && hov.closest && hov.closest('img, .skillBox');
    if (!lv || !el) return null;
    const src = el.tagName === 'IMG' ? el.getAttribute('src') || '' : el.getAttribute('style') || '';
    const sm = src.match(/\/skills\/(?:box\/)?(\d+)_small\.gif/) || /^skill_(\d+)$/.exec(el.id || '');
    const nm = html.match(/<b>([^<]+)<\/b>/);
    return { id: sm ? sm[1] : null, name: nm ? nm[1].trim() : '', level: +lv[1] };
  };
  const skillFor = (sk) => {
    let s = sk.id !== null ? skillInfo(sk.id) : null;
    if (s && sk.name && s.n.toLowerCase() !== sk.name.toLowerCase()) s = null; // the id and the name disagree: trust the name
    return s || skillByName(sk.name);
  };
  const skillBlock = (s, level) => {
    if (!s) return '';
    const e = s.e ? '<div>' + s.e.replace(/\{L\/(\d+)\}/g, (m, n) => Math.floor(level / n)) + '</div>' : '';
    return '<div class="sk">' + scaleDesc(s.d, level) + e + (s.x.length ? '<div class="sx">' + s.x.join(' &middot; ') + '</div>' : '') + '</div>';
  };
  const refresh = (id, html) => {
    if (id !== tipId || !trig) return;
    box.innerHTML = html;
    place();
  };
  // the hovered item next to the worn one: two tooltips as wide as the one it replaces
  const refreshPair = (id, main, worn) => {
    if (id !== tipId || !trig) return;
    box.style.width = curW * 2 + 17 + 'px';
    box.innerHTML = '<div class="cw"><div class="cm">' + main + '</div><div class="ce"><div class="eqh">Worn</div>' + worn + '</div></div>';
    place();
  };
  document.addEventListener('mouseover', (e) => {
    if (!e.isTrusted) return;
    hov = e.target;
    mx = e.clientX;
    my = e.clientY;
    inOver = true;
    setTimeout(() => { inOver = false; }, 0);
  }, true);
  document.addEventListener('mousemove', (e) => {
    if (!e.isTrusted) return;
    mx = e.clientX;
    my = e.clientY;
    if (!trig) return;
    if (!trig.contains(e.target)) hide(); else place();
  }, true);
  document.addEventListener('mouseout', (e) => {
    if (trig && trig.contains(e.target) && !(e.relatedTarget && trig.contains(e.relatedTarget))) hide();
  }, true);
  document.addEventListener('mousedown', hide, true);
  window.addEventListener('blur', hide);
  // the game's scripts may be loaded late (Rocket Loader), so keep looking for them for a while
  const install = () => {
    if (typeof window.Tip === 'function' && !window.Tip.ssh) {
      window.Tip = function () { show(arguments); };
      window.Tip.ssh = true;
      window.UnTip = hide;
    }
    if (typeof window.tt_setWidth === 'function' && !window.tt_setWidth.ssh) {
      window.tt_setWidth = function (w) { pw = w; };
      window.tt_setWidth.ssh = true;
    }
    // The game fetches an item's data with a blocking request, which freezes the whole page until the server answers.
    // Same call, but in the background: "Loading Stats..." shows at once and the tooltip fills in when the data arrives.
    // Answers are kept for a minute (cleared whenever the bag or profile is reloaded).
    if (typeof window.ajaxLoadItem === 'function' && !window.ajaxLoadItem.ssh) {
      // an item that is not worn gets how it differs from the worn item of its kind, added once the answers are in
      const compare = (id, html, fin) => {
        if (!S.cfg.gearCompare || /Unequip/.test(fin)) return;
        compareParts(html, loadItem).then((c) => { if (c) refreshPair(id, c.html + fin, c.worn); }, () => {});
      };
      window.ajaxLoadItem = function (itemId, invId, type, pid, finalStr) {
        const fin = finalStr || '';
        const hit = peekItem(itemId, invId);
        if (hit !== null) { show([hit + fin]); compare(tipId, hit, fin); return; }
        show(['<center><br>&nbsp;&nbsp;Loading Stats...</center><br>']);
        const id = tipId;
        loadItem(itemId, invId, type, pid).then((html) => { refresh(id, html + fin); compare(id, html, fin); }, () => refresh(id, 'Could not load this item.'));
      };
      window.ajaxLoadItem.ssh = true;
      window.ajaxLoadItem.clear = clearItems;
    }
  };
  install();
  let n = 0;
  const iv = setInterval(() => { install(); if (++n > 200) clearInterval(iv); }, 100);
}
