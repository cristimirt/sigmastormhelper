import { refreshDur, updateHeader } from '../banner.js';
import { SSH } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { closeLog, placeResults, refreshWorld } from './combat.js';

// A panel on the page itself (not in the map), draggable anywhere; it scrolls with the page.
function ensurePanel() {
  let p = document.getElementById('ssh-al');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ssh-al';
  p.innerHTML = '<div class="hd">Action List<span class="rf" title="Refresh the list [R]">&#8635;</span></div><div class="bd"></div>';
  document.body.appendChild(p);
  const pos = store.get('alpos', null);
  if (pos) {
    p.style.left = pos.x + 'px';
    p.style.top = pos.y + 'px';
  } else {
    const r = S.viewer.getBoundingClientRect();
    p.style.left = Math.max(8, r.right + window.scrollX - 278) + 'px';
    p.style.top = Math.max(8, r.top + window.scrollY + 8) + 'px';
  }
  clampPanel();
  let drag = null;
  p.querySelector('.hd').addEventListener('pointerdown', (e) => {
    if (e.target.closest('.rf')) return; // the refresh button is a button, not a handle
    drag = { dx: e.pageX - p.offsetLeft, dy: e.pageY - p.offsetTop };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  p.querySelector('.hd').addEventListener('pointermove', (e) => {
    if (!drag) return;
    p.style.left = e.pageX - drag.dx + 'px';
    p.style.top = e.pageY - drag.dy + 'px';
    clampPanel();
  });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
    store.set('alpos', { x: p.offsetLeft, y: p.offsetTop });
  };
  p.querySelector('.hd').addEventListener('pointerup', end);
  p.querySelector('.hd').addEventListener('pointercancel', end);
  window.addEventListener('resize', clampPanel);
  return p;
}

// Keeps the panel (at least its header) inside the window.
function clampPanel() {
  const p = document.getElementById('ssh-al');
  if (!p) return;
  const x = Math.min(Math.max(0, p.offsetLeft), Math.max(0, document.documentElement.scrollWidth - 60));
  const y = Math.min(Math.max(0, p.offsetTop), Math.max(0, document.documentElement.scrollHeight - 30));
  p.style.left = x + 'px';
  p.style.top = y + 'px';
}

// The creature list of the page, shown in the floating action list.
// The game's action buttons are <input type=image> controls that only work inside their original form,
// which is lost when the markup is copied. So find the matching original control and submit its form data.
export function submitAction(clone) {
  const ad = document.getElementById('actionDiv');
  const t = ad && ad.nextElementSibling;
  if (!t) return;
  const sel = 'input[type="image"], input[type="submit"], button';
  const panel = document.getElementById('ssh-al');
  const idx = [...panel.querySelectorAll(sel)].indexOf(clone);
  const target = [...t.querySelectorAll(sel)][idx];
  if (!target) return;
  let form = { action: 'index.php', method: 'post' };
  let fields = [];
  for (const el of t.querySelectorAll('form, input, button, select, textarea')) {
    if (el.tagName === 'FORM') {
      form = { action: el.getAttribute('action') || 'index.php', method: (el.getAttribute('method') || 'post').toLowerCase() };
      fields = [];
    } else if (el === target) {
      break;
    } else if (el.name && el.type !== 'image' && el.type !== 'submit' && el.type !== 'button') {
      fields.push([el.name, el.value]);
    }
  }
  if (!fields.some((f) => f[0] === 'cmd') && /assembly|inventing/i.test((target.title || '') + (clone.title || ''))) fields.push(['cmd', 'inventing']);
  if (target.name && target.type === 'submit') fields.push([target.name, target.value]);
  else if (target.name) { fields.push([target.name + '.x', '1'], [target.name + '.y', '1']); }
  const submitForm = () => {
  const f = document.createElement('form');
  f.method = form.method;
  f.action = form.action;
  f.style.display = 'none';
  fields.forEach(([n, v]) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = n;
    i.value = v;
    f.appendChild(i);
  });
  document.body.appendChild(f);
  f.submit();
  };
  if (form.method === 'post' && fields.some((f) => f[0] === 'subcmd' && f[1] === 'questaction')) { doQuest(form.action, fields, submitForm); return; }
  if (form.method === 'post' && fields.some((f) => f[0] === 'subcmd' && f[1] === 'heal')) { doHeal(form.action, fields, submitForm); return; }
  if (form.method === 'post' && fields.some((f) => f[0] === 'subcmd' && f[1] === 'usestairs')) {
    // a stairway changes the zone: send it in the background and swap the map in, like a step. Some stairways lead to a page
    // without a map (a hub): the move is done by then, so reload the page to show it. If the game answered with a message
    // (the stairway was refused) or the request failed, send the form the old way so the message shows / it is tried again.
    const body = new URLSearchParams();
    fields.forEach(([n, v]) => body.append(n, v));
    SSH.go(form.action, { method: 'POST', body }, (html) => { if (html && !/INFORMATION ALERT/i.test(html)) location.reload(); else submitForm(); });
    return;
  }
  submitForm();
}

