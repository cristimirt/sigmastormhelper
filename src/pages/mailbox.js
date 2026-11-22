import { updateHeader } from '../banner.js';
import { fetchText } from '../core/net.js';
import { S } from '../core/state.js';
import { alertBad, alertText, cssUrl, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { gAlerts } from '../layout/modal.js';
import { updateSidebars } from '../layout/sidebars.js';

// The Item Mailbox (cmd=tempinv) for the Modern layout, made of divs: the game's table stays in the page, hidden in the Modern layout (so the Original
// layout is untouched), and is read again from every answer. A click on an item takes it into the backpack in the background (the same request as
// the game's form; its one-time quote changes with every answer, so each request is made from the form of the answer before it) and the list is built
// again from the answer. Ctrl+click or the box in the corner of an item ticks it, Shift+click ticks a range; the button at the bottom takes
// the ticked items one after the other ("Retrieve selected"), or every item when none is ticked ("Retrieve all"). It stops at the first message of the
// game that is an error or a warning (the backpack is full ...) and says how many were taken.

const CSS = '#ssh-mb{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-mb{display:block}html.ssh-modern [data-ssh-mb]{display:none!important}' +
  '#ssh-mb .mb-head,#ssh-mb .mb-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-mb .mb-intro{width:550px;margin:20px auto 0;text-align:center;line-height:1.45}' +
  '#ssh-mb .mb-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;width:580px;margin:20px auto 0;min-height:60px}' +
  '#ssh-mb .mb-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;width:62px;user-select:none}' +
  '#ssh-mb .mb-slot{position:relative;width:45px;height:45px;padding:0;box-sizing:content-box;background:#0d0905;border:1px solid #202122;border-radius:0;line-height:0;cursor:pointer}' +
  '#ssh-mb .mb-slot:hover{border-color:#8a9090}#ssh-mb .mb-slot img{display:block;width:45px;height:45px}' +
  '#ssh-mb .mb-item.sel .mb-slot{border-color:#9fe0ff}' +
  // the box in the corner of an item looks like the backpack's (theme.js: .bp-ck), in the slot's top right corner
  '#ssh-mb .mb-ck{-webkit-appearance:none;appearance:none;position:absolute;top:2px;right:10px;width:11px;height:11px;margin:0;padding:0;cursor:pointer;z-index:2;box-sizing:border-box;background:rgba(0,0,0,.6) center / 9px 9px no-repeat;border:1px solid #8a9090;border-radius:2px;opacity:.45;transition:opacity .12s}' +
  '#ssh-mb .mb-ck:hover,#ssh-mb .mb-ck:checked{opacity:1}' +
  '#ssh-mb .mb-ck:checked{background-color:#1f5f80;border-color:#9fe0ff;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 10%27%3E%3Cpath d=%27M2 5.2l2 2L8 3%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")}' +
  '#ssh-mb .mb-q{font-size:10px;color:#a9a091}#ssh-mb .mb-t{font-size:10px;color:#d8cfbf}#ssh-mb .mb-t.gone{color:#ff5a4a;font-weight:bold}' +
  '#ssh-mb .mb-none{padding:20px;color:#a9a091}' +
  '#ssh-mb .mb-bar{display:flex;justify-content:center;padding:18px 0 4px}' +
  '#ssh-mb .mb-prog{text-align:center;padding:6px 0 0;color:#a9a091}' +
  '#ssh-mb .mb-bar input{cursor:pointer}#ssh-mb .mb-bar input[disabled]{opacity:.5;cursor:default}' +
  '#ssh-mb.busy .mb-grid{opacity:.55;pointer-events:none}' +
  '#ssh-mb .mb-note{width:550px;margin:14px auto 0;padding:5px 8px;box-sizing:border-box;text-align:center;border:1px solid #2d6a39;color:#7fe08a;background:rgba(0,0,0,.4)}' +
  '#ssh-mb .mb-note.bad{border-color:#8a2a22;color:#ff8a80}';

export const isMailbox = () => !!document.querySelector('td[style*="header_itemmailbox"]');

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
const urlOf = (el) => ((el && el.getAttribute('style')) || '').match(/url\(["']?([^)"']+)["']?\)/);
let busy = false;
let note = null; // { text, bad }: shown when the page is built again
const sel = new Set(); // the ticked items (their numbers)
let ticker = 0;
// "1h 5m 20s" (or "54m 15s", "20s", "2d 3h") as seconds, and back the same way
const secs = (t) => { let n = 0; String(t).replace(/(\d+)\s*([dhms])/g, (m, v, u) => { n += +v * { d: 86400, h: 3600, m: 60, s: 1 }[u]; return m; }); return n; };
const left = (n) => { const h = Math.floor(n / 3600); const m = Math.floor((n % 3600) / 60); const s = n % 60; return h ? h + 'h ' + m + 'm ' + s + 's' : m ? m + 'm ' + s + 's' : s + 's'; };
// every time left counts down by itself; at 0 it reads "Expired" in red
function countdown(root) {
  clearInterval(ticker);
  const run = () => {
    if (!root.isConnected) { clearInterval(ticker); return; }
    root.querySelectorAll('.mb-t[data-end]').forEach((e) => {
      const n = Math.round((+e.dataset.end - Date.now()) / 1000);
      if (n <= 0) { e.textContent = 'Expired'; e.classList.add('gone'); } else e.textContent = left(n);
    });
  };
  run();
  ticker = setInterval(run, 1000);
}
let prog = null; // { k, n, label } while several items are being taken: the button keeps its text and is disabled, a line under it counts
let anchor = ''; // the last ticked item, where a Shift+click range starts

function tableOf(doc) {
  const head = doc.querySelector('td[style*="header_itemmailbox"]');
  return head && head.closest('table[width="640"]');
}

// What the game's table says: the intro, and every item with its form, picture, count and time left.
function read(t) {
  const head = t.querySelector('td[style*="header_itemmailbox"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const items = [...t.querySelectorAll('form[id^="mailbox-collect-"]')].map((form) => {
    const cell = form.closest('table');
    const outer = cell && cell.parentElement; // the cell of the list that holds the item's table and the table with the time left
    const when = outer ? [...outer.querySelectorAll('td[align="center"]')].map(txt).filter((x) => /\d/.test(x) && !/\//.test(x)).pop() : '';
    return {
      id: (form.querySelector('input[name="temp_id"]') || {}).value || form.id.replace(/\D+/g, ''),
      form,
      img: form.querySelector('input[type="image"], img'),
      qty: txt(form.parentElement.querySelector('font')),
      time: when || '',
    };
  });
  return { bg: t.getAttribute('background'), head: (urlOf(head) || [])[1], foot: foot && foot.getAttribute('background'), intro: t.querySelector('div[style*="width"]'), items };
}

// The fields of a game form that are sent (the token and the one-time value are not: fetch adds fresh ones).
function fieldsOf(form) {
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button' && e.type !== 'image') body.append(e.name, e.value); });
  return body;
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-mb';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'mb-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.intro) {
    const x = mel('div', 'mb-intro');
    x.innerHTML = d.intro.innerHTML;
    root.append(x);
  }
  if (note && note.text) {
    const n = mel('div', 'mb-note' + (note.bad ? ' bad' : ''));
    n.textContent = note.text;
    root.append(n);
    setTimeout(() => n.remove(), 9000);
  }
  note = null;
  [...sel].forEach((id) => { if (!d.items.some((i) => i.id === id)) sel.delete(id); });
  const grid = mel('div', 'mb-grid');
  const btn = mel('input', 'custombutton');
  const sync = () => {
    grid.querySelectorAll('.mb-item').forEach((el) => {
      const on = sel.has(el.dataset.id);
      el.classList.toggle('sel', on);
      el.querySelector('.mb-ck').checked = on;
    });
    root.classList.toggle('picking', sel.size > 0);
    btn.value = prog ? prog.label : sel.size ? 'Retrieve selected' : 'Retrieve all';
  };
  d.items.forEach((it, n) => {
    const box = mel('div', 'mb-item');
    box.dataset.id = it.id;
    const slot = mel('button', 'mb-slot');
    slot.type = 'button';
    if (it.img) {
      const i = mel('img');
      i.src = new URL(it.img.getAttribute('src') || '', location.href).href;
      const tip = it.img.getAttribute('onmouseover');
      if (tip) i.setAttribute('onmouseover', tip); // the game's item tooltip
      i.alt = '';
      slot.append(i);
    }
    const ck = mel('input', 'mb-ck');
    ck.type = 'checkbox';
    ck.title = 'Select';
    ck.addEventListener('click', (e) => e.stopPropagation());
    ck.addEventListener('change', () => { if (ck.checked) { sel.add(it.id); anchor = it.id; } else sel.delete(it.id); sync(); });
    slot.addEventListener('click', (e) => {
      if (busy) return;
      if (e.shiftKey && anchor) {
        const a = d.items.findIndex((x) => x.id === anchor);
        if (a >= 0) { d.items.slice(Math.min(a, n), Math.max(a, n) + 1).forEach((x) => sel.add(x.id)); sync(); return; }
      }
      if (e.ctrlKey || e.metaKey) {
        if (sel.has(it.id)) sel.delete(it.id); else { sel.add(it.id); anchor = it.id; }
        sync();
        return;
      }
      retrieve([it.id]);
    });
    const q = mel('div', 'mb-q');
    q.textContent = it.qty;
    const tm = mel('div', 'mb-t');
    tm.textContent = it.time;
    if (secs(it.time)) tm.dataset.end = String(Date.now() + secs(it.time) * 1000);
    box.append(slot, ck, q, tm);
    grid.append(box);
  });
  if (!d.items.length) grid.append(mel('div', 'mb-none', 'Your Item Mailbox is empty.'));
  root.append(grid);
  const bar = mel('div', 'mb-bar');
  btn.type = 'button';
  btn.disabled = !d.items.length || !!prog;
  btn.addEventListener('click', () => { if (!busy) retrieve(sel.size ? [...sel] : d.items.map((i) => i.id)); });
  bar.append(btn);
  root.append(bar);
  if (prog) root.append(mel('div', 'mb-prog', 'Retrieving ' + prog.k + '/' + prog.n + ' items'));
  root.classList.toggle('busy', busy);
  const ft = mel('div', 'mb-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  ft.style.marginTop = '14px';
  root.append(ft);
  sync();
  countdown(root);
  return root;
}

// The page's own table is replaced by the one of an answer (when it is the mailbox), and the divs are made again from it.
function swap(doc) {
  const nt = tableOf(doc);
  const old = document.querySelector('table[data-ssh-mb]');
  if (!nt || !old) return false;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-mb', '1');
  old.replaceWith(fresh);
  const was = document.getElementById('ssh-mb');
  const root = build(fresh);
  if (was) was.replaceWith(root); else fresh.after(root);
  return true;
}

// The items (their numbers) one after the other: each is sent from the form the page has for it at that moment.
async function retrieve(ids) {
  if (busy || !ids.length) return;
  busy = true;
  const root = document.getElementById('ssh-mb');
  root && root.classList.add('busy');
  const label = sel.size ? 'Retrieve selected' : 'Retrieve all';
  prog = ids.length > 1 ? { k: 0, n: ids.length, label } : null;
  const showProg = () => {
    const r = document.getElementById('ssh-mb');
    if (!r || !prog) return;
    const b = r.querySelector('.mb-bar input');
    if (b) { b.disabled = true; b.value = prog.label; }
    let line = r.querySelector('.mb-prog');
    if (!line) { line = mel('div', 'mb-prog'); r.querySelector('.mb-bar').after(line); }
    line.textContent = 'Retrieving ' + prog.k + '/' + prog.n + ' items';
  };
  let done = 0;
  let bad = '';
  let last = '';
  let text = '';
  try {
    for (let k = 0; k < ids.length; k++) {
      const form = document.querySelector('table[data-ssh-mb] form[id="mailbox-collect-' + ids[k] + '"]');
      if (!form) continue; // gone (the time ran out, or taken)
      if (prog) { prog.k = k + 1; showProg(); }
      text = await fetchText('index.php', { method: 'POST', body: fieldsOf(form) });
      const doc = parseHtml(text);
      const alerts = gAlerts(doc);
      last = alertText(alerts) || last;
      sel.delete(ids[k]);
      if (alertBad(alerts)) { bad = alertText(alerts); if (!swap(doc)) await reload(); break; }
      done++;
      if (!swap(doc)) await reload();
      if (k < ids.length - 1) await new Promise((res) => setTimeout(res, 100));
    }
  } catch (e) {
    bad = bad || 'The request failed.';
  }
  if (text) {
    updateHeader(text);
    try { updateSidebars(parseHtml(text)); } catch (e) { /* the next live check has it */ }
  }
  busy = false;
  prog = null;
  note = { text: bad ? (done ? 'Retrieved ' + done + (done === 1 ? ' item. ' : ' items. ') : '') + bad : done > 1 ? 'Retrieved ' + done + ' items.' : last || (done ? 'Retrieved.' : ''), bad: !!bad };
  const r = document.getElementById('ssh-mb');
  const t = document.querySelector('table[data-ssh-mb]');
  if (t && r) r.replaceWith(build(t)); // the note and the ticks of what is left
  else if (r) r.classList.remove('busy');
}

// The page read again (an answer that was not the mailbox).
async function reload() {
  const doc = parseHtml(await fetchText('index.php?cmd=tempinv'));
  swap(doc);
}

export function initMailbox() {
  const table = tableOf(document);
  if (!table || document.getElementById('ssh-mb')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-mb', '1');
  table.after(build(table));
}
