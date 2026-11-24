import { refreshLive } from '../layout/live.js';
import { refreshDur } from '../banner.js';
import { fetchDoc } from '../core/net.js';
import { store } from '../core/storage.js';
import { harvest, idFor } from '../core/players.js';
import { esc } from '../core/util.js';
import { mModal } from '../layout/modal.js';
import { skillInfo } from '../tooltips/skills.js';

// The Quick Buff window ("Cast Skill(s)" on a profile, the Faction panel): the game's own window (its list of skills and its Buff button
// stay as they are) gets three things added, made from what the game already shows on other pages:
//  - at the top, the skills that help with casting (only Nano Blood: it halves the cost of a Cyborg class skill sometimes): its picture and
//    "Activate" in red (a click casts it on yourself), "Activated" in green when it is on (hover for what it does);
//  - under the target's box, one card per target: the last time the player was active and the skills that are on the player now, with
//    their level and time left (read from the player's own page);
//  - at the bottom, what the skills ticked cost (Energy and Surge, for all the targets) next to what you have; in the list, a mark on the
//    skills a target already has at an equal or higher level (the game then casts nothing).
// The targets' pages are found by name: the faction's member list (Manage) and the links on the page give the numbers.

const NANO = 82;
const CSS =
  // the game's message at the top ("Not enough energy ..."): light yellow with pale text; here a readable notice that stays until the next one
  '#quickBuffDialog .validateTips{margin:0 auto 8px;width:560px;max-width:100%;box-sizing:border-box;padding:6px 10px;font:12px Verdana,Arial,sans-serif;text-align:left;background:#2a1512!important;border:1px solid #7a2a22!important;border-left:3px solid #ff5a4d!important;border-radius:3px;color:#ffb3a8!important}#quickBuffDialog .validateTips:empty{display:none}' +
  '#ssh-qb-top{display:flex;justify-content:center;gap:14px;margin:2px 0 10px;font:12px Verdana,Arial,sans-serif;color:#ddd}' +
  '#ssh-qb-top .qb-bi{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:#1b1b1b;border:1px solid #3a3d3d;border-radius:3px}' +
  '#ssh-qb-top img{width:24px;height:24px}#ssh-qb-top b{color:#e8a33d}' +
  '#ssh-qb-top .qb-st{font-weight:bold}#ssh-qb-top .qb-st.off{color:#ff5a4d;cursor:pointer;text-decoration:underline}#ssh-qb-top .qb-st.on{color:#4fdc6a;cursor:help}#ssh-qb-top .qb-st.na{color:#8a8a8a;cursor:help}' +
  '#ssh-qb-tg{margin:6px auto 8px;width:560px;max-width:100%;font:11px Verdana,Arial,sans-serif;color:#ddd;text-align:left}' +
  '#ssh-qb-tg .qb-hd{background:#c9a86a;color:#1a1a1a;font-weight:bold;padding:1px 6px}' +
  '#ssh-qb-tg .qb-t{background:#1b1b1b;border:1px solid #2c2f2f;border-top:0;padding:5px 8px}' +
  '#ssh-qb-tg .qb-n{display:flex;align-items:baseline;gap:10px}#ssh-qb-tg .qb-n a{color:#e8a33d;font-size:14px;font-weight:bold;text-decoration:none}' +
  '#ssh-qb-tg .qb-la{margin-left:auto;color:#9a9488}#ssh-qb-tg .qb-x{color:#ff5a4d;cursor:pointer;font-size:14px;line-height:1}' +
  '#ssh-qb-tg .qb-b{display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:4px}#ssh-qb-tg .qb-s{display:inline-flex;align-items:center;gap:4px}' +
  '#ssh-qb-tg .qb-s img{width:18px;height:18px}#ssh-qb-tg .qb-s i{color:#9a9488;font-style:normal}#ssh-qb-tg .qb-none{color:#9a9488}' +
  '#quickBuffDialogContent .qb-ic{width:18px;height:18px;vertical-align:middle;margin:0 5px 0 2px;cursor:help}' +
  '.qb-mk{margin-left:6px;font-size:10px;font-weight:bold}.qb-mk.hi{color:#ff5a4d}.qb-mk.lo{color:#4fdc6a}' +
  '#ssh-qb-res{width:560px;max-width:100%;margin:6px auto 0;font:12px Verdana,Arial,sans-serif;color:#ddd;text-align:left}#ssh-qb-res .qb-hd{background:#c9a86a;color:#1a1a1a;font-weight:bold;padding:1px 6px}#ssh-qb-res .qb-rb{background:#1b1b1b;border:1px solid #2c2f2f;border-top:0;padding:8px 10px;line-height:1.5}#ssh-qb-res .qb-rb ul{margin:0;padding-left:18px}#ssh-qb-res .qb-rf{margin-top:8px;text-align:right}#ssh-qb-opt{display:flex;gap:18px;margin:6px auto 0;width:560px;max-width:100%;font:12px Verdana,Arial,sans-serif;color:#ddd}#ssh-qb-opt label{cursor:pointer;display:inline-flex;align-items:center;gap:5px}#ssh-qb-cost{margin:8px auto 0;width:560px;max-width:100%;font:12px Verdana,Arial,sans-serif;color:#ddd;text-align:left}#ssh-qb-cost b{margin:0 3px 0 10px}#ssh-qb-cost .bad{color:#ff5a4d}#ssh-qb-cost .ok{color:#4fdc6a}';