// Healing at a healer: the same request as the game's button, in the background; the game's message in the list in place of the
// cost line, the banner (HP, credits) updated from the answer, the list read again. If the request itself fails, nothing was done, so
// the form is sent the old way.
async function doHeal(action, fields, fallback) {
  if (S.busy || S.pending) return;
  S.pending++;
  let ok = false;
  let alerts = [];
  try {
    const body = new URLSearchParams();
    fields.forEach(([n, v]) => body.append(n, v));
    const html = await (await fetch(new URL(action, location.href).href, { method: 'POST', body, credentials: 'same-origin' })).text();
    alerts = gAlerts(new DOMParser().parseFromString(html, 'text/html'));
    updateHeader(html);
    ok = true;
  } catch (e) {
    fallback();
  } finally {
    S.pending--;
    if (ok && !S.pending) {
      try { await refreshWorld(); } catch (e) { /* the next move reads it again */ }
      refreshDur(0);
      if (!healNote(alerts)) alertModal(alerts);
    }
  }
}

// The game's message of a heal, written where the list says what the heal costs (the list is built again by then). False if there is
// no such line or no message.
function healNote(alerts) {
  const text = alerts.map((t) => t.textContent.replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim()).filter(Boolean).join(' ');
  const bad = alerts.some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));
  const line = [...document.querySelectorAll('#ssh-al *')].filter((e) => /Cost to fully heal/i.test(e.textContent) && ![...e.children].some((c) => /Cost to fully heal/i.test(c.textContent))).pop();
  if (!text || !line) return false;
  line.innerHTML = '<span style="color:' + (bad ? '#ff6b6b' : '#7fe08a') + '"></span>';
  line.firstChild.textContent = text;
  const row = line.closest('tr');
  if (row) row.querySelectorAll('img[title="Credits"]').forEach((i) => i.closest('td').remove()); // the credits icon belongs to the cost
  return true;
}

