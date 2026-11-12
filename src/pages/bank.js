import { fetchText, navigate } from '../core/net.js';
import { S } from '../core/state.js';
import { cssUrl, digits, https, parseHtml } from '../core/util.js';
import { updateHeader } from '../banner.js';
import { mel } from '../layout/dom.js';
import { updateSidebars } from '../layout/sidebars.js';
import { addSlider } from '../layout/slider.js';

// The Bank page (cmd=bank; opened with a POST it has no cmd in the address) for the Modern layout, made of divs: .bk-head (picture), .bk-intro
// (the game's text, with its message box after a deposit or a withdraw), .bk-box (Bank Details: balance, deposits, the deposit and the withdraw
// row, each with a number box, a button and a slider) and .bk-foot. The game's table stays in the page, hidden in the Modern layout, so the
// Original layout is untouched. The game draws its sliders with a script of its own whose pictures come from an http address (blocked), so the
// helper's slider (layout/slider.js) is used: 0 up to the Current Max Deposit for the deposit, 0 up to the Account Balance for the withdraw.
// A deposit or a withdraw is sent in the background with the game's own form fields and the page content is replaced by the answer.

const CSS = '#ssh-bk{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif;transition:opacity .15s}' +
  'html.ssh-modern #ssh-bk{display:block}html.ssh-modern [data-ssh-bk]{display:none!important}' +
  '#ssh-bk.busy{opacity:.55;pointer-events:none}' +
  '#ssh-bk .bk-head,#ssh-bk .bk-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-bk .bk-intro{padding:12px 45px 6px;line-height:1.45;text-align:left}' +
  '#ssh-bk .bk-box{width:550px;margin:12px auto 18px}' +
  '#ssh-bk .bk-title{height:20px;line-height:20px;background:#212323;text-align:center;color:#fff}' +
  '#ssh-bk .bk-row{display:flex;align-items:center;min-height:26px;padding:0 14px}' +
  '#ssh-bk .bk-row>.k{width:150px;flex:none}#ssh-bk .bk-row>.v{flex:1;display:flex;align-items:center;gap:4px;color:#fff}' +
  '#ssh-bk .bk-row img{vertical-align:middle}' +
  '#ssh-bk .bk-line{height:1px;margin:6px 14px;background:#544e38}' +
  '#ssh-bk .bk-do{align-items:flex-start;padding-top:6px;padding-bottom:6px}#ssh-bk .bk-do>.k{padding-top:4px}' +
  '#ssh-bk .bk-form{display:block;width:250px}' +
  '#ssh-bk .bk-in{display:flex;gap:8px}' +
  '#ssh-bk input.bk-num{flex:1;min-width:0;height:22px;box-sizing:border-box;padding:0 6px;background:#0a1011;color:#fff;border:1px solid #5a5f5f;font:11px Arial,sans-serif}' +
  '#ssh-bk input.bk-num:disabled{opacity:.5}' +
  '#ssh-bk button.bk-btn{min-width:76px;height:22px;padding:0 12px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-bk button.bk-btn:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-bk button.bk-btn:disabled{opacity:.45;cursor:default}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
let busy = false;

// A copy of a piece of the game's markup with its pictures on https and without scripts.
function copyOf(n) {
  const c = n.cloneNode(true);
  if (c.nodeType !== 1) return c;
  c.querySelectorAll('script').forEach((s) => s.remove());
  c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
  return c;
}

const tableOf = (doc) => {
  const f = doc.getElementById('deposit_amount') || doc.getElementById('withdraw_amount');
  return f && f.closest('table[width="640"]');
};

