import { updateHeader } from '../banner.js';
import { SSH } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { csFields, csOpen } from './combatsets.js';
import { mel, mq } from './dom.js';
import { alertModal, gAlerts, mModal } from './modal.js';
import { profBusy, refreshProfile } from './profile.js';
import { pfComp, pfSections } from './sections.js';

// ---- backpack: a small app of its own. The folders, items and pages are read from the page's markup (or from a freshly
// fetched copy of the page), drawn by bpRender, and everything the player does (open a folder or page, refresh, move,
// combine, split, destroy) is sent with fetch, so the page never reloads.
S.bp = Object.assign({ size: 100 }, store.get('bp', {}));

export const BP = { box: null, data: null, url: '', sel: new Set(), req: 0, msgT: 0 };

const BP_SIZES = [50, 75, 100];

const SVG = (inner) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';

const BP_ICON = {
  gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  refresh: SVG('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
};

// The backpack section of a page (the live one or a fetched copy) as plain data.
export function bpParse(rows) {
  const d = { folders: [], items: [], slots: [], pages: [], opts: [], help: [], cur: '-1' };
  mq(rows, 'img').filter((i) => /\/folder(_on)?\.gif/.test(i.getAttribute('src') || '')).forEach((i) => {
    const a = i.closest('a');
    const m = a && (a.getAttribute('href') || '').match(/folder_id=(-?\d+)/);
    d.folders.push({ id: m ? m[1] : '', name: i.closest('td').textContent.trim(), on: /folder_on/.test(i.getAttribute('src')), src: i.getAttribute('src') });
  });
  const on = d.folders.find((f) => f.on);
  if (on) d.cur = on.id;
  // the slots table: its cells are 45 wide (a folder with nothing in it has no checkboxes, only empty cells)
  const itab = mq(rows, 'table').find((t) => (t.querySelector('input[type="checkbox"]') || t.querySelector('td[width="45"]')) && !t.querySelector('table'));
  let prev = null;
  for (const tr of itab ? itab.rows : []) {
    if (tr.querySelector('input[type="checkbox"]')) {
      [...tr.cells].forEach((td, i) => { const ck = td.querySelector('input'); if (ck && prev && prev[i]) prev[i].inv = ck.value; });
      prev = null;
    } else {
      prev = [...tr.cells].map((td) => {
        const im = td.querySelector('img');
        if (!im) { if (td.getAttribute('width') === '45') d.slots.push(null); return null; } // an empty slot: kept, so the free space shows (spacer cells are not slots)
        const a = td.querySelector('a');
        const it = { inv: '', src: im.getAttribute('src'), tip: im.getAttribute('onmouseover') || '', href: a ? a.getAttribute('href') : '', count: ((td.querySelector('font') || {}).textContent || '').replace(/ /g, ' ').trim() };
        const m = ((it.href || '') + ' ' + it.tip).match(/inventory_id=(\d+)|ajaxLoadItem\(\s*\d+\s*,\s*(\d+)/);
        if (m) it.inv = m[1] || m[2];
        d.items.push(it);
        d.slots.push(it);
        return it;
      });
    }
  }
  const pg = mq(rows, 'b').find((b) => /^Page$/i.test(b.textContent.trim()));
  if (pg && pg.closest('center')) pg.closest('center').querySelectorAll('a').forEach((a) => d.pages.push({ n: a.textContent.trim(), href: a.getAttribute('href') }));
  const sel = mq(rows, 'select').find((s) => s.name === 'folder_id');
  if (sel) d.opts = [...sel.options].map((o) => ({ value: o.value, text: o.text }));
  else d.opts = d.folders.map((f) => ({ value: f.id, text: f.name }));
  d.help = mq(rows, 'a').filter((a) => a.textContent.trim() === '?').map((a) => a.outerHTML);
  return d;
}

// A section of a page's profile (found by its head picture), from the live page or a fetched copy.
function secFromDoc(doc, name) {
  const t = doc.querySelector('table[background*="large_content_bg"]');
  if (!t) return null;
  for (const col of [...t.querySelectorAll('table')].filter((x) => /profile_sub_bg/.test(x.getAttribute('background') || ''))) {
    const s = pfSections(col).find((x) => x.name === name);
    if (s) return s;
  }
  return null;
}

function bpFromDoc(doc) {
  const s = secFromDoc(doc, 'backpack');
  return s ? bpParse(s.rows) : null;
}

// Dim the bag and the components under it while either is being (re)loaded.
function bpBusy(on) {
  if (BP.box) BP.box.classList.toggle('busy', on);
  const c = document.querySelector(':is(#ssh-prof,#ssh-mm) .s-components .bd');
  if (c) c.classList.toggle('busy', on);
}

function bpMsg(text, bad) {
  const m = BP.box && BP.box.querySelector('.bp-msg');
  if (!m) return;
  m.textContent = text;
  m.className = 'bp-msg' + (bad ? ' bad' : '');
  m.hidden = false;
  clearTimeout(BP.msgT);
  BP.msgT = setTimeout(() => { m.hidden = true; }, 6000);
}

// Show or hide the buttons that work on the selected items, and mark the selected ones.
function bpSync() {
  const bar = BP.box && BP.box.querySelector('.bp-act');
  if (!bar) return;
  bar.hidden = !BP.sel.size;
  bar.querySelector('.cnt').textContent = BP.sel.size + ' selected';
  BP.box.querySelectorAll('.bp-c:not(.empty)').forEach((c) => c.classList.toggle('sel', BP.sel.has(c.querySelector('.bp-ck').dataset.inv)));
}

// Item size: the items are scaled with CSS zoom; below 100% the count is drawn over the picture so it stays readable.
function bpApplySize() {
  if (!BP.box) return;
  BP.box.style.setProperty('--z', String(S.bp.size / 100));
  BP.box.classList.toggle('sm', S.bp.size < 100);
  BP.box.classList.toggle('xs', S.bp.size <= 50);
}

function bpRender() {
  const box = BP.box;
  const d = BP.data;
  bpApplySize();
  const have = new Set(d.items.map((i) => i.inv));
  [...BP.sel].forEach((v) => { if (!have.has(v)) BP.sel.delete(v); });
  box.textContent = '';
  const msg = mel('div', 'bp-msg');
  msg.hidden = true;
  box.append(msg);
  const fold = mel('div', 'bp-f');
  d.folders.forEach((f) => {
    const a = mel('a', f.on ? 'on' : '');
    a.href = 'index.php?cmd=profile&folder_id=' + f.id;
    a.dataset.folder = f.id;
    const im = document.createElement('img');
    im.src = f.src;
    im.alt = '';
    const nm = mel('span');
    nm.textContent = f.name;
    a.append(im, nm);
    fold.append(a);
  });
  if (fold.firstChild) box.append(fold);
  const grid = mel('div', 'bp-g');
  d.slots.forEach((it) => {
    const w = mel('div', 'bp-w');
    if (!it) { w.append(mel('div', 'bp-c empty')); grid.append(w); return; }
    const c = mel('div', 'bp-c');
    const im = document.createElement('img');
    im.src = it.src;
    im.setAttribute('border', '0');
    if (it.tip) im.setAttribute('onmouseover', it.tip); // the game's own item tooltip
    let el = im;
    if (it.href) { el = document.createElement('a'); el.href = it.href; el.append(im); }
    const cnt = mel('div', 'cnt');
    const cm = it.count.match(/^(\S+)\s*(\/\s*\S+)$/);
    if (cm) { cnt.append(mel('span', 'a', cm[1]), mel('span', 'b', ' ' + cm[2])); } else cnt.textContent = it.count;
    const ck = document.createElement('input');
    ck.type = 'checkbox';
    ck.className = 'bp-ck';
    ck.dataset.inv = it.inv;
    ck.checked = BP.sel.has(it.inv);
    c.append(el, cnt, ck);
    w.append(c);
    grid.append(w);
  });
  if (!d.slots.length) grid.append(mel('div', 'bp-none', 'Nothing in this folder.'));
  box.append(grid);
  if (d.pages.length) {
    const p = mel('div', 'pg');
    p.append('Page: ');
    d.pages.forEach((pg) => {
      const a = document.createElement('a');
      a.href = pg.href;
      a.dataset.href = pg.href;
      a.textContent = pg.n;
      p.append(a, ' ');
    });
    box.append(p);
  }
  const bar = mel('div', 'bp-act');
  bar.hidden = true;
  bar.innerHTML = '<div class="r"><b class="cnt"></b><a href="#" data-a="clear">clear</a></div>' +
    '<div class="r">Move selected to: <select class="bp-to"></select><input type="button" class="custombutton" data-a="go" value="Go"></div>' +
    '<div class="r"><input type="button" class="custombutton" data-a="combine" value="Combine Selected"><span class="h1"></span></div>' +
    '<div class="r"><input type="text" class="custominput bp-qty" size="3"><input type="button" class="custombutton" data-a="split" value="Split Selected"><span class="h2"></span></div>' +
    '<div class="r"><input type="button" class="custombutton bp-del" data-a="destroy" value="Destroy Selected"></div>';
  const to = bar.querySelector('.bp-to');
  d.opts.forEach((o) => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; to.append(op); });
  const other = d.opts.find((o) => o.value !== d.cur);
  if (other) to.value = other.value;
  if (d.help[0]) bar.querySelector('.h1').innerHTML = '[' + d.help[0] + ']';
  if (d.help[1]) bar.querySelector('.h2').innerHTML = '[' + d.help[1] + ']';
  box.append(bar);
  bpSync();
}

// Load a page of the backpack (a folder, another page, or the same one again) without leaving the page.
async function bpLoad(url, note, bad) {
  const my = ++BP.req;
  const rb = document.querySelector('#ssh-prof [data-hb="refresh"]');
  bpBusy(true);
  if (rb) rb.classList.add('spin');
  let ok = false;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const d = bpFromDoc(doc);
    if (!d) throw new Error('no backpack');
    if (my !== BP.req) return false;
    BP.data = d;
    BP.url = url;
    store.set('bpFolder', d.cur); // the bag opens on this folder the next time the page loads
    if (window.ajaxLoadItem && window.ajaxLoadItem.clear) window.ajaxLoadItem.clear(); // item data may have changed
    bpRender();
    const cs = secFromDoc(doc, 'components'); // the components under the bag are refreshed together with it
    if (cs) compUpdate(cs.rows);
    if (note) bpMsg(note, bad);
    ok = true;
    if (BP.onChange) BP.onChange(); // whoever shows the bag outside the profile (the world page) can update its count
  } catch (e) {
    console.error('[SSH] backpack load failed', e);
    if (my === BP.req) bpMsg('Could not load the backpack.', true);
  } finally {
    if (my === BP.req) { bpBusy(false); if (rb) rb.classList.remove('spin'); }
  }
  return ok;
}

