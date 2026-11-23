import { updateHeader } from '../banner.js';
import { fetchText, navigate } from '../core/net.js';
import { S } from '../core/state.js';
import { alertBad, cssUrl, fmt, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { gAlerts, mModal } from '../layout/modal.js';
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

const CSS = '#ssh-sh{display:none;color:#d8cfbf;font:11px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-sh{display:block}html.ssh-modern [data-ssh-sh]{display:none!important}' +
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
  '.sh-prog{position:sticky;top:0;z-index:5;padding:8px 20px 8px;background:rgba(11,14,14,.92);border-bottom:1px solid #3a4242;text-align:center;color:#d8cfbf;font:11px tahoma,sans-serif}' +
  '.sh-prog .sh-pb{height:8px;margin-top:5px;background:#10171a;border:1px solid #3a4242}.sh-prog .sh-pb i{display:block;height:100%;width:0;background:#5cc8e8;transition:width .25s}' +
  '#ssh-mm .sh-qty{margin-top:8px;text-align:center}#ssh-mm .sh-qty input{width:56px;height:22px;box-sizing:border-box;margin-left:4px;padding:2px 4px;background:#0b0e0e;color:#d8cfbf;border:1px solid #5a5f5f;text-align:center;font:11px Arial,sans-serif}#ssh-mm .sh-qty input:focus{outline:0;border-color:#9fe0ff}#ssh-mm .sh-total{margin-top:6px}#ssh-mm .sh-get{margin-top:2px;color:#a9a091}' +
  '#ssh-sh .sh-note{width:580px;margin:12px auto 0;padding:5px 8px;box-sizing:border-box;text-align:center;border:1px solid #2d6a39;color:#7fe08a;background:rgba(0,0,0,.4)}' +
  '#ssh-sh .sh-note.bad{border-color:#8a2a22;color:#ff8a80}';

const MAXQ = 99;
const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
let cur = 0; // the open tab (kept when the page is built again)
let busy = false;
let inPopup = false; // the shop is in a dialog over the world page (no picture bars, no back link)
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
  const page = steelContainer({ header: d.head, bare: inPopup }); // the steel container (layout/steel.js); in the pop-up there is no title bar and footer
  page.id = 'ssh-sh';
  const root = page.body;
  if (d.banner) {
    const b = mel('div', 'sh-banner');
    const i = d.banner.cloneNode(false);
    i.src = https(d.banner.getAttribute('src'));
    b.append(i);
    root.append(b);
  }
  if (d.back && !inPopup) {
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
  return page;
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
  let inp = null;
  if (it.cost) {
    const unit = parseInt(String(it.cost).replace(/[^\d]/g, ''), 10);
    const coin = it.coin && it.coin.getAttribute('title') ? ' ' + it.coin.getAttribute('title') : '';
    const row = mel('div', 'sh-qty');
    const sm = String(it.left || '').match(/(\d+)\s*\/\s*(\d+)/); // the "1 / 25" under an item is the stack a purchase gives (how many of at most how many), not the stock
    const per = sm ? parseInt(sm[1], 10) : 1;
    row.append('Quantity: ');
    inp = mel('input');
    inp.type = 'number';
    inp.min = '1';
    inp.max = String(MAXQ);
    inp.value = '1';
    row.append(inp);
    const p = mel('div', 'sh-total');
    const g = mel('div', 'sh-get');
    const total = () => {
      const q = Math.max(1, Math.min(MAXQ, parseInt(inp.value, 10) || 1));
      p.textContent = 'Price: ' + (Number.isNaN(unit) ? it.cost : fmt(unit * q)) + coin + (q > 1 && !Number.isNaN(unit) ? ' (' + q + ' x ' + fmt(unit) + ')' : '');
    };
    const gets = () => {
      const q = Math.max(1, Math.min(MAXQ, parseInt(inp.value, 10) || 1));
      g.textContent = 'You get ' + (per > 1 ? q + ' x ' + per + ' = ' + fmt(q * per) : fmt(q)) + (q * per === 1 ? ' item' : ' items') + (sm ? ' (a purchase is a stack of ' + per + ' / ' + sm[2] + ')' : '');
    };
    inp.addEventListener('input', () => { total(); gets(); });
    total();
    gets();
    body.append(row, p, g);
  }
  const qty = () => (inp ? Math.max(1, Math.min(MAXQ, parseInt(inp.value, 10) || 1)) : 1);
  mModal('Buy item', body, [{ text: 'Buy', fn: () => send(it.form, qty()) }, { text: 'Cancel' }], { center: true });
  if (inp) { inp.focus(); inp.select(); }
}

// The item is bought n times, one after the other: every answer is the shop page again with new one-time values, so each request is made from the
// form of the item in the page as it is then. It stops at the first message of the game that is an error or a warning (not enough credits ...) or when the item is gone.
async function send(form, n) {
  if (busy) return;
  busy = true;
  const root0 = document.getElementById('ssh-sh');
  root0 && root0.classList.add('busy');
  const shop = (form.querySelector('input[name="shop_id"]') || {}).value;
  const fid = form.id;
  let swapped = false;
  let done = 0;
  let stopped = false;
  let f = form;
  // the progress of a purchase of several: a bar above the shop (in what holds it, which stays when the shop is built again)
  const host = root0 && root0.parentElement;
  let bar = null;
  if (host && n > 1) {
    bar = mel('div', 'sh-prog');
    bar.innerHTML = '<div class="sh-pt"></div><div class="sh-pb"><i></i></div>';
    host.prepend(bar);
  }
  const setProg = (k) => {
    if (!bar) return;
    bar.querySelector('.sh-pt').textContent = 'Buying ' + Math.min(k + 1, n) + ' / ' + n + '...';
    bar.querySelector('i').style.width = Math.round((k / n) * 100) + '%';
  };
  try {
    for (let i = 0; i < (n || 1); i++) {
      setProg(i);
      const text = await fetchText('index.php', { method: 'POST', body: fieldsOf(f) });
      const doc = parseHtml(text);
      swapped = swap(doc); // the game's own message (an alert box above the text) comes along in the page
      updateHeader(text);
      try { updateSidebars(doc); } catch (e) { /* the next live check has it */ }
      if (!swapped && shop) { busy = false; navigate('index.php?cmd=shop&shop_id=' + shop); return; } // not the shop page: let the browser show what the game made of it
      if (alertBad(gAlerts(doc))) { stopped = true; break; }
      done++;
      if (i < (n || 1) - 1) {
        f = document.querySelector('table[data-ssh-sh] form[id="' + fid + '"]');
        if (!f) { stopped = true; break; } // sold out
        const r = document.getElementById('ssh-sh');
        r && r.classList.add('busy');
        await new Promise((res) => setTimeout(res, 100));
      }
    }
  } catch (e) {
    note = { text: 'The purchase request failed.', bad: true };
  }
  busy = false;
  if (bar) bar.remove();
  const r = document.getElementById('ssh-sh');
  if (r) r.classList.remove('busy');
  if ((n || 1) > 1 && r && !note) {
    note = { text: 'Bought ' + done + ' of ' + n + '.', bad: stopped };
  }
  if (note && note.text && r) { // the page was not built again (or it is a summary): the message shows above the tabs
    const x = mel('div', 'sh-note' + (note.bad ? ' bad' : ''));
    x.textContent = note.text;
    const tabs = r.querySelector('.sh-tabs');
    if (tabs) tabs.before(x); else r.append(x);
    setTimeout(() => x.remove(), 8000);
    note = null;
  }
}

const addCss = () => {
  if (document.getElementById('ssh-sh-css')) return;
  const st = mel('style');
  st.id = 'ssh-sh-css';
  st.textContent = CSS + '#ssh-mm.shop .box{max-width:none}#ssh-mm.shop .pb{padding:0;max-height:82vh;overflow:auto}#ssh-mm.shop #ssh-sh{background-image:none!important;padding-bottom:14px}' +
    '#ssh-mm .sh-wait{width:640px;max-width:100%;height:220px;display:flex;align-items:center;justify-content:center}#ssh-mm .sh-wait i{width:44px;height:44px;box-sizing:border-box;border:4px solid rgba(159,224,255,.25);border-top-color:#9fe0ff;border-radius:50%;animation:ssh-busy-rot .8s linear infinite}@keyframes ssh-busy-rot{to{transform:rotate(360deg)}}';
  document.head.append(st);
};

// The shop of the world page in a dialog: the same request as the game's Browse Shop button, in the background; its answer is the shop page, made into
// divs as the page itself would be (buying works the same). Returns false when the answer is not a shop (the caller sends the form the old way).
export async function openShopPopup(fields, title) {
  if (document.getElementById('ssh-sh')) return false;
  addCss();
  const body = new URLSearchParams();
  fields.forEach(([n, v]) => body.append(n, v));
  // the dialog opens at once with a spinner; the shop replaces it when the answer is there
  const holder = mel('div', 'sh-wait');
  holder.append(mel('i'));
  inPopup = true;
  const close = mModal(title || 'Shop', holder, [{ text: 'Close' }], { center: true, big: true, onClose: () => { inPopup = false; } });
  const m = [...document.querySelectorAll('#ssh-mm')].pop();
  if (m) m.classList.add('shop');
  try {
    const doc = parseHtml(await fetchText('index.php', { method: 'POST', body }));
    const head = doc.querySelector('td[background*="header_shop"]');
    const nt = head && head.closest('table[width="640"]');
    if (!nt || !nt.querySelector('#tabs')) throw new Error('not a shop');
    if (!holder.isConnected) return true; // closed meanwhile
    const fresh = document.importNode(nt, true);
    fresh.setAttribute('data-ssh-sh', '1');
    holder.className = '';
    holder.replaceChildren(fresh, build(fresh));
  } catch (e) {
    if (holder.isConnected) close();
    return false;
  }
  return true;
}

export function initShop() {
  const head = document.querySelector('td[background*="header_shop"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-sh')) return;
  addCss();
  table.setAttribute('data-ssh-sh', '1');
  table.after(build(table));
}
