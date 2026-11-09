import { postHref } from '../core/net.js';
import { refreshDur, updateHeader } from '../banner.js';
import { SSH } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { unslash } from '../layout/dom.js';
import { alertModal, gAlerts, mModal } from '../layout/modal.js';
import { closeLog, placeResults, refreshWorld } from './combat.js';
import { navigate } from '../core/net.js';
import { tableToDivs } from './rows.js';

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
  // The Bank button posts cmd=bank. A GET to the same address shows the same page, with the page in the address (reloadable, linkable).
  if (form.method === 'post' && fields.length === 1 && fields[0][0] === 'cmd' && fields[0][1] === 'bank') { navigate('index.php?cmd=bank'); return; }
  if (form.method === 'post' && fields.some((f) => f[0] === 'subcmd' && f[1] === 'questaction')) { doQuest(form.action, fields, submitForm); return; }
  if (form.method === 'post' && fields.some((f) => f[0] === 'subcmd' && f[1] === 'heal')) { doHeal(form.action, fields, submitForm); return; }
  if (form.method === 'post' && fields.some((f) => f[0] === 'cmd' && f[1] === 'portal') && !fields.some((f) => f[0] === 'subcmd')) { doPortal(form.action, fields, submitForm); return; }
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

// A transit portal: the game's page of destinations (name, minimum level, cost in credits, a Travel button) in a dialog. The page is
// read in the background; if it is not what we expect, the form is sent the old way. A Travel button asks once more, then goes
// the way the game's does (the address of its button) in the background and swaps the new place in; a message of the game's
// (not enough credits...) shows in a dialog.
async function doPortal(action, fields, fallback) {
  if (S.busy || S.pending) return;
  S.pending++;
  let rows = [];
  let note = '';
  try {
    const body = new URLSearchParams();
    fields.forEach(([n, v]) => body.append(n, v));
    const html = await (await fetch(new URL(action, location.href).href, { method: 'POST', body, credentials: 'same-origin' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tb = [...doc.querySelectorAll('table')].filter((t) => /Destination/.test(t.textContent) && /Min Level/.test(t.textContent) && t.rows.length > 2).pop();
    if (tb) {
      [...tb.rows].forEach((r) => {
        const btn = r.querySelector('input[onclick]');
        const m = btn ? btn.getAttribute('onclick') : '';
        const to = (m.match(/window\.location\s*=\s*'([^']+)'/) || [])[1];
        const tds = [...r.children].filter((c) => c.tagName === 'TD');
        if (!to || tds.length < 3) return;
        rows.push({ name: tds[0].textContent.trim(), level: tds[1].textContent.trim(), cost: tds[2].textContent.replace(/\s+/g, ' ').trim(), to });
      });
      const intro = [...doc.querySelectorAll('td')].find((c) => /Transit portals permit/i.test(c.textContent) && !c.querySelector('td'));
      note = intro ? intro.textContent.replace(/\s+/g, ' ').trim() : '';
    }
  } catch (e) { rows = []; }
  S.pending--;
  if (!rows.length) { fallback(); return; }
  const wrap = document.createElement('div');
  wrap.className = 'pt-wrap';
  if (note) { const n = document.createElement('div'); n.className = 'pt-note'; n.textContent = note; wrap.append(n); }
  const list = document.createElement('div');
  list.className = 'pt-list';
  // the header stays put above the scrolling part (its own table with the same column widths, so the scrollbar starts under it)
  const cols = '<colgroup><col><col style="width:84px"><col style="width:84px"><col style="width:112px"></colgroup>';
  const head = document.createElement('div');
  head.className = 'pt-head';
  head.innerHTML = '<table class="pt">' + cols + '<thead><tr><th>Destination</th><th class="n">Min Level</th><th class="n">Cost</th><th></th></tr></thead></table>';
  const tbl = document.createElement('table');
  tbl.className = 'pt';
  tbl.innerHTML = cols + '<tbody></tbody>';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td class="n"></td><td class="n"></td><td></td>';
    tr.children[0].textContent = r.name;
    tr.children[1].textContent = r.level;
    tr.children[2].innerHTML = '<span></span><img src="https://cdn.sigmastorm.com/skin/gold_button.gif" title="Credits" alt="">';
    tr.children[2].firstChild.textContent = r.cost;
    const b = document.createElement('input');
    b.type = 'button';
    b.className = 'custombutton';
    b.value = 'Travel Here';
    let t = 0;
    b.addEventListener('click', () => {
      if (!b.classList.contains('sure')) {
        b.classList.add('sure');
        b.value = 'Sure?';
        t = setTimeout(() => { b.classList.remove('sure'); b.value = 'Travel Here'; }, 3000);
        return;
      }
      clearTimeout(t);
      document.querySelectorAll('#ssh-mm .x').forEach((x) => x.click());
      SSH.go(r.to, undefined, (html) => {
        const alerts = html ? gAlerts(new DOMParser().parseFromString(html, 'text/html')) : [];
        if (alerts.length) alertModal(alerts); else navigate('index.php?cmd=world');
      });
    });
    tr.children[3].append(b);
    tbl.tBodies[0].append(tr);
  });
  list.append(tbl);
  wrap.append(head, list);
  mModal('Transit Portal', wrap, [{ text: 'Close' }]);
}

// Healing at a healer: the same request as the game's button, in the background; the game's message in the list in place of the
// cost line, the banner (HP, credits) updated from the answer, the list read again. If the request itself fails, nothing was done, so
// the form is sent the old way.
async function doHeal(action, fields, fallback) {
  if (S.busy || S.pending) return;
  S.pending++;
  const wait = healLine();
  if (wait) wait.dataset.heal = '1';
  if (wait && wait.closest('.r')) wait.closest('.r').querySelectorAll('img[title="Credits"]').forEach((i) => i.closest('.c').remove());
  if (wait) wait.innerHTML = '<span class="ssh-spin"></span> Healing...'; // like the repair
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

// The line of the healer's row that says what the heal costs (the one the heal writes its progress and its message in).
function healLine() {
  const rows = [...document.querySelectorAll('#ssh-al *')];
  return rows.filter((e) => e.dataset && e.dataset.heal).pop() || rows.filter((e) => /Cost to fully heal/i.test(e.textContent) && ![...e.children].some((c) => /Cost to fully heal/i.test(c.textContent))).pop() || null;
}

// The game's message of a heal, written where the list says what the heal costs (the list is built again by then). False if there is
// no such line or no message.
function healNote(alerts) {
  const text = alerts.map((t) => t.textContent.replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim()).filter(Boolean).join(' ');
  const bad = alerts.some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));
  const line = healLine();
  if (!text || !line) return false;
  line.dataset.heal = '1'; // the next heal writes its progress here too
  line.innerHTML = '<span style="color:' + (bad ? '#ff6b6b' : '#7fe08a') + '"></span>';
  line.firstChild.textContent = text;
  const row = line.closest('.r');
  if (row) row.querySelectorAll('img[title="Credits"]').forEach((i) => i.closest('.c').remove()); // the credits icon belongs to the cost
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
    alertModal(alerts, 'Quest'); // the same plain dialog as the other messages (no box inside the box)
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
  // "Repair All (1,234 credits)" is a submit button of a small POST form now (id mechanic-all); the repair of one item is a form too
  const btn = [...doc.querySelectorAll('input[type="button"], input[type="submit"]')].find((b) => /Repair All/i.test(b.value));
  const form = doc.getElementById('mechanic-all') || (btn && btn.form);
  const cf = [...doc.querySelectorAll('table.sidebars font')].find((f) => /^[\d,]+$/.test(f.textContent.trim()));
  const t = btn ? (btn.value.match(/\((\d[\d,]*)\s*credits?\)/i) || [])[1] : null;
  return { total: t ? parseInt(t.replace(/,/g, ''), 10) : null, items: doc.querySelectorAll('a[href*="repairitem"], form[id^="mechanic-repair-"]').length, href: form ? postHref(form) : 'index.php?cmd=blacksmith&subcmd=repairall', mine: cf ? parseInt(cf.textContent.replace(/,/g, ''), 10) : null, can: !!btn };
}

