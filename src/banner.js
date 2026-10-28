import { S } from './core/state.js';
import { store } from './core/storage.js';
import { fmt, num, txt } from './core/util.js';

// Update the top bar (HP, energy, credits, XP) from the combat page right away.
export function updateHeader(html) {
  try {
    const nxt = new DOMParser().parseFromString(html, 'text/html').getElementById('mainContentDiv');
    const cur = document.getElementById('mainContentDiv');
    if (cur && nxt && cur.rows.length && nxt.rows.length) {
      cur.rows[0].cells[0].innerHTML = nxt.rows[0].cells[0].innerHTML;
      S.hdrT = Date.now(); // the energy tooltip's countdown starts again from this response
    }
    grabVars(html);
    decorateHeader();
  } catch (e) { /* the final refresh fixes it */ }
}

S.surge = null;

S.staminaMax = 500;

S.dur = store.get('dur', null); // { cur, max, t }: durability of all equipped items added up

export function grabVars(html) {
  const t = String(html || '');
  const m = t.match(/currentPlayerSurge\s*=\s*(\d+)/);
  if (m) S.surge = +m[1];
  const mx = t.match(/currentPlayerStamina\s*\+\s*'(?:&nbsp;|\s)*\/(?:&nbsp;|\s)*(\d+)/);
  if (mx) S.staminaMax = +mx[1];
}

export function decorateHeader(tries) {
  try {
    const m = document.getElementById('mainContentDiv');
    const hc = m && m.rows.length ? m.rows[0].cells[0] : null;
    if (!hc) return;
    hc.querySelectorAll('.ssh-ov').forEach((e) => e.remove());
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
      const pct = parseFloat(spImg.getAttribute('width')) || 0;
      const val = S.surge !== null ? S.surge : Math.round((pct * max) / 100);
      over(spImg.closest('td').getBoundingClientRect(), val + ' / ' + max, -1, 13);
    }
    // energy: the number under the reactor gets its maximum
    const bs = [...hc.querySelectorAll('b')].filter((b) => /^[\d,]+(?:\s*\/\s*\d+)?$/.test(txt(b.textContent)));
    if (S.cfg.bannerNums && bs.length > 1) {
      const en = bs[1];
      en.textContent = num(en.textContent) + ' / ' + S.staminaMax;
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
  if (S.durBusy || !S.cfg.durBar) return;
  if (S.dur && S.dur.t && Date.now() - S.dur.t < maxAge) return;
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
  decorateHeader();
}