// A quest step: send it in the background and show the game's message in a pop-up instead of reloading the page.
async function doQuest(action, fields, fallback) {
  if (S.busy || S.pending) return;
  S.pending++;
  let ok = false;
  try {
    const body = new URLSearchParams();
    fields.forEach(([n, v]) => body.append(n, v));
    const res = await fetch(new URL(action, location.href).href, { method: 'POST', body, credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const alerts = [...doc.querySelectorAll('table')].filter((t) => /^\s*INFORMATION ALERT/i.test(t.textContent) && !t.querySelector('table'));
    if (!alerts.length) throw new Error('no message');
    closeLog();
    const pop = document.createElement('div');
    pop.id = 'ssh-pop';
    pop.innerHTML = '<div class="box" style="width:540px"><div class="ph"><div>Quest</div><span data-close="1" title="Close">&#10006;</span></div><div class="pb" style="line-height:1.35">' + alerts.map((t) => t.outerHTML).join('<div style="height:8px"></div>') + '</div></div>';
    document.body.appendChild(pop);
    updateHeader(html);
    ok = true;
  } catch (e) {
    fallback();
  } finally {
    S.pending--;
    if (ok && !S.pending) {
      let r = false;
      try { r = await refreshWorld(); } catch (e) { r = false; }
      if (!r && !S.pending) renderActions();
      refreshDur(8000);
    }
  }
}

// ---- Mechanic: show the repair bill in the action list and repair everything in the background.
function parseMech(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const btn = [...doc.querySelectorAll('input[type="button"]')].find((b) => /Repair All/i.test(b.value));
  const cf = [...doc.querySelectorAll('table.sidebars font')].find((f) => /^[\d,]+$/.test(f.textContent.trim()));
  const t = btn ? (btn.value.match(/\((\d[\d,]*)\s*credits?\)/i) || [])[1] : null;
  return { total: t ? parseInt(t.replace(/,/g, ''), 10) : null, items: doc.querySelectorAll('a[href*="repairitem"]').length, mine: cf ? parseInt(cf.textContent.replace(/,/g, ''), 10) : null, can: !!btn };
}

const HEAL_ICON = 'https://cdn.sigmastorm.com/skin/icon_action_heal.gif';

// The repair button (same icon as the healer's) sits next to the "Use Mechanic" icon; the cost goes in a line under it.
function mechRow(bd) {
  const hit = bd.querySelector('[title*="echanic"]');
  const row = hit && hit.closest('tr');
  if (!row) return null;
  let tr = bd.querySelector('.ssh-mech');
  if (!tr) {
    tr = document.createElement('tr');
    tr.className = 'ssh-mech';
    tr.innerHTML = '<td colspan="3"><div class="mech"></div></td>';
    row.parentNode.insertBefore(tr, row.nextSibling);
  }
  let btn = row.querySelector('.ssh-repair');
  if (!btn) {
    btn = document.createElement('span');
    btn.className = 'ssh-repair';
    btn.innerHTML = '<img src="' + HEAL_ICON + '" alt="">';
    const cell = row.cells[row.cells.length - 1];
    const host = cell.querySelector('nobr') || cell;
    host.insertBefore(btn, host.firstChild);
  }
  // Same size and alignment as the game's own icon next to it.
  const ref = [...row.querySelectorAll('input[type="image"], img')].filter((x) => !btn.contains(x)).pop();
  const im = btn.querySelector('img');
  if (ref && im) {
    ref.style.verticalAlign = 'middle';
    im.style.verticalAlign = 'middle';
    const fit = () => { const w = ref.offsetWidth; const h = ref.offsetHeight; if (w && h) { im.style.width = w + 'px'; im.style.height = h + 'px'; } };
    fit();
    if (!ref.complete) ref.addEventListener('load', fit, { once: true });
  }
  return { row, box: tr.querySelector('.mech'), btn };
}

function renderMech(m, html) {
  const d = parseMech(html);
  const have = d.mine === null ? '' : ' <span class="em">(you have ' + d.mine.toLocaleString('en-US') + ')</span>';
  if (!d.can || d.total === null) {
    m.box.innerHTML = 'Cost to repair all: <b>0</b>';
    m.btn.dataset.state = 'none';
    m.btn.title = 'Nothing to repair';
    return;
  }
  const ok = d.mine === null || d.mine >= d.total;
  m.box.innerHTML = 'Cost to repair all (' + d.items + ' item' + (d.items === 1 ? '' : 's') + '): <b style="color:' + (ok ? '#7fe08a' : '#ff6b6b') + '">' + d.total.toLocaleString('en-US') + '</b>' + have;
  m.btn.dataset.state = ok ? 'ok' : 'off';
  m.btn.title = ok ? 'Repair all items (' + d.total.toLocaleString('en-US') + ' credits)' : 'Not enough credits';
}

async function loadMechanic(bd) {
  const m = mechRow(bd);
  if (!m) return;
  m.btn.dataset.state = 'wait';
  m.box.innerHTML = '<span class="ssh-spin"></span> Checking repair cost...';
  try {
    const html = await (await fetch('index.php?cmd=blacksmith', { credentials: 'same-origin' })).text();
    if (m.box.isConnected) renderMech(m, html);
  } catch (e) {
    if (m.box.isConnected) { m.box.textContent = 'Could not read the repair cost.'; m.btn.dataset.state = 'none'; }
  }
}

export async function doRepair(btn) {
  if (btn.dataset.state !== 'ok') return;
  const row = btn.closest('tr');
  const box = row && row.nextElementSibling && row.nextElementSibling.querySelector('.mech');
  if (!box) return;
  btn.dataset.state = 'wait';
  box.innerHTML = '<span class="ssh-spin"></span> Repairing...';
  try {
    const html = await (await fetch('index.php?cmd=blacksmith&subcmd=repairall', { credentials: 'same-origin' })).text();
    updateHeader(html);
    refreshDur(0);
    const after = await (await fetch('index.php?cmd=blacksmith', { credentials: 'same-origin' })).text();
    if (!box.isConnected) return;
    if (parseMech(after).can) { box.innerHTML = '<span style="color:#ff6b6b">Some items could not be repaired.</span>'; btn.dataset.state = 'ok'; }
    else { box.innerHTML = '<span style="color:#7fe08a">All items repaired.</span> Cost to repair all: <b>0</b>'; btn.dataset.state = 'none'; btn.title = 'Nothing to repair'; }
  } catch (e) {
    if (box.isConnected) { box.innerHTML = '<span style="color:#ff6b6b">Repair failed.</span>'; btn.dataset.state = 'ok'; }
  }
}

// Read the world page again and show what is on the tile now (the refresh icon, and the R key). The finished fights in the list go.
export async function refreshActions() {
  if (S.busy || S.pending) return;
  const rf = document.querySelector('#ssh-al .rf');
  if (rf) rf.classList.add('spin');
  S.results = [];
  try { await refreshWorld(); } catch (e) { /* the next move reads it again */ }
  const rf2 = document.querySelector('#ssh-al .rf');
  if (rf2) rf2.classList.remove('spin');
}

export function renderActions(text) {
  const bd = ensurePanel().querySelector('.bd');
  if (text) {
    bd.innerHTML = '<div class="none">' + text + '</div>';
    return;
  }
  const ad = document.getElementById('actionDiv');
  const t = ad && ad.nextElementSibling && ad.nextElementSibling.tagName === 'TABLE' ? ad.nextElementSibling : null;
  if (t && t.querySelector('a, input[type="image"], input[type="submit"], button')) {
    bd.innerHTML = t.outerHTML.replace(/display:\s*none;?/g, '').replace(/ id="attackLink(\d+)"/g, ' data-atk="$1"');
    // Some creatures (Elite ones, for example) have an attack link without a shortcut number: still fight them in the background.
    bd.querySelectorAll('a[href*="cmd=combat"]:not([data-atk])').forEach((l) => l.setAttribute('data-atk', 'x'));
  } else {
    bd.innerHTML = '<div class="none">Nothing to do here.</div>';
  }
  placeResults(bd);
  loadMechanic(bd);
}