export function bpNote(doc) {
  return gAlerts(doc).map((t) => t.textContent.replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim()).join(' ').slice(0, 240);
}

const bpBad = (doc) => gAlerts(doc).some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));

// Use an item without leaving the page: consumables and resources reload the bag (and the components); gear
// reloads the whole profile content, since the stats change too. The game's message, if any, is shown in the line above the bag.
export async function bpUse(a) {
  const href = a.getAttribute('href') || '';
  const gear = /subcmd=(un)?equipitem/.test(href); // equipping or unequipping: the stats change too
  bpBusy(true);
  if (gear) profBusy(true); // the whole content is about to be replaced
  let html = '';
  try {
    html = await (await fetch(href, { credentials: 'same-origin' })).text();
  } catch (e) {
    bpBusy(false);
    profBusy(false);
    bpMsg('The request failed.', true);
    return;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const note = bpNote(doc);
  const bad = bpBad(doc);
  updateHeader(html);
  if (gear) {
    let ok = false;
    try { ok = await refreshProfile(); } catch (e) { ok = false; }
    if (!ok) await bpLoad(BP.url, note, bad);
    else if (note) bpMsg(note, bad);
    profBusy(false);
  } else await bpLoad(BP.url, note, bad);
}

// Components: the picture under the bag. A click destroys one (as in the game); paging works in place.
function compUpdate(rows) {
  const sec = document.querySelector(':is(#ssh-prof,#ssh-mm) .s-components');
  const old = sec && sec.querySelector('.bd');
  const nb = old && pfComp(rows);
  if (!nb) return;
  nb.classList.add('bd');
  old.replaceWith(nb);
}

export async function compLoad(href) {
  try {
    const doc = new DOMParser().parseFromString(await (await fetch(href, { credentials: 'same-origin' })).text(), 'text/html');
    const cs = secFromDoc(doc, 'components');
    if (cs) compUpdate(cs.rows);
  } catch (e) { bpMsg('Could not load the components.', true); }
}

export async function compDestroy(href) {
  if (!BP.box) return;
  bpBusy(true);
  let doc = null;
  try {
    doc = new DOMParser().parseFromString(await (await fetch(href, { credentials: 'same-origin' })).text(), 'text/html');
  } catch (e) {
    bpBusy(false);
    bpMsg('The request failed.', true);
    return;
  }
  await bpLoad(BP.url, bpNote(doc), bpBad(doc));
}

// Send a form post; resolves to the game's message ('' if none) or null when the request failed.
async function bpPost(fields) {
  bpBusy(true);
  try {
    const res = await fetch('index.php', { method: 'POST', body: fields, credentials: 'same-origin' });
    return bpNote(new DOMParser().parseFromString(await res.text(), 'text/html'));
  } catch (e) {
    bpBusy(false);
    bpMsg('The request failed.', true);
    return null;
  }
}

// The same fields the game's own backpack form sends (move / combine / split), or the drop form (destroy).
function bpFields(kind, ids, to, qty) {
  const f = new URLSearchParams();
  f.append('cmd', 'profile');
  if (kind === 'destroy') {
    f.append('subcmd', 'dodropitems');
    ids.forEach((i) => f.append('removeIndex[]', i));
    return f;
  }
  f.append('subcmd', 'backpackaction');
  ids.forEach((i) => f.append('folderItem[]', i));
  f.append('folder_id', to);
  f.append('split_amount', qty);
  f.append('submit', { go: 'Go', combine: 'Combine Selected', split: 'Split Selected' }[kind]);
  return f;
}

async function bpAct(kind) {
  const ids = [...BP.sel];
  if (!ids.length) return;
  const to = BP.box.querySelector('.bp-to').value;
  const qty = BP.box.querySelector('.bp-qty').value.trim();
  if (kind === 'go' && to === BP.data.cur) { bpMsg('Pick another folder to move the items to.', true); return; }
  if (kind === 'split' && !/^\d+$/.test(qty)) { bpMsg('Enter how many to split off.', true); BP.box.querySelector('.bp-qty').focus(); return; }
  const note = await bpPost(bpFields(kind, ids, to, qty));
  if (note !== null) await bpLoad(BP.url, note || 'Done.');
}

async function bpDestroy(ids) {
  const note = await bpPost(bpFields('destroy', ids));
  if (note === null) return;
  if (!(await bpLoad(BP.url))) return;
  const left = ids.filter((i) => BP.data.items.some((x) => x.inv === i)).length;
  bpMsg(left ? left + ' item' + (left === 1 ? '' : 's') + ' could not be destroyed.' + (note ? ' ' + note : '') : 'Destroyed ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + '.', !!left);
}

function bpDestroyAsk() {
  const ids = [...BP.sel];
  if (!ids.length) return;
  const body = mel('div');
  body.append(mel('div', '', 'Destroy ' + ids.length + ' selected item' + (ids.length === 1 ? '' : 's') + '? This cannot be undone.'));
  const row = mel('div', 'mm-th');
  BP.data.items.filter((i) => BP.sel.has(i.inv)).forEach((i) => { const im = document.createElement('img'); im.src = i.src; row.append(im); });
  body.append(row);
  mModal('Destroy items', body, [{ text: 'Cancel' }, { text: 'Destroy', cls: 'bp-del', fn: () => bpDestroy(ids) }]);
}

function bpSettings() {
  const body = mel('div');
  body.innerHTML = '<div class="mm-h">Item size</div>' + BP_SIZES.map((v) => '<label class="mm-o"><input type="radio" name="bpsize" value="' + v + '"' + (S.bp.size === v ? ' checked' : '') + '> ' + v + '%' + (v === 100 ? ' (original size)' : '') + '</label>').join('');
  body.addEventListener('change', (e) => {
    const v = +e.target.value;
    if (!BP_SIZES.includes(v)) return;
    S.bp.size = v;
    store.set('bp', S.bp);
    bpApplySize();
  });
  mModal('Backpack settings', body, [{ text: 'Close' }]);
}

export function bpHeadBtns() {
  const d = mel('div', 'hb');
  d.innerHTML = '<button type="button" data-hb="settings" title="Backpack settings">' + BP_ICON.gear + '</button><button type="button" data-hb="refresh" title="Refresh the backpack">' + BP_ICON.refresh + '</button>';
  d.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !BP.box) return;
    if (b.dataset.hb === 'settings') bpSettings(); else bpLoad(BP.url);
  });
  return d;
}