// What the game's table says.
function read(t) {
  const head = t.querySelector('td[background*="header_"], td[background*="bank_header"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const inner = t.querySelector('table[width="550"] table[width="100%"]');
  const rows = inner ? [...inner.rows].filter((r) => r.cells.length === 2) : [];
  const by = (re) => rows.find((r) => re.test(txt(r.cells[0])));
  const val = (r) => (r ? r.cells[1] : null);
  const form = (id) => t.querySelector('#' + id);
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    intro: t.rows[1] && t.rows[1].cells[0],
    title: txt(t.querySelector('td[bgcolor="#212323"]')) || 'Bank Details',
    rows: [by(/^Account Balance/), by(/^Deposits Available/), by(/^Current Max Deposit/)].filter(Boolean),
    dep: { row: by(/^Deposit \[/), form: form('vault-deposit'), box: t.querySelector('#deposit_amount') },
    wd: { row: by(/^Withdraw \[/), form: form('vault-withdraw'), box: t.querySelector('#withdraw_amount') },
    balance: digits(txt(val(by(/^Account Balance/)))),
    maxDep: digits(txt(val(by(/^Current Max Deposit/)))),
  };
}

// The value cell of a row: the bold number(s) and the coin picture, as they are.
function valueOf(td) {
  const v = mel('div', 'v');
  [...td.childNodes].forEach((n) => {
    if (n.nodeType === 1 && n.tagName === 'TABLE') {
      const cells = [...n.querySelectorAll('td')];
      cells.forEach((c) => c.childNodes.forEach((x) => v.append(copyOf(x))));
    } else if (n.nodeType !== 1 || n.tagName !== 'SCRIPT') v.append(copyOf(n));
  });
  return v;
}

// A deposit or a withdraw row: the label (with its help link), the number box, the button and the slider.
function action(a, max, kind) {
  const row = mel('div', 'bk-row bk-do');
  const k = mel('div', 'k');
  [...a.row.cells[0].childNodes].forEach((n) => k.append(copyOf(n)));
  const v = mel('div', 'v');
  const f = mel('form', 'bk-form');
  const line = mel('div', 'bk-in');
  const num = mel('input', 'bk-num');
  num.type = 'text';
  num.autocomplete = 'off';
  num.value = a.box ? a.box.value : '';
  num.disabled = !a.box || a.box.disabled;
  const btn = a.form && a.form.querySelector('input[type=submit], button');
  const b = mel('button', 'bk-btn');
  b.type = 'submit';
  b.textContent = (btn && (btn.value || btn.textContent)) || (kind === 'dep' ? 'Deposit' : 'Withdraw');
  b.disabled = !btn || btn.disabled;
  line.append(num, b);
  f.append(line);
  v.append(f);
  row.append(k, v);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (b.disabled || num.disabled) return;
    a.box.value = num.value; // the game's own form carries the amount
    send(a.form);
  });
  const sl = addSlider(num, { max, after: line, width: 250 });
  sl.el.style.marginTop = '6px';
  return row;
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-bk';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'bk-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.intro) {
    const b = mel('div', 'bk-intro');
    [...d.intro.childNodes].forEach((n) => b.append(copyOf(n)));
    root.append(b);
  }
  const box = mel('div', 'bk-box');
  const title = mel('div', 'bk-title');
  title.textContent = d.title;
  box.append(title);
  d.rows.forEach((r) => {
    const row = mel('div', 'bk-row');
    const k = mel('div', 'k');
    [...r.cells[0].childNodes].forEach((n) => k.append(copyOf(n)));
    row.append(k, valueOf(r.cells[1]));
    box.append(row);
  });
  box.append(mel('div', 'bk-line'));
  if (d.dep.row) box.append(action(d.dep, d.maxDep, 'dep'));
  if (d.wd.row) box.append(action(d.wd, d.balance, 'wd'));
  root.append(box);
  const ft = mel('div', 'bk-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  root.append(ft);
  return root;
}

// The page's own table is replaced by the one of the answer, and the divs are made again from it.
function swap(doc) {
  const nt = tableOf(doc);
  const cur = document.querySelector('table[data-ssh-bk]');
  if (!nt || !cur) return false;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-bk', '1');
  cur.replaceWith(fresh);
  const old = document.getElementById('ssh-bk');
  const root = build(fresh);
  if (old) old.replaceWith(root); else fresh.after(root);
  return true;
}

// The fields of a game form that are sent (the token and the one-time value are not: fetch adds fresh ones).
function fieldsOf(form) {
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button') body.append(e.name, e.value); });
  return body;
}

async function send(form) {
  if (busy) return;
  busy = true;
  const root = document.getElementById('ssh-bk');
  root && root.classList.add('busy');
  let swapped = false;
  try {
    const text = await fetchText('index.php', { method: 'POST', body: fieldsOf(form) });
    const doc = parseHtml(text);
    swapped = swap(doc); // the game's own message comes along in the page text
    updateHeader(text);
    try { updateSidebars(doc); } catch (e) { /* the next live check has it */ }
  } catch (e) {
    swapped = false;
  }
  busy = false;
  const r = document.getElementById('ssh-bk');
  if (r) r.classList.remove('busy');
  if (!swapped) navigate('index.php?cmd=bank'); // not the bank page: let the browser show what the game made of it
}

export function initBank() {
  const table = tableOf(document);
  if (!table || document.getElementById('ssh-bk')) return;
  const st = mel('style');
  st.textContent = CSS + '#sl0base,#sl1base{display:none!important}';
  document.head.append(st);
  table.setAttribute('data-ssh-bk', '1');
  table.after(build(table));
  // the game's own page (Original layout) gets the helper's sliders too, in place of its blocked ones
  const d = read(table);
  [[d.dep.box, d.maxDep, 'sl0base'], [d.wd.box, d.balance, 'sl1base']].forEach(([box, max, id]) => {
    if (box) addSlider(box, { max, after: document.getElementById(id) || undefined });
  });
}