const files = () => window.fileserverURL || 'https://cdn.sigmastorm.com/';
const icon = (id) => files() + 'skills/' + id + '_small.gif';
const mine = () => (Array.isArray(window.skills) ? window.skills : []);

// "14 days, 23 hours, 3 mins, 3 secs" -> "14d 23h"
function since(text) {
  const u = { d: /(\d+)\s*day/, h: /(\d+)\s*hour/, m: /(\d+)\s*min/, s: /(\d+)\s*sec/ };
  const parts = Object.keys(u).map((k) => [k, +((text.match(u[k]) || [0, 0])[1])]).filter((p) => p[1] > 0);
  return parts.length ? parts.slice(0, 2).map((p) => p[1] + p[0]).join(' ') : 'now';
}

// ----- who is who: a name -> the number of the player's page (core/players.js remembers them) -----
const idOf = (name) => { harvest(); return idFor(name); }; // the links on the page give the numbers too

// ----- a player: last activity and the skills on now -----
const cache = new Map(); // number -> { at, data }
async function player(id) {
  const c = cache.get(id);
  if (c && Date.now() - c.at < 20000) return c.data;
  const doc = await fetchDoc('index.php?cmd=profile&player_id=' + id);
  const buffs = [];
  doc.querySelectorAll('img').forEach((img) => {
    const o = img.getAttribute('onmouseover') || '';
    const sm = (img.getAttribute('src') || '').match(/skills\/(\d+)_small/);
    const lv = o.match(/\(Level:\s*(\d+)\)/);
    if (!sm || !lv) return;
    const nm = (o.match(/<b>([^<]+)<\/b>/) || [0, ''])[1].trim();
    const td = img.closest('td');
    const left = ((td ? td.textContent : '').match(/\d+m\s*\d+s|\d+s/) || [''])[0];
    buffs.push({ id: sm[1], n: nm, l: +lv[1], left });
  });
  const la = (doc.body.textContent.replace(/\s+/g, ' ').match(/Last Activity:\s*([^A-Z]*?)(?=\s*[A-Z]|$)/) || [0, ''])[1];
  const data = { id, last: la ? since(la) : '', buffs };
  cache.set(id, { at: Date.now(), data });
  return data;
}

// ----- the window -----
const $ = (id) => document.getElementById(id);
let shown = ''; // what the cards were made for
let token = 0;
let infos = []; // the targets' data, for the marks in the list

const names = (input) => input.value.split(',').map((s) => s.trim()).filter(Boolean);

function tipOn(el, id, level, name) {
  el.setAttribute('data-tipskill', id);
  el.addEventListener('mouseover', () => { if (typeof window.Tip === 'function') window.Tip('<center><b>' + esc(name) + '</b>' + (level ? ' (Level: ' + level + ')' : '') + '</center>'); });
}

