import { S } from './core/state.js';
import { store } from './core/storage.js';
import { fmt, num, txt } from './core/util.js';
import { pageParts } from './core/page.js';
import { modernHeader, syncModernNumbers } from './layout/header.js';

// Update the top bar (HP, energy, credits, XP) from the combat page right away.
export function updateHeader(html) {
  try {
    const nxt = pageParts(new DOMParser().parseFromString(html, 'text/html'));
    const cur = pageParts();
    if (cur && nxt) {
      setHeaderFrom(cur, nxt);
      S.hdrT = Date.now(); // the energy tooltip's countdown starts again from this response
    }
    grabVars(html);
    decorateHeader();
  } catch (e) { /* the final refresh fixes it */ }
}

// The banner of a fetched page becomes the banner of this one: the game's own cell is replaced; in the Modern frame the banner is
// made again from its table (see decorateHeader).
export function setHeaderFrom(cur, nxt) {
  if (cur.modern) S.hdrSrc = nxt.header.querySelector('table.sidebars') || S.hdrSrc;
  else cur.header.innerHTML = nxt.header.innerHTML;
}

S.surge = null;

S.staminaMax = 500;

S.dur = store.get('dur', null); // { cur, max, t }: durability of all equipped items added up

// The page's own variables hold the Skill Power and energy now; a response page we read (a fight) has newer ones, so they are
// written back (the game's Skill Power tooltip reads them too).
export function grabVars(html) {
  const t = String(html || '');
  const m = t.match(/currentPlayerSurge\s*=\s*(\d+)/);
  if (m) { S.surge = +m[1]; window.currentPlayerSurge = S.surge; }
  const st = t.match(/currentPlayerStamina\s*=\s*(\d+)/);
  if (st) window.currentPlayerStamina = +st[1];
  const mx = t.match(/currentPlayerStamina\s*\+\s*'(?:&nbsp;|\s)*\/(?:&nbsp;|\s)*(\d+)/);
  if (mx) S.staminaMax = +mx[1];
}

// Skill Power now: the page's variable (the game's skill buttons keep it up to date), else what the last response said.
const surgeNow = () => (typeof window.currentPlayerSurge === 'number' ? window.currentPlayerSurge : S.surge);

// The numbers the banner writes, read from the game's banner hc (a table or a cell: its tooltips, pictures and the energy number).
function bannerTexts(hc) {
  const tips = [...hc.querySelectorAll('[onmouseover]')].map((e) => txt(e.getAttribute('onmouseover')));
  const sum = tips.find((t) => /Character Summary/.test(t)) || '';
  const spTip = tips.find((t) => /Skill Power/.test(t)) || '';
  const hp = sum.match(/HP:\s*([\d,]+)\s*\/\s*([\d,]+)/);
  const spImg = hc.querySelector('#surgeImg');
  const bs = [...hc.querySelectorAll('b')].filter((b) => /^[\d,]+(?:\s*\/\s*\d+)?$/.test(txt(b.textContent)));
  const sc = hc.querySelector('#staminaCurrent'); // the number the game's skill buttons change
  const out = { hp: '', sp: '', spMax: '', flux: bs[0] ? txt(bs[0].textContent) : null, en: sc ? txt(sc.textContent) : bs[1] ? txt(bs[1].textContent) : null, enMax: '' };
  if (S.cfg.bannerNums) {
    if (hp) out.hp = fmt(num(hp[1])) + ' / ' + fmt(num(hp[2]));
    if (spImg) {
      const max = num((spTip.match(/currentPlayerSurge\s*\+\s*'\s*\/\s*(\d+)/) || [])[1]) || 50;
      const now = surgeNow();
      const pct = parseFloat(spImg.style.width || spImg.getAttribute('width')) || 0;
      out.sp = (now !== null && now !== undefined ? now : Math.round((pct * max) / 100)) + ' / ' + max;
      out.spMax = String(max);
    }
    if (out.en !== null) { out.en = String(num(out.en)); out.enMax = String(S.staminaMax); }
  }
  return out;
}

// A skill changes the Skill Power bar's width and the energy number (by their ids); the helper's numbers follow. In the Modern banner
// those two are the helper's own pieces with the same ids, so only the Skill Power number and the durability are written again, in
// place (the orbs do not start their animation again).
let watch = null;
let watchT = 0;
function syncBanner() {
  const hdr = document.getElementById('ssh-hdr');
  if (S.layout === 'modern' && hdr) {
    const e = hdr.querySelector('[data-n="sp"]');
    const now = surgeNow();
    syncModernNumbers(hdr, S.cfg.bannerNums && e && e.dataset.max && now !== null && now !== undefined ? now + ' / ' + e.dataset.max : '');
    return;
  }
  decorateHeader();
}
function watchBanner() {
  if (!watch) watch = new MutationObserver(() => { clearTimeout(watchT); watchT = setTimeout(syncBanner, 40); });
  watch.disconnect();
  const sc = document.getElementById('staminaCurrent');
  const si = document.getElementById('surgeImg');
  if (sc) watch.observe(sc, { childList: true, characterData: true, subtree: true });
  if (si) watch.observe(si, { attributes: true, attributeFilter: ['style', 'width'] });
}

// Back to the game's own banner (the Original layout): its table goes into the page again.
export function restoreHeader() {
  const p = pageParts();
  if (!p || !p.modern || !S.hdrSrc) return;
  p.header.querySelectorAll('#ssh-hdr').forEach((e) => e.remove());
  if (!S.hdrSrc.isConnected) p.header.append(document.adoptNode(S.hdrSrc));
  S.hdrSrc = null;
}

export function decorateHeader(tries) {
  try {
    const p = pageParts();
    const hc = p && p.header;
    if (!hc) return;
    // the Modern frame: the banner is made again with divs from the game's table (see layout/header.js) and the table leaves the
    // page; the first time it is the one in the page, later the one of the last page fetched
    if (p.modern) {
      const src = S.hdrSrc || hc.querySelector('table.sidebars');
      if (src) {
        S.hdrSrc = src;
        if (src.isConnected) src.remove();
        hc.querySelectorAll('#ssh-hdr, .ssh-ov').forEach((e) => e.remove()); // (the game's own banner may have had its numbers added before the frame was made)
        hc.insertBefore(modernHeader(src, bannerTexts(src)), hc.firstChild);
        watchBanner();
        return;
      }
    }
    watchBanner();
    hc.querySelectorAll('#ssh-hdr, .ssh-ov').forEach((e) => e.remove()); // the game's own banner: no Modern copy in the way
    const hpImg = hc.querySelector('img[src*="hp_progress"]');
    const spImg = hc.querySelector('#surgeImg');
    const r0 = hc.getBoundingClientRect();
    if (!hpImg || !r0.width || !hpImg.getBoundingClientRect().width) {
      if ((tries || 0) < 10) setTimeout(() => decorateHeader((tries || 0) + 1), 300); // images not laid out yet
      return;
    }
    if (!S.cfg.bannerNums && !S.cfg.durBar) return;
    hc.style.position = 'relative';
    const tips = [...hc.querySelectorAll('[onmouseover]')].map((e) => txt(e.getAttribute('onmouseover')));
    const sum = tips.find((t) => /Character Summary/.test(t)) || '';
    const sp = tips.find((t) => /Skill Power/.test(t)) || '';
    const hp = sum.match(/HP:\s*([\d,]+)\s*\/\s*([\d,]+)/);
    const over = (box, text, top, h, extra) => {
      const d = document.createElement('div');
      d.className = 'ssh-ov';
      d.textContent = text;
      d.style.cssText = 'position:absolute;pointer-events:none;left:' + (box.left - r0.left) + 'px;top:' + (box.top - r0.top + top) + 'px;width:' + box.width + 'px;height:' + h + 'px;line-height:' + h + 'px;text-align:center;font:bold 9px Verdana,Arial,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 2px #000,0 0 2px #000,1px 1px 1px #000;' + (extra || '');
      hc.appendChild(d);
      return d;
    };
    const hb = hpImg.getBoundingClientRect();
    const hpTd = hpImg.closest('td').getBoundingClientRect();
    if (S.cfg.bannerNums && hp) over(hpTd, fmt(num(hp[1])) + ' / ' + fmt(num(hp[2])), -2, 13);
    if (S.cfg.bannerNums && spImg) {
      const max = num((sp.match(/currentPlayerSurge\s*\+\s*'\s*\/\s*(\d+)/) || [])[1]) || 50;
      const pct = parseFloat(spImg.style.width || spImg.getAttribute('width')) || 0;
      const now = surgeNow();
      const val = now !== null && now !== undefined ? now : Math.round((pct * max) / 100);
      over(spImg.closest('td').getBoundingClientRect(), val + ' / ' + max, -1, 13);
    }
    // energy: the number under the reactor gets its maximum, after it (the number itself stays the game's, which its skill
    // buttons change)
    const bs = [...hc.querySelectorAll('b')].filter((b) => /^[\d,]+(?:\s*\/\s*\d+)?$/.test(txt(b.textContent)));
    if (S.cfg.bannerNums && bs.length > 1) {
      const en = bs[1];
      en.querySelectorAll('.ssh-emax').forEach((e) => e.remove());
      const mx = document.createElement('span');
      mx.className = 'ssh-emax';
      mx.textContent = ' / ' + S.staminaMax;
      en.appendChild(mx);
      en.style.fontSize = '9px';
      en.style.whiteSpace = 'nowrap';
    }
    // gear durability bar under the HP bar
    if (!S.cfg.durBar) return;
    const dur = S.dur;
    const g = document.createElement('div');
    g.className = 'ssh-ov';
    const pct = dur && dur.max ? (dur.cur / dur.max) * 100 : 0;
    const col = pct < 30 ? '#b32a22,#6e1510' : pct < 60 ? '#c98f1d,#7b560c' : '#4fbf63,#256f35';
    g.title = 'Durability of the equipped items' + (dur && dur.t ? ' (checked ' + new Date(dur.t).toLocaleTimeString() + ')' : '');
    // as long as the HP bar's slot (not its picture: that one is only as wide as the HP you have), with a wrench in front
    const top = hb.top - r0.top + 19;
    g.style.cssText = 'position:absolute;left:' + (hpTd.left - r0.left) + 'px;top:' + top + 'px;width:' + hpTd.width + 'px;height:11px;box-sizing:border-box;background:#0b0b0b;border:1px solid #4a4a4a;';
    const ic = document.createElement('div');
    ic.className = 'ssh-ov';
    ic.style.cssText = 'position:absolute;pointer-events:none;left:' + (hpTd.left - r0.left - 22) + 'px;top:' + (top - 2) + 'px;width:16px;height:16px;box-sizing:border-box;border:1px solid #4a4a4a;background:#000 url(https://cdn.sigmastorm.com/skin/quicklinks/8.gif) center / 14px 14px no-repeat;';
    hc.appendChild(ic);
    g.innerHTML = '<div style="width:' + pct + '%;height:100%;background:linear-gradient(' + col + ');"></div>' +
      '<div style="position:absolute;left:0;right:0;top:0;line-height:9px;text-align:center;font:bold 8px Verdana,Arial,sans-serif;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000;white-space:nowrap;">' +
      (dur ? 'Gear ' + dur.cur + ' / ' + dur.max + ' (' + pct.toFixed(1) + '%)' : 'Gear ...') + '</div>';
    hc.appendChild(g);
  } catch (e) { console.warn('[Sigmastorm Helper] banner numbers failed', e); }
}

// Gear durability: the equipped items are listed on the character page; each item's tooltip data has "Durability: x / y".
export async function refreshDur(maxAge) {
  if (!S.cfg.durBar) return;
  if (S.dur && S.dur.t && Date.now() - S.dur.t < maxAge) return;
  if (S.durBusy) { S.durAgain = true; return; } // a check is running (maybe from before this fight): read once more when it is done
  S.durBusy = true;
  try {
    const html = await (await fetch('index.php?cmd=profile', { credentials: 'same-origin' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = new Map();
    doc.querySelectorAll('[onmouseover*="ajaxLoadItem"]').forEach((e) => {
      const o = e.getAttribute('onmouseover') || '';
      const r = o.match(/ajaxLoadItem\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
      if (r && /Unequip/.test(o)) items.set(r[2], r);
    });
    let cur = 0;
    let max = 0;
    await Promise.all([...items.values()].map(async (r) => {
      const t = txt(await (await fetch('fetchitem.php?item_id=' + r[1] + '&inv_id=' + r[2] + '&t=' + r[3] + '&p=' + r[4] + '&uid=' + Date.now(), { credentials: 'same-origin' })).text());
      const q = t.match(/Durability:\s*(\d+)\s*\/\s*(\d+)/);
      if (q) { cur += +q[1]; max += +q[2]; }
    }));
    if (max) { S.dur = { cur, max, t: Date.now() }; store.set('dur', S.dur); }
  } catch (e) { /* keep the old value */ }
  S.durBusy = false;
  syncBanner();
  if (S.durAgain) { S.durAgain = false; refreshDur(0); }
}
