import { updateHeader } from '../banner.js';
import { fetchText } from '../core/net.js';
import { S } from '../core/state.js';
import { alertBad, alertText, cssUrl, digits, https, parseHtml, sleep } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { gAlerts } from '../layout/modal.js';
import { updateSidebars } from '../layout/sidebars.js';

// The Evolve page (cmd=levelup) for the Modern layout, made of divs: .ev-head (picture), .ev-img, .ev-intro, .ev-pts (the points left),
// .ev-use (how many points one click spends), .ev-stats (.ev-row: name, value, button) and .ev-foot. The game's table stays in the page, hidden in
// the Modern layout, so the Original layout is untouched.
// Every "Add +N" button sends the game's own small POST form (cmd=levelup, subcmd=dolevelup, player_id, levelup_id) N times, one after the other
// (the token and the one-time value are added by the fetch the helper wraps, see core/net.js), and shows how many are done. It stops at the first
// answer that is a message of the game that is an error or a warning, or where the points did not go down.

const CSS = '#ssh-ev{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:13px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-ev{display:block}html.ssh-modern [data-ssh-ev]{display:none!important}' +
  '#ssh-ev .ev-head,#ssh-ev .ev-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-ev .ev-img{text-align:center;padding-top:10px;line-height:0}' +
  '#ssh-ev .ev-intro{width:570px;margin:0 auto;padding:12px 0 8px;font-size:11px;line-height:1.4}' +
  '#ssh-ev .ev-pts{width:30%;min-width:200px;margin:4px auto 0;padding:5px;box-sizing:border-box;border:1px solid #000;text-align:center}' +
  '#ssh-ev .ev-pts b{margin-left:6px;color:#fff}' +
  '#ssh-ev .ev-use{display:flex;align-items:center;justify-content:center;gap:6px;margin:10px auto 0;font-size:12px}' +
  '#ssh-ev .ev-use input[type=number]{width:56px;height:22px;box-sizing:border-box;padding:2px 4px;background:#0b0e0e;color:#d8cfbf;border:1px solid #5a5f5f;text-align:center;font:12px Arial,sans-serif}' +
  '#ssh-ev .ev-use input[type=number]:focus{outline:0;border-color:#9fe0ff}' +
  '#ssh-ev .ev-stats{width:360px;margin:14px auto 0}' +
  '#ssh-ev .ev-row{display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #212323}' +
  '#ssh-ev .ev-row.hd{padding:3px 0;background:#212323;border-bottom:0;font-weight:bold;white-space:nowrap}' +
  '#ssh-ev .ev-row>div:nth-child(1){flex:1 1 0;padding-left:4px}#ssh-ev .ev-row>div:nth-child(2){flex:1 1 0;text-align:center}' +
  '#ssh-ev .ev-row>div:nth-child(3){flex:0 0 110px;text-align:right}' +
  '#ssh-ev .ev-row b{color:#fff}' +
  '#ssh-ev .ev-msg{min-height:20px;margin:12px auto 0;padding:0 20px;text-align:center;font-size:12px}' +
  '#ssh-ev .ev-msg.bad{color:#ff8a80}#ssh-ev .ev-msg.ok{color:#7fe08a}' +
  '#ssh-ev .ev-spin{display:inline-block;width:14px;height:14px;margin-right:6px;box-sizing:border-box;border:2px solid #4a5a5a;border-top-color:#9fe0ff;border-radius:50%;animation:ssh-ev-rot .7s linear infinite;vertical-align:middle}' +
  '@keyframes ssh-ev-rot{to{transform:rotate(360deg)}}' +
  '#ssh-ev button{min-width:68px;height:22px;padding:0 8px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-ev button:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-ev button:disabled{opacity:.5;cursor:default}';

let want = 1; // the points one click spends (kept when the page is built again)
let busy = false;

// What the game's table says: the picture, the text, the points left and the stats (name, value, form).
function read(t) {
  const head = t.querySelector('td[background*="header_"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const intro = t.querySelector('table[width="570"] td');
  const stats = [...t.querySelectorAll('tr[data-evolution-id]')].map((tr) => ({
    id: tr.getAttribute('data-evolution-id'),
    name: tr.cells[0].textContent.replace(/\s+/g, ' ').trim(),
    value: tr.querySelector('.evolution-value') ? tr.querySelector('.evolution-value').textContent.trim() : '',
    form: tr.querySelector('form'),
  }));
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    img: t.querySelector('img'),
    intro,
    points: digits((t.querySelector('#evolution-points') || {}).textContent),
    labels: [...t.querySelectorAll('td[bgcolor] b')].map((b) => b.textContent.trim()), // the head line of the stats: Stat, Current Value (Base)
    stats,
  };
}