function boosters(content) {
  let top = $('ssh-qb-top');
  if (!top) {
    top = document.createElement('div');
    top.id = 'ssh-qb-top';
    content.prepend(top);
  }
  const s = mine().find((x) => +x.id === NANO);
  const info = skillInfo(NANO);
  const name = (info && info.n) || 'Nano Blood';
  const state = s && s.t > 0 ? 'on' : 'off';
  const level = s ? s.level : 0;
  if (top.dataset.s === state + level) return;
  top.dataset.s = state + level;
  top.innerHTML = '<span class="qb-bi"><img alt=""><b></b><span class="qb-st"></span></span>';
  const bi = top.firstChild;
  bi.querySelector('img').src = icon(NANO);
  bi.querySelector('b').textContent = name;
  const st = bi.querySelector('.qb-st');
  st.className = 'qb-st ' + state;
  st.textContent = state === 'on' ? 'Activated' : 'Activate';
  tipOn(bi, NANO, level, name);
  if (state === 'off') {
    st.addEventListener('click', () => {
      const a = document.querySelector('#skillBoxData a[data-mode="cast"][data-skill="' + NANO + '"]');
      if (!a) { // the skill is not in the Skills box: it is not learned
        const msg = document.createElement('div');
        msg.textContent = 'You have not learned ' + name + '.';
        mModal(name, msg, [{ text: 'Close' }]);
        return;
      }
      st.textContent = 'Activating...';
      a.click(); // the game's own request, as the Skills box does it: the label changes when the skills are drawn again
      setTimeout(() => { top.dataset.s = ''; }, 6000);
    });
  }
}

function costOf(ids) {
  const sum = { Energy: 0, Surge: 0 };
  ids.forEach((id) => {
    const info = skillInfo(id);
    ((info && info.x) || []).forEach((l) => {
      const m = l.match(/^(Energy|Surge):\s*(\d+)/);
      if (m) sum[m[1]] += +m[2];
    });
  });
  return sum;
}
const have = (id) => {
  const el = $(id);
  const m = el && el.parentElement.textContent.replace(/,/g, '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? +m[1] : null;
};

function cost(content, input) {
  let box = $('ssh-qb-cost');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ssh-qb-cost';
    const list = content.querySelector('table[width="450"]'); // under the list of skills (the game's table is tall)
    if (list) list.insertAdjacentElement('afterend', box); else content.append(box);
  }
  const picked = [...content.querySelectorAll('input[name="skills[]"]:checked')].map((i) => i.value);
  const n = Math.max(1, names(input).length);
  const c = costOf(picked);
  const e = have('staminaCurrent');
  const g = have('surgeImg');
  const part = (label, v, h) => '<b>' + label + '</b><span class="' + (h !== null && v * n > h ? 'bad' : v ? 'ok' : '') + '">' + (v * n).toLocaleString() + '</span> / ' + (h === null ? '?' : h.toLocaleString());
  box.innerHTML = 'Cost' + (n > 1 ? ' (' + n + ' targets)' : '') + ':' + part('Energy', c.Energy, e) + part('Surge', c.Surge, g);
}

// the skills of the list get their picture, and the tooltip of the skill (its description with the values of the level shown in the list)
function icons(content) {
  let added = false;
  content.querySelectorAll('input[name="skills[]"]').forEach((inp) => {
    const lab = content.querySelector('label[for="' + inp.id + '"]');
    if (!lab || lab.dataset.qbIc) return;
    lab.dataset.qbIc = '1';
    const level = +((lab.textContent.match(/\[(\d+)\]/) || [0, 0])[1]);
    const name = lab.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
    const img = document.createElement('img');
    img.className = 'qb-ic';
    img.alt = '';
    img.src = icon(inp.value);
    lab.prepend(img);
    tipOn(lab, inp.value, level, name);
    added = true;
  });
  return added;
}

// a mark on the skills of the list that a target has already
function marks(content) {
  content.querySelectorAll('input[name="skills[]"]').forEach((inp) => {
    const lab = content.querySelector('label[for="' + inp.id + '"]');
    if (!lab) return;
    lab.querySelectorAll('.qb-mk').forEach((m) => m.remove());
    const lv = +((lab.textContent.match(/\[(\d+)\]/) || [0, 0])[1]);
    const on = infos.map((p) => p && p.buffs.find((b) => b.id === inp.value)).filter(Boolean);
    if (!on.length) return;
    const top = Math.max(...on.map((b) => b.l));
    const m = document.createElement('span');
    const hi = on.some((b) => b.l >= lv);
    m.className = 'qb-mk ' + (hi ? 'hi' : 'lo');
    m.textContent = hi ? '(on ' + top + ')' : '(on ' + top + ', raises)';
    m.title = hi ? 'A target has this skill at your level or higher: the game casts nothing' : 'A target has this skill at a lower level';
    lab.append(m);
  });
}