// The backpack in a dialog (the world page's backpack button): the profile page is read, and the same app as on the profile is built
// from its backpack section: folders, pages, selecting, move / combine / split / destroy, use and equip. It opens on the folder last used.
export async function bpPopup(host, onChange) {
  let box = null;
  let doc = null;
  try {
    doc = new DOMParser().parseFromString(await (await fetch('index.php?cmd=profile', { credentials: 'same-origin' })).text(), 'text/html');
    const s = secFromDoc(doc, 'backpack');
    BP.restored = false;
    box = s ? pfBack(s.rows) : null;
  } catch (e) { box = null; }
  host.textContent = '';
  if (!box) { host.textContent = 'Could not load the backpack.'; return false; }
  const top = mel('div', 'bp-top');
  top.append(bpHeadBtns());
  host.append(top, box);
  // the components under the bag, as on the profile page (a click destroys one, the page links page through them)
  const cs = secFromDoc(doc, 'components');
  const comp = cs && pfComp(cs.rows);
  if (comp) {
    comp.classList.add('bd');
    const sec = mel('div', 'sec s-components');
    sec.append(mel('div', 'qb-sh', 'Components'), comp);
    host.append(sec);
  }
  host.addEventListener('click', (e) => {
    const ca = e.target && typeof e.target.closest === 'function' ? e.target.closest('.comp a[href]') : null;
    if (!ca || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const h = ca.getAttribute('href') || '';
    if (/subcmd=destroycomponent/.test(h)) { e.preventDefault(); compDestroy(h); } else if (/component_page=/.test(h)) { e.preventDefault(); compLoad(h); }
  });
  BP.onChange = onChange || null;
  return true;
}

export function pfBack(rows) {
  const d = bpParse(rows);
  if (!d.items.length && !d.folders.length) return null;
  const box = mel('div', 'bp');
  BP.box = box;
  BP.data = d;
  BP.sel = new Set();
  BP.last = '';
  const pm = location.search.match(/backpack_page=(\d+)/);
  BP.url = 'index.php?cmd=profile&folder_id=' + d.cur + (pm ? '&backpack_page=' + pm[1] : '');
  box.addEventListener('change', (e) => {
    const ck = e.target.closest && e.target.closest('.bp-ck');
    if (!ck) return;
    if (ck.checked) { BP.sel.add(ck.dataset.inv); BP.last = ck.dataset.inv; } else BP.sel.delete(ck.dataset.inv);
    bpSync();
  });
  // no text selection or link drag while Shift / Ctrl select
  box.addEventListener('mousedown', (e) => { if ((e.shiftKey || e.ctrlKey || e.metaKey) && e.target.closest && e.target.closest('.bp-c')) e.preventDefault(); });
  box.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    // Ctrl+Click selects the item instead of using it; Shift+Click selects everything from the last selected item to this one
    const cell = t.closest('.bp-c:not(.empty)');
    if (cell && !t.closest('.bp-ck') && !e.button && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.preventDefault();
      const cks = [...box.querySelectorAll('.bp-c:not(.empty) .bp-ck')];
      const me = cell.querySelector('.bp-ck');
      const from = e.shiftKey ? cks.findIndex((c) => c.dataset.inv === BP.last) : -1;
      if (from >= 0) {
        const to = cks.indexOf(me);
        cks.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((c) => { c.checked = true; BP.sel.add(c.dataset.inv); });
      } else {
        me.checked = !me.checked;
        if (me.checked) BP.sel.add(me.dataset.inv); else BP.sel.delete(me.dataset.inv);
      }
      if (me.checked) BP.last = me.dataset.inv;
      bpSync();
      return;
    }
    const ua = t.closest('.bp-c a[href]');
    if (ua && /subcmd=(use|equip)item/.test(ua.getAttribute('href') || '')) {
      if (!e.button && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); bpUse(ua); }
      return;
    }
    const fa = t.closest('a[data-folder]');
    if (fa) { e.preventDefault(); bpLoad('index.php?cmd=profile&folder_id=' + fa.dataset.folder); return; }
    const pa = t.closest('a[data-href]');
    if (pa) { e.preventDefault(); bpLoad(pa.dataset.href); return; }
    const ac = t.closest('[data-a]');
    if (!ac) return;
    e.preventDefault();
    const a = ac.dataset.a;
    if (a === 'clear') { BP.sel.clear(); BP.last = ''; box.querySelectorAll('.bp-ck').forEach((c) => { c.checked = false; }); bpSync(); } else if (a === 'destroy') bpDestroyAsk(); else bpAct(a);
  });
  bpRender();
  // The page always loads with the Main folder; open the one that was open last instead (once per page load).
  if (!BP.restored) {
    BP.restored = true;
    const last = String(store.get('bpFolder', d.cur));
    if (last !== d.cur && !/[?&]folder_id=/.test(location.search) && d.folders.some((f) => f.id === last)) setTimeout(() => bpLoad('index.php?cmd=profile&folder_id=' + last), 0);
  }
  return box;
}

SSH.bp = { BP, bpFields, bpUse, gAlerts, alertModal, refreshProfile, csOpen, csFields };