// The fields of a game form that are sent again for every point (the token and the one-time value are not: fetch adds fresh ones).
function fieldsOf(form) {
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit') body.append(e.name, e.value); });
  return body;
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-ev';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'ev-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.img) {
    const im = mel('div', 'ev-img');
    const i = d.img.cloneNode(false);
    i.src = https(d.img.getAttribute('src'));
    im.append(i);
    root.append(im);
  }
  if (d.intro) root.append(mel('div', 'ev-intro', d.intro.innerHTML));
  const pts = mel('div', 'ev-pts');
  pts.append('Evolution Points:', mel('b', '', String(d.points)));
  pts.lastChild.id = 'ssh-ev-points';
  root.append(pts);
  // how many points one click spends: 1 up to the points left
  const use = mel('div', 'ev-use');
  const inp = mel('input');
  inp.type = 'number';
  inp.min = '1';
  inp.max = String(Math.max(1, d.points));
  inp.value = String(Math.max(1, Math.min(want, d.points)));
  inp.title = 'How many points one click on Add spends (up to the points you have)';
  const all = mel('button', '', 'Max');
  all.type = 'button';
  all.title = 'All the points you have';
  all.addEventListener('click', () => { inp.value = inp.max; inp.dispatchEvent(new Event('input')); });
  use.append('Points to spend per click:', inp, all);
  root.append(use);
  const msg = mel('div', 'ev-msg');
  const stats = mel('div', 'ev-stats');
  const row0 = mel('div', 'ev-row hd');
  row0.append(mel('div', '', d.labels[0] || 'Stat'), mel('div', '', d.labels[1] || 'Current Value (Base)'), mel('div'));
  stats.append(row0);
  const buttons = [];
  const n = () => Math.max(1, Math.min(d.points, parseInt(inp.value, 10) || 1));
  d.stats.forEach((s) => {
    const row = mel('div', 'ev-row');
    row.dataset.id = s.id;
    const val = mel('b', '', s.value);
    val.className = 'ev-val';
    const vc = mel('div');
    vc.append(val);
    const bc = mel('div');
    const b = mel('button', '', 'Add +' + n());
    b.type = 'button';
    b.disabled = !s.form || d.points < 1;
    b.addEventListener('click', () => spend(root, s, n(), buttons, inp));
    buttons.push(b);
    bc.append(b);
    row.append(mel('div', '', ''), vc, bc);
    row.firstChild.textContent = s.name;
    stats.append(row);
  });
  const label = () => { want = n(); buttons.forEach((b) => { if (!busy) b.textContent = 'Add +' + n(); }); };
  inp.addEventListener('input', () => { if (inp.value !== '') { const v = Math.max(1, Math.min(d.points, parseInt(inp.value, 10) || 1)); if (String(v) !== inp.value && d.points > 0) inp.value = String(v); } label(); });
  inp.addEventListener('change', () => { inp.value = String(n()); label(); });
  use.hidden = d.points < 1;
  root.append(stats, msg);
  const ft = mel('div', 'ev-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  root.append(ft);
  return root;
}

const say = (root, html, kind, spin) => {
  const m = root.querySelector('.ev-msg');
  m.className = 'ev-msg' + (kind ? ' ' + kind : '');
  m.textContent = '';
  if (spin) m.append(mel('span', 'ev-spin'));
  m.append(html);
};

// The page's own table is replaced by the one of the last answer, and the divs are made again from it.
function show(table, doc) {
  const next = doc.querySelector('form[id^="evolution-stat-"]');
  const nt = next && next.closest('table[width="640"]');
  if (!nt) return null;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-ev', '1');
  table.replaceWith(fresh);
  const old = document.getElementById('ssh-ev');
  const root = build(fresh);
  if (old) old.replaceWith(root); else fresh.after(root);
  return { table: fresh, root };
}

// One click: the same form sent `count` times, one answer after the other.
async function spend(root, stat, count, buttons, inp) {
  if (busy || !stat.form) return;
  busy = true;
  const table = document.querySelector('table[data-ssh-ev]');
  buttons.forEach((b) => { b.disabled = true; });
  inp.disabled = true;
  let doc = null;
  let html = '';
  let done = 0;
  let note = '';
  let bad = false;
  let fields = fieldsOf(stat.form);
  try {
    for (let i = 0; i < count; i++) {
      say(root, 'Adding +1 to ' + stat.name + ': ' + done + ' of ' + count + ' done...', '', true);
      const before = digits((document.getElementById('ssh-ev-points') || {}).textContent);
      const text = await fetchText('index.php', { method: 'POST', body: new URLSearchParams(fields) });
      const d = parseHtml(text);
      const alerts = gAlerts(d);
      const left = d.getElementById('evolution-points');
      const f = d.getElementById('evolution-stat-' + stat.id);
      html = text;
      doc = d;
      if (alertBad(alerts)) { note = alertText(alerts); bad = true; break; }
      if (!left || digits(left.textContent) >= before) { note = alertText(alerts) || 'The game did not spend the point.'; bad = true; break; }
      done++;
      const pe = document.getElementById('ssh-ev-points');
      if (pe) pe.textContent = String(digits(left.textContent));
      const v = d.querySelector('tr[data-evolution-id="' + stat.id + '"] .evolution-value');
      const ve = root.querySelector('.ev-row[data-id="' + stat.id + '"] .ev-val');
      if (v && ve) ve.textContent = v.textContent.trim();
      if (!f) break;
      fields = fieldsOf(f); // the answer carries the form again
      if (i < count - 1) await sleep(80);
    }
  } catch (e) {
    note = 'The request failed.';
    bad = true;
  }
  busy = false;
  if (doc) {
    const r = table && show(table, doc);
    updateHeader(html);
    try { updateSidebars(doc); } catch (e) { /* the next live check has it */ }
    if (!r) { buttons.forEach((b) => { b.disabled = false; }); inp.disabled = false; }
    const root2 = r ? r.root : root;
    say(root2, bad ? 'Added +' + done + ' of ' + count + ' to ' + stat.name + '. ' + note : 'Added +' + done + ' to ' + stat.name + '.', bad ? 'bad' : 'ok');
    return;
  }
  buttons.forEach((b) => { b.disabled = false; });
  inp.disabled = false;
  say(root, note, 'bad');
}

export function initEvolve() {
  const form = document.querySelector('form[id^="evolution-stat-"]');
  const table = form && form.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-ev')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-ev', '1');
  table.after(build(table));
}