function cards(content, input) {
  let box = $('ssh-qb-tg');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ssh-qb-tg';
    const t = input.closest('table');
    (t || input).insertAdjacentElement('afterend', box);
  }
  const list = names(input);
  const key = list.join(',').toLowerCase();
  if (key === shown) return;
  shown = key;
  const mineTok = ++token;
  box.innerHTML = '<div class="qb-hd">Current Target(s)</div>';
  infos = [];
  list.forEach((name, i) => {
    const card = document.createElement('div');
    card.className = 'qb-t';
    card.innerHTML = '<div class="qb-n"><a></a><span class="qb-la"></span><span class="qb-x" title="Remove">&#10006;</span></div><div class="qb-b"><span class="qb-none">Loading...</span></div>';
    card.querySelector('a').textContent = name;
    card.querySelector('.qb-x').addEventListener('click', () => {
      input.value = names(input).filter((n) => n.toLowerCase() !== name.toLowerCase()).join(', ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    box.append(card);
    (async () => {
      const id = await idOf(name);
      const b = card.querySelector('.qb-b');
      if (!id) { b.innerHTML = '<span class="qb-none">No information (player not found)</span>'; return; }
      const p = await player(id);
      if (mineTok !== token) return;
      infos[i] = p;
      const a = card.querySelector('a');
      a.href = 'index.php?cmd=profile&player_id=' + id;
      card.querySelector('.qb-la').textContent = p.last ? 'Last Activity: ' + p.last : '';
      b.textContent = '';
      if (!p.buffs.length) b.innerHTML = '<span class="qb-none">No skills active</span>';
      p.buffs.forEach((s) => {
        const e = document.createElement('span');
        e.className = 'qb-s';
        e.innerHTML = '<img alt=""><span></span><i></i>';
        e.querySelector('img').src = icon(s.id);
        e.querySelector('span').textContent = s.n + ' [' + s.l + ']';
        e.querySelector('i').textContent = s.left;
        tipOn(e, s.id, s.l, s.n);
        b.append(e);
      });
      marks(content);
    })().catch(() => { card.querySelector('.qb-b').innerHTML = '<span class="qb-none">Could not read the player</span>'; });
  });
}

// "Select all" ticks every skill; "Sort alphabetically" orders each column by name (the game's order comes back when it is off; kept for next time).
const nameOf = (row) => {
  const lab = row.querySelector('label');
  if (!lab) return '';
  const c = lab.cloneNode(true);
  c.querySelectorAll('.qb-mk').forEach((m) => m.remove());
  return c.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
};
function order(content, alpha) {
  content.querySelectorAll('input[name="skills[]"]').forEach((i) => {
    const row = i.closest('tr');
    if (row && row.dataset.o === undefined) row.dataset.o = String(i.id.split('_').pop());
  });
  const tables = new Set([...content.querySelectorAll('input[name="skills[]"]')].map((i) => i.closest('table')));
  tables.forEach((t) => {
    if (!t || t.dataset.alpha === String(alpha)) return;
    t.dataset.alpha = String(alpha);
    const body = t.tBodies[0] || t;
    const rows = [...body.querySelectorAll(':scope > tr')].filter((r) => r.querySelector('input[name="skills[]"]'));
    rows.sort((a, b) => alpha ? nameOf(a).localeCompare(nameOf(b)) : (+a.dataset.o) - (+b.dataset.o));
    rows.forEach((r) => body.append(r));
  });
}
function options(content) {
  const cost = $('ssh-qb-cost');
  if (!cost) return;
  let box = $('ssh-qb-opt');
  if (!box) {
    box = document.createElement('div');
    box.id = 'ssh-qb-opt';
    box.innerHTML = '<label><input type="checkbox" id="ssh-qb-all"> Select all</label><label><input type="checkbox" id="ssh-qb-alpha"> Sort alphabetically</label>';
    cost.insertAdjacentElement('afterend', box);
    const all = box.querySelector('#ssh-qb-all');
    const alpha = box.querySelector('#ssh-qb-alpha');
    alpha.checked = !!store.get('qbAlpha', false);
    all.addEventListener('change', () => {
      content.querySelectorAll('input[name="skills[]"]').forEach((i) => { if (i.checked !== all.checked) i.click(); });
    });
    alpha.addEventListener('change', () => { store.set('qbAlpha', alpha.checked); order(content, alpha.checked); });
  }
  const alpha = box.querySelector('#ssh-qb-alpha');
  order(content, alpha.checked);
  const boxes = [...content.querySelectorAll('input[name="skills[]"]')];
  box.querySelector('#ssh-qb-all').checked = boxes.length > 0 && boxes.every((i) => i.checked);
}

// The game answers a cast with a second window ("Quick Buff Result"). Here the answer takes the place of what is in the Quick Buff window
// (the second window is not shown), with a Back button for the list again.
let stash = null;
const pane = () => (window.quickBuffDialog ? window.quickBuffDialog.dialog('widget').find('.ui-dialog-buttonpane button') : null);
function back() {
  const content = $('quickBuffDialogContent');
  const res = $('ssh-qb-res');
  if (!content || !stash) return;
  if (res) res.remove();
  content.append(stash);
  stash = null;
  shown = '';
  fitted = false;
  const b = pane();
  if (b) b.each((i, e) => { e.style.display = ''; });
}
function showResult() {
  const rc = window.quickBuffResultDialogContent;
  const content = $('quickBuffDialogContent');
  if (!rc || !content) return;
  const html = rc.html();
  window.quickBuffResultDialog.dialog('close');
  if (!stash) {
    stash = document.createDocumentFragment();
    [...content.childNodes].forEach((n) => stash.append(n));
  } else { const old = $('ssh-qb-res'); if (old) old.remove(); }
  const box = document.createElement('div');
  box.id = 'ssh-qb-res';
  box.innerHTML = '<div class="qb-hd">Quick Buff Result</div><div class="qb-rb"></div><div class="qb-rf"><button type="button" class="custombutton">Back</button></div>';
  box.querySelector('.qb-rb').innerHTML = html;
  box.querySelector('button').addEventListener('click', back);
  content.append(box);
  const b = pane();
  if (b) b.each((i, e) => { if (!/^close$/i.test(e.textContent.trim())) e.style.display = 'none'; });
  fit(content);
  refreshLive();
  refreshDur(0);
}
let hooked = false;
function hookResult() {
  if (hooked || !window.quickBuffResultDialog || typeof window.quickBuffResultDialog.dialog !== 'function') return;
  hooked = true;
  const w = window.quickBuffResultDialog.dialog('widget');
  w.css('opacity', '0'); // never seen: its content is shown in the Quick Buff window
  window.quickBuffResultDialog.bind('dialogopen', () => { try { showResult(); } catch (e) { w.css('opacity', '1'); } });
}

// The game's window has a fixed height (and its table is 500 high): the window is as tall as its content, and put in the middle again.
let fitted = false;
function fit(content) {
  const dlg = window.quickBuffDialog;
  const $j = window.jQuery;
  if (!dlg || !$j || typeof dlg.dialog !== 'function') return;
  content.querySelectorAll('table[height]').forEach((t) => t.removeAttribute('height'));
  content.style.height = 'auto';
  content.style.minHeight = '0';
  try {
    dlg.dialog('option', 'height', 'auto');
    dlg.dialog('option', 'position', { my: 'center', at: 'center', of: window });
  } catch (e) { /* the window stays as it is */ }
}

function tick() {
  hookResult();
  if (stash && window.quickBuffDialog && !window.quickBuffDialog.dialog('isOpen')) back(); // closed with the answer showing: the list is there next time
  const input = $('quickBuffDialog_targetPlayers');
  if (!input || !input.offsetParent) { if (!$('ssh-qb-res')) fitted = false; return; }
  const content = $('quickBuffDialogContent') || input.closest('div');
  if (!content) return;
  if (!$('ssh-qb-css')) {
    const st = document.createElement('style');
    st.id = 'ssh-qb-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  if (!$('ssh-qb-tg')) shown = '';
  boosters(content);
  cards(content, input);
  cost(content, input);
  options(content);
  if (icons(content)) fitted = false;
  if (!fitted) { fitted = true; fit(content); setTimeout(() => fit(content), 1200); }
}

export function bindQuickBuff() {
  document.addEventListener('change', (e) => {
    if (!e.target || !e.target.matches || !e.target.matches('#quickBuffDialogContent input[name="skills[]"], #quickBuffDialogContent input[type="checkbox"]')) return;
    const input = $('quickBuffDialog_targetPlayers');
    const content = $('quickBuffDialogContent');
    if (input && content) setTimeout(() => cost(content, input), 0);
  }, true);
  setInterval(tick, 500);
}
