import { refreshDur, updateHeader } from '../banner.js';
import { S } from '../core/state.js';
import { https } from '../core/util.js';
import { BP, bpFromDoc, bpPopup } from '../layout/backpack.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts, mModal } from '../layout/modal.js';
import { loadItem, parseItem } from '../tooltips/compare.js';
import { refreshWorld } from './combat.js';

// The game's Quick Links of the world page, as a bar of buttons above the map (Modern layout): the backpack (with how full it is),
// Quick Assault, Quick Buff, Medipack and Repair Kit. The assault, the medipack and the repair kit are sent in the background and the
// game's message is shown in a dialog; the backpack opens a dialog with its contents, where items can be destroyed. The area map
// button is left out: the map can be zoomed out to show all of it. Quick Buff keeps the game's own dialog.

const BAG = 'index.php?cmd=profile&subcmd=dropitems&fromworld=1';

// The colour of a count: ok (green), low (yellow), out (red).
const bagLevel = (used, max) => (used >= max ? 'out' : used > max * 0.75 ? 'low' : 'ok');
const mpLevel = (n) => (n === 0 ? 'out' : n <= 5 ? 'low' : 'ok');

// The bar made from the game's Quick Links table `src` (a fetched or the live one: it is only read).
export function buildQuickBar(src) {
  const bar = mel('div', 'wp-q');
  [...src.querySelectorAll('td[align="center"]')].forEach((td) => {
    const a = td.querySelector('a[href]');
    const img = a && a.querySelector('img');
    if (!a || !img) return;
    const href = a.getAttribute('href') || '';
    const kind = /subcmd=dropitems/.test(href) ? 'bag' : /cmd=guild/.test(href) ? 'assault' : /openQuickBuffDialog/.test(href) ? 'buff'
      : /worldmedipack/.test(href) ? 'heal' : /worldrepairkit/.test(href) ? 'repair' : '';
    if (!kind) return; // the area map, and anything the game adds that is not known
    const b = mel('a', 'wp-qb');
    b.dataset.q = kind;
    if (kind === 'buff') b.setAttribute('href', href); // the game's own dialog
    else { b.setAttribute('href', '#'); b.dataset.href = href; }
    b.title = (img.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const im = mel('img');
    im.src = https(img.getAttribute('src'));
    im.alt = '';
    b.append(im);
    if (kind === 'bag') {
      const m = td.textContent.match(/\[\s*(\d+)\s*\/\s*(\d+)\s*\]/);
      if (m) {
        const n = mel('span', 'n', m[1] + '/' + m[2]);
        n.dataset.lv = bagLevel(+m[1], +m[2]);
        b.append(n);
      }
    }
    if (kind === 'heal' || kind === 'repair') {
      const have = kind === 'heal' ? S.medipacks : S.repairKits;
      const mp = mel('span', 'mp', have === undefined ? '' : String(have));
      if (have !== undefined) mp.dataset.lv = mpLevel(have);
      b.append(mp);
    }
    bar.append(b);
  });
  if (!bar.children.length) return null;
  // next to the repair button: how many ammo refills fit the equipped weapon (an icon, not a button)
  const ai = mel('span', 'wp-qi');
  ai.dataset.q = 'ammo';
  const aim = mel('img');
  aim.src = 'https://cdn.sigmastorm.com/items/62618d0a5f.gif';
  aim.alt = '';
  ai.append(aim, mel('span', 'mp'));
  ammoPaint(ai);
  bar.append(ai);
  return bar;
}

// The supplies in the bag, over all folders and pages: how many medipacks (any size: the name has "Medipack" in it), written under the Medipack
// button, and how many ammo refills (Ammo items whose "Ammo Type" is the "Damage Type" of an equipped weapon), written on the ammo icon.
// The bag only shows pictures, so names and types come from the item data (once per kind of item, kept for the visit).
const itemInfo = new Map();
let mpBusy = false;
const REPAIR = /repair (bot|belt|drone|kit)|diagnostic kit/i;
const ITEM = /ajaxLoadItem\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;
async function infoOf(m) {
  if (!itemInfo.has(m[1])) {
    const html = await loadItem(m[1], m[2], m[3], m[4]);
    const text = parseItem(html).doc.body.textContent.replace(/[\s ]+/g, ' ');
    itemInfo.set(m[1], { name: parseItem(html).name, type: parseItem(html).type, ammo: ((text.match(/Ammo Type: ?([A-Za-z]+)/) || [])[1] || '').toLowerCase(), dmg: ((text.match(/Damage Type: ?([A-Za-z]+)/) || [])[1] || '').toLowerCase() });
  }
  return itemInfo.get(m[1]);
}

export async function refreshSupplies() {
  if (mpBusy) return;
  mpBusy = true;
  try {
    const get = async (url) => {
      const doc = new DOMParser().parseFromString(await (await fetch(url, { credentials: 'same-origin' })).text(), 'text/html');
      return { doc, d: bpFromDoc(doc) };
    };
    const { doc: pdoc, d: first } = await get('index.php?cmd=profile');
    if (!first) return;
    // the damage types of the equipped weapons: the worn items are the ones with an unequip link or no link, not the bag's and the components'
    const types = new Set();
    const seenWorn = new Set();
    for (const im of pdoc.querySelectorAll('img[onmouseover*="ajaxLoadItem"]')) {
      const a = im.closest('a');
      const m = (im.getAttribute('onmouseover') || '').match(ITEM);
      if (!m || seenWorn.has(m[1]) || (a && !/subcmd=unequipitem/.test(a.getAttribute('href') || ''))) continue;
      seenWorn.add(m[1]);
      const t = (await infoOf(m)).dmg;
      if (t) types.add(t);
    }
    const seen = new Set();
    let meds = 0;
    let kits = 0;
    let ammo = 0;
    for (const f of first.folders) {
      const d = f.id === first.cur ? first : (await get('index.php?cmd=profile&folder_id=' + f.id)).d;
      if (!d) return;
      const pages = [d];
      for (const p of d.pages) if (p.n !== '1' && p.href) pages.push((await get(p.href)).d);
      for (const pg of pages) {
        for (const it of pg ? pg.items : []) {
          const m = (it.tip || '').match(ITEM);
          if (!m || !/subcmd=useitem/.test(it.href || '') || seen.has(it.inv)) continue;
          seen.add(it.inv); // the same item can show on every page of a folder
          const info = await infoOf(m);
          const n = parseInt(it.count, 10) || 1;
          if (/medipack/i.test(info.name)) meds += n;
          if (REPAIR.test(info.name) || /repair/i.test(info.type)) kits += n; // whatever its level: choosing a fitting one is up to the player
          if (info.ammo && types.has(info.ammo)) ammo += n;
        }
      }
    }
    S.medipacks = meds;
    S.repairKits = kits;
    S.ammoRefills = types.size ? ammo : null;
    S.ammoTypes = [...types];
    paintSupplies();
  } catch (e) { /* the next refresh has it */ } finally { mpBusy = false; }
}

// Write the counts on the bar's buttons (the bar is built again after every page, so it is also done when it is built).
function paintSupplies() {
  [['heal', S.medipacks], ['repair', S.repairKits]].forEach(([q, n]) => document.querySelectorAll('.wp-qb[data-q="' + q + '"] .mp').forEach((e) => { e.textContent = String(n); e.dataset.lv = mpLevel(n); }));
  document.querySelectorAll('.wp-qi[data-q="ammo"]').forEach((i) => ammoPaint(i));
}

function ammoPaint(i) {
  i.hidden = S.ammoRefills == null;
  if (i.hidden) return;
  const n = i.querySelector('.mp');
  n.textContent = String(S.ammoRefills);
  n.dataset.lv = mpLevel(S.ammoRefills);
  i.title = 'Ammo refills in the bag for your ' + S.ammoTypes.join(' / ') + ' weapon';
}

const busy = (on) => document.querySelectorAll('.wp-q').forEach((q) => q.classList.toggle('busy', on));

// The page text of a response that has no message box and is not the world page.
const pageText = (doc) => {
  const m = doc.getElementById('mainContentDiv');
  return ((m && m.rows[1] && m.rows[1].cells[1] ? m.rows[1].cells[1].textContent : doc.body.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 500);
};

// A quick action (assault, medipack, repair kit): the same request as the game's link, in the background; its message in a dialog.
export async function quickAction(href, label) {
  if (S.busy || S.pending) return;
  S.pending++;
  busy(true);
  let ok = false;
  try {
    const html = await (await fetch(new URL(href, location.href).href, { credentials: 'same-origin' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const alerts = gAlerts(doc);
    if (alerts.length) alertModal(alerts);
    else if (!doc.getElementById('mapDiv')) { // no message and not the world page: show what the game answered
      const body = mel('div');
      body.textContent = pageText(doc) || 'Done.';
      mModal(label, body, [{ text: 'OK' }]);
    }
    updateHeader(html);
    ok = true;
  } catch (e) {
    const body = mel('div');
    body.textContent = 'The request failed.';
    mModal(label, body, [{ text: 'OK' }]);
  } finally {
    S.pending--;
    busy(false);
    if (ok && !S.pending) {
      try { await refreshWorld(); } catch (e) { /* the next move refreshes it */ }
      refreshDur(0);
      if (/worldmedipack|worldrepairkit/.test(href)) refreshSupplies();
    }
  }
}

// The backpack button: a dialog with the backpack of the profile page (see backpack.js); the count on the button is read again when it closes.
function bagDialog() {
  const host = mel('div', 'qb');
  host.textContent = 'Loading the backpack...';
  mModal('Backpack', host, [{ text: 'Close' }], { keep: true, onClose: () => { BP.onChange = null; refreshWorld().catch(() => {}); refreshSupplies(); } });
  bpPopup(host, refreshBagCount); // the count follows what is destroyed or used in it
}

// How full the backpack is, from the world page (its Quick Links say it): written on the bag button.
export async function refreshBagCount() {
  try {
    const doc = new DOMParser().parseFromString(await (await fetch('index.php?cmd=world', { credentials: 'same-origin' })).text(), 'text/html');
    const strip = doc.querySelector('table[style*="quicklinks_bg"]');
    const m = strip && strip.textContent.match(/\[\s*(\d+)\s*\/\s*(\d+)\s*\]/);
    if (!m) return;
    document.querySelectorAll('.wp-qb[data-q="bag"]').forEach((b) => {
      const n = b.querySelector('.n');
      if (n) { n.textContent = m[1] + '/' + m[2]; n.dataset.lv = bagLevel(+m[1], +m[2]); }
    });
  } catch (e) { /* the next page refresh has it */ }
}

// Clicks on the bar, and the game's shortcut keys for the same things (B backpack, G assault, M medipack, F repair kit).
const DO = {
  bag: () => bagDialog(),
  assault: (b) => quickAction(b.dataset.href, 'Quick Assault'),
  heal: (b) => quickAction(b.dataset.href, 'Medipack'),
  repair: (b) => quickAction(b.dataset.href, 'Repair Kit'),
};
const KEYS = { b: 'bag', g: 'assault', m: 'heal', f: 'repair' };

export function bindQuickLinks() {
  if (bindQuickLinks.on) return;
  bindQuickLinks.on = true;
  refreshSupplies();
  document.addEventListener('click', (e) => {
    const b = e.target && typeof e.target.closest === 'function' ? e.target.closest('.wp-qb') : null;
    if (!b || !DO[b.dataset.q]) return;
    e.preventDefault();
    DO[b.dataset.q](b);
  });
  document.addEventListener('keypress', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.getElementById('ssh-mm')) return;
    const tg = e.target;
    if (tg && (/^(input|textarea|select)$/i.test(tg.tagName) || tg.isContentEditable)) return;
    const kind = KEYS[(e.key || '').toLowerCase()];
    const b = kind && document.querySelector('.wp-qb[data-q="' + kind + '"]');
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation(); // not the game's own handler, which opens the page
    DO[kind](b);
  }, true);
}

export const quickCss = () => {
  const Q = '.wp-q';
  // in the map's top row, after the W and G buttons (the same height as them), clear of the up arrow in the middle
    return Q + '{position:absolute;left:94px;top:6px;z-index:5;display:flex;gap:4px;align-items:center}' + Q + '.busy{opacity:.55;pointer-events:none}' +
    '.wp-qb,.wp-qi{display:flex;align-items:center;gap:3px;height:22px;padding:0 4px;box-sizing:border-box;background:rgba(0,0,0,.75);border:1px solid #5a5f5f;color:#d8cfbf;font:bold 10px Arial,sans-serif;text-decoration:none;cursor:pointer}' +
    '.wp-qb,.wp-qi{position:relative}.wp-qi[hidden]{display:none}.wp-qi{cursor:default}.wp-qb .mp,.wp-qi .mp,.wp-qb .n{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;padding:0 3px;background:rgba(0,0,0,.75);color:#d8cfbf;font:bold 10px Arial,sans-serif;line-height:13px;pointer-events:none;white-space:nowrap}.wp-qi .mp:empty,.wp-qb .mp:empty{display:none}' +
    '.wp-qb:hover{border-color:#9fe0ff;color:#fff}.wp-qb [data-lv=ok],.wp-qi [data-lv=ok]{color:#7fe08a}.wp-qb [data-lv=low],.wp-qi [data-lv=low]{color:#ffd24a}.wp-qb [data-lv=out],.wp-qi [data-lv=out]{color:#ff8a80}.wp-qb img,.wp-qi img{display:block;width:16px;height:16px;border:0}' +
    // the backpack dialog
    '#ssh-mm .qb{width:300px}#ssh-mm .bp-top{display:flex;justify-content:flex-end}#ssh-mm .qb-sh{margin:10px 0 4px;padding-top:8px;border-top:1px solid #3a3d3d;font-weight:bold;color:#fff}';
};
