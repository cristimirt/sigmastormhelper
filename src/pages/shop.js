import { updateHeader } from '../banner.js';
import { fetchText, navigate } from '../core/net.js';
import { S } from '../core/state.js';
import { cssUrl, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { mModal } from '../layout/modal.js';
import { updateSidebars } from '../layout/sidebars.js';

// A shop (cmd=shop, opened with a POST, so its address has no cmd) for the Modern layout, made of divs: .sh-head (picture), .sh-banner (the shop's
// picture), .sh-back, .sh-intro, the tabs (.sh-tabs: sharp-cornered buttons, the open one marked in teal) with a panel per tab (.sh-grid of .sh-item:
// the item's picture as a button, how many are left, the price) and .sh-foot. The game's table stays in the page, hidden in the Modern layout (so the
// Original layout, with the game's own tabs, is untouched).
// Buying is done in the background: an item's picture asks the game's own question (data-sigma-confirm) in a dialog, then sends the item's buy
// form (its fields; the token and the one-time value are added by the fetch the helper wraps, see core/net.js). The answer is the shop page again
// (new stock, new one-time quotes) and the game's message: the shop's table is replaced by the one of the answer, the divs are made again from it,
// and the header (credits) and the side panels are updated. The game's own message (its alert box above the text) is in the answer and is the
// only one shown (a note of the helper's own is only for a failed request). The open tab stays open.

const CSS = '#ssh-sh{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-sh{display:block}html.ssh-modern [data-ssh-sh]{display:none!important}' +
  '#ssh-sh .sh-head,#ssh-sh .sh-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-sh .sh-banner{padding-top:12px;text-align:center;line-height:0}#ssh-sh .sh-banner img{max-width:600px}' +
  '#ssh-sh .sh-back{padding:12px 0 0;text-align:center}' +
  '#ssh-sh .sh-intro{width:600px;margin:0 auto;padding:12px 0 6px;line-height:1.45}' +
  '#ssh-sh .sh-tabs{display:flex;gap:2px;width:580px;margin:14px auto 0;padding:0;border-bottom:1px solid #3a4242}' +
  '#ssh-sh .sh-tab{height:26px;padding:0 14px;box-sizing:border-box;background:#181c1c;color:#a9a091;border:1px solid #2f3535;border-bottom:0;border-radius:0;font:bold 11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-sh .sh-tab:hover{background:#222828;color:#fff}' +
  '#ssh-sh .sh-tab.on{height:28px;margin-bottom:-1px;background:#10303a;color:#fff;border-color:#3a4242;border-top:2px solid #5cc8e8}' +
  '#ssh-sh .sh-grid{display:flex;flex-wrap:wrap;gap:14px 12px;align-content:flex-start;width:580px;min-height:120px;margin:0 auto;padding:16px 12px 14px;box-sizing:border-box;background:rgba(0,0,0,.45);border:1px solid #3a4242;border-top:0}' +
  '#ssh-sh .sh-grid[hidden]{display:none}' +
  '#ssh-sh .sh-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:62px}' +
  '#ssh-sh .sh-slot{width:45px;height:45px;padding:0;box-sizing:content-box;background:#0d0905;border:1px solid #202122;border-radius:0;line-height:0;cursor:pointer}' +
  '#ssh-sh .sh-slot:hover{border-color:#8a9090}#ssh-sh .sh-slot img{display:block;width:45px;height:45px}' +
  '#ssh-sh .sh-left{font-size:10px;color:#a9a091}' +
  '#ssh-sh .sh-price{display:flex;align-items:center;gap:3px;height:14px;font-size:11px;color:#fff}#ssh-sh .sh-price img{height:12px;width:auto}' +
  '#ssh-sh .sh-none{padding:14px;color:#a9a091}' +
  '#ssh-sh.busy{opacity:.55;pointer-events:none}' +
  '#ssh-sh .sh-note{width:580px;margin:12px auto 0;padding:5px 8px;box-sizing:border-box;text-align:center;border:1px solid #2d6a39;color:#7fe08a;background:rgba(0,0,0,.4)}' +
  '#ssh-sh .sh-note.bad{border-color:#8a2a22;color:#ff8a80}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
let cur = 0; // the open tab (kept when the page is built again)
let busy = false;
let note = null; // { text, bad }: the game's message of the last purchase, shown when the page is built again

// What the game's table says: the pictures, the text, the tab names and the items of every tab.
function read(t) {
  const head = t.querySelector('td[background*="header_"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const tabs = t.querySelector('#tabs');
  const names = tabs ? [...tabs.querySelectorAll(':scope > ul > li > a')] : [];
  const panels = names.map((a) => {
    const id = (a.getAttribute('href') || '').replace(/^.*#/, '');
    const p = id && tabs.querySelector('#' + id);
    return {
      name: txt(a),
      items: p ? [...p.querySelectorAll('form[id^="shop-buy-"]')].map((form) => {
        const cell = form.closest('table').parentNode;
        const money = [...cell.querySelectorAll('tr')].reverse().find((tr) => tr.cells.length === 2 && /\d/.test(txt(tr.cells[0])) && tr.cells[1].querySelector('img'));
        return {
          form,
          img: form.querySelector('img'),
          btn: form.querySelector('button, input[type=submit]'),
          left: txt(cell.querySelector('font')),
          cost: money ? txt(money.cells[0]) : '',
          coin: money && money.cells[1].querySelector('img'),
        };
      }) : [],
    };
  });
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    banner: [...t.querySelectorAll('img')].find((i) => /banner/i.test(i.getAttribute('src') || '')),
    back: [...t.querySelectorAll('a')].find((a) => /back to/i.test(txt(a))),
    intro: t.querySelector('table[width="600"] td'),
    panels,
  };
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-sh';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'sh-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.banner) {
    const b = mel('div', 'sh-banner');
    const i = d.banner.cloneNode(false);
    i.src = https(d.banner.getAttribute('src'));
    b.append(i);
    root.append(b);
  }
  if (d.back) {
    const b = mel('div', 'sh-back');
    b.append('[ ', d.back.cloneNode(true), ' ]');
    root.append(b);
  }
  if (d.intro) {
    const x = mel('div', 'sh-intro');
    x.innerHTML = d.intro.innerHTML;
    root.append(x);
  }
  if (note && note.text) {
    const n = mel('div', 'sh-note' + (note.bad ? ' bad' : ''));
    n.textContent = note.text;
    root.append(n);
    setTimeout(() => n.remove(), 8000);
  }
  note = null;
  if (cur >= d.panels.length) cur = 0;
  const bar = mel('div', 'sh-tabs');
  bar.setAttribute('role', 'tablist');
  const grids = [];
  const tabs = [];
  const open = (n) => {
    cur = n;
    tabs.forEach((b, i) => { b.classList.toggle('on', i === n); b.setAttribute('aria-selected', String(i === n)); });
    grids.forEach((g, i) => { g.hidden = i !== n; });
  };
  d.panels.forEach((p, n) => {
    const b = mel('button', 'sh-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = p.name;
    b.addEventListener('click', () => open(n));
    tabs.push(b);
    bar.append(b);
    const g = mel('div', 'sh-grid');
    g.setAttribute('role', 'tabpanel');
    p.items.forEach((it) => {
      const box = mel('div', 'sh-item');
      const slot = mel('button', 'sh-slot');
      slot.type = 'button';
      if (it.img) {
        const i = it.img.cloneNode(false); // the tooltip handler of the game stays on the copy
        i.src = https(it.img.getAttribute('src'));
        slot.append(i);
      }
      slot.addEventListener('click', () => ask(it));
      const left = mel('div', 'sh-left');
      left.textContent = it.left;
      const price = mel('div', 'sh-price');
      price.append(it.cost);
      if (it.coin) {
        const c = it.coin.cloneNode(false);
        c.src = https(it.coin.getAttribute('src'));
        price.append(c);
      }
      box.append(slot, left, price);
      g.append(box);
    });
    if (!p.items.length) g.append(mel('div', 'sh-none', 'Nothing for sale here.'));
    grids.push(g);
  });
  if (d.panels.length) {
    root.append(bar, ...grids);
    open(cur);
  }
  const ft = mel('div', 'sh-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  ft.style.marginTop = '14px';
  root.append(ft);
  return root;
}

// The fields of a game form that are sent (the token and the one-time value are not: fetch adds fresh ones).
function fieldsOf(form) {
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button') body.append(e.name, e.value); });
  return body;
}

// The page's own table is replaced by the one of the answer, and the divs are made again from it.
function swap(doc) {
  const head = doc.querySelector('td[background*="header_shop"]');
  const nt = head && head.closest('table[width="640"]');
  const old = document.querySelector('table[data-ssh-sh]');
  if (!nt || !old || !nt.querySelector('#tabs')) return false;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-sh', '1');
  old.replaceWith(fresh);
  const was = document.getElementById('ssh-sh');
  const root = build(fresh);
  if (was) was.replaceWith(root); else fresh.after(root);
  return true;
}

// The game's question, then the purchase.
function ask(it) {
  if (busy || !it.form) return;
  const body = mel('div');
  body.textContent = it.form.getAttribute('data-sigma-confirm') || 'Are you sure you wish to buy this item?';
  if (it.cost) {
    const p = mel('div', '', '');
    p.style.marginTop = '6px';
    p.textContent = 'Price: ' + it.cost + (it.coin && it.coin.getAttribute('title') ? ' ' + it.coin.getAttribute('title') : '');
    body.append(p);
  }
  mModal('Buy item', body, [{ text: 'Buy', fn: () => send(it.form) }, { text: 'Cancel' }], { center: true });
}

async function send(form) {
  if (busy) return;
  busy = true;
  const root = document.getElementById('ssh-sh');
  root && root.classList.add('busy');
  const shop = (form.querySelector('input[name="shop_id"]') || {}).value;
  let swapped = false;
  try {
    const text = await fetchText('index.php', { method: 'POST', body: fieldsOf(form) });
    const doc = parseHtml(text);
    swapped = swap(doc); // the game's own message (an alert box above the text) comes along in the page
    updateHeader(text);
    try { updateSidebars(doc); } catch (e) { /* the next live check has it */ }
    if (!swapped && shop) { busy = false; navigate('index.php?cmd=shop&shop_id=' + shop); return; } // not the shop page: let the browser show what the game made of it
  } catch (e) {
    note = { text: 'The purchase request failed.', bad: true };
  }
  busy = false;
  const r = document.getElementById('ssh-sh');
  if (r) r.classList.remove('busy');
  if (!swapped && note && note.text && r) { // the page was not built again: the message still shows
    const n = mel('div', 'sh-note' + (note.bad ? ' bad' : ''));
    n.textContent = note.text;
    r.querySelector('.sh-tabs').before(n);
    note = null;
  }
}

export function initShop() {
  const head = document.querySelector('td[background*="header_shop"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-sh')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-sh', '1');
  table.after(build(table));
}