const HEAL_ICON = 'https://cdn.sigmastorm.com/skin/icon_action_heal.gif';

// The repair button (same icon as the healer's) sits next to the "Use Mechanic" icon; the cost goes in a line under it.
function mechRow(bd) {
  const hit = bd.querySelector('[title*="echanic"]');
  const row = hit && hit.closest('.r');
  if (!row) return null;
  let tr = bd.querySelector('.ssh-mech');
  if (!tr) {
    tr = document.createElement('div');
    tr.className = 'r ssh-mech';
    tr.innerHTML = '<div class="c full"><div class="w"><div class="mech"></div></div></div>';
    row.parentNode.insertBefore(tr, row.nextSibling);
  }
  let btn = row.querySelector('.ssh-repair');
  if (!btn) {
    btn = document.createElement('span');
    btn.className = 'ssh-repair';
    btn.innerHTML = '<img src="' + HEAL_ICON + '" alt="">';
    const cell = row.lastElementChild;
    const host = cell.querySelector('nobr') || cell.querySelector('.w') || cell;
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
  m.btn.dataset.href = d.href;
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
  const row = btn.closest('.r');
  const box = row && row.nextElementSibling && row.nextElementSibling.querySelector('.mech');
  if (!box) return;
  btn.dataset.state = 'wait';
  box.innerHTML = '<span class="ssh-spin"></span> Repairing...';
  try {
    const html = await (await fetch(btn.dataset.href || 'index.php?cmd=blacksmith&subcmd=repairall', { credentials: 'same-origin' })).text();
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
    // the attack buttons are small POST forms now (id attackForm1, attackForm2, ...): each becomes the link it used to be, to an address that
    // stands for the form (fetch sends it as the POST)
    bd.querySelectorAll('form').forEach((f) => {
      if (!f.querySelector('input[name="creature_id"]')) return;
      const n = (f.id.match(/^attackForm(\d+)$/) || [])[1];
      const a = document.createElement('a');
      a.setAttribute('href', postHref(f));
      a.setAttribute('data-atk', n || 'x');
      a.innerHTML = (f.querySelector('button, input[type="image"]') || f).innerHTML || '';
      const img = f.querySelector('img');
      if (img && !a.querySelector('img')) a.append(img.cloneNode(true));
      f.replaceWith(a);
    });
    // Some creatures (Elite ones, for example) have an attack link without a shortcut number: still fight them in the background.
    bd.querySelectorAll('a[href*="cmd=combat"]:not([data-atk])').forEach((l) => l.setAttribute('data-atk', 'x'));
  } else {
    bd.innerHTML = '<div class="none">Nothing to do here.</div>';
  }
  unslash(bd);
  tableToDivs(bd);
  placeResults(bd);
  loadMechanic(bd);
}
