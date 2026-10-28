import { refreshDur, updateHeader } from '../banner.js';
import { S } from '../core/state.js';
import { https } from '../core/util.js';
import { BP, bpPopup } from '../layout/backpack.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts, mModal } from '../layout/modal.js';
import { refreshWorld } from './combat.js';

// The game's Quick Links of the world page, as a bar of buttons above the map (Modern layout): the backpack (with how full it is),
// Quick Assault, Quick Buff, Medipack and Repair Kit. The assault, the medipack and the repair kit are sent in the background and the
// game's message is shown in a dialog; the backpack opens a dialog with its contents, where items can be destroyed. The area map
// button is left out: the map can be zoomed out to show all of it. Quick Buff keeps the game's own dialog.

const BAG = 'index.php?cmd=profile&subcmd=dropitems&fromworld=1';

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
        b.append(mel('span', 'n', m[1] + '/' + m[2]));
        if (+m[1] >= +m[2]) b.classList.add('full');
      }
    }
    bar.append(b);
  });
  return bar.children.length ? bar : null;
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
    }
  }
}

// The backpack button: a dialog with the backpack of the profile page (see backpack.js); the count on the button is read again when it closes.
function bagDialog() {
  const host = mel('div', 'qb');
  host.textContent = 'Loading the backpack...';
  mModal('Backpack', host, [{ text: 'Close' }], { keep: true, onClose: () => { BP.onChange = null; refreshWorld().catch(() => {}); } });
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
      if (n) n.textContent = m[1] + '/' + m[2];
      b.classList.toggle('full', +m[1] >= +m[2]);
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
    '.wp-qb{display:flex;align-items:center;gap:3px;height:22px;padding:0 4px;box-sizing:border-box;background:rgba(0,0,0,.75);border:1px solid #5a5f5f;color:#d8cfbf;font:bold 10px Arial,sans-serif;text-decoration:none;cursor:pointer}' +
    '.wp-qb:hover{border-color:#9fe0ff;color:#fff}.wp-qb.full{color:#ff8a80}.wp-qb img{display:block;width:16px;height:16px;border:0}' +
    // the backpack dialog
    '#ssh-mm .qb{width:300px}#ssh-mm .bp-top{display:flex;justify-content:flex-end}#ssh-mm .qb-sh{margin:10px 0 4px;padding-top:8px;border-top:1px solid #3a3d3d;font-weight:bold;color:#fff}';
};
