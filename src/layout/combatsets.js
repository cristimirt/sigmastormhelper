import { updateHeader } from '../banner.js';
import { bpNote } from './backpack.js';
import { mel } from './dom.js';
import { alertModal, gAlerts, mModal } from './modal.js';
import { profBusy, refreshProfile } from './profile.js';

// ---- combat sets: the "Combat Sets" link in the inventory head opens a dialog (use / delete / save a set, no page reload).
// A small searchable select: type to filter, arrows + Enter or a click to choose.
function csCombo(onPick) {
  const w = mel('div', 'cb');
  const inp = mel('input', 'cb-in custominput');
  inp.type = 'text';
  inp.placeholder = 'Search combat sets...';
  inp.autocomplete = 'off';
  const list = mel('div', 'cb-list');
  list.hidden = true;
  w.append(inp, list);
  const c = { el: w, value: '', items: [] };
  let hl = -1;
  let shown = [];
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    shown = c.items.filter((o) => !q || o.text.toLowerCase().includes(q));
    list.textContent = '';
    if (!shown.length) list.append(mel('div', 'none', c.items.length ? 'No match' : 'No saved sets'));
    shown.forEach((o, i) => {
      const d = mel('div', i === hl ? 'hl' : '');
      d.textContent = o.text;
      d.dataset.v = o.value;
      list.append(d);
    });
  };
  const open = () => { hl = Math.max(0, shown.findIndex((o) => o.value === c.value)); draw(); list.hidden = false; };
  const close = () => { list.hidden = true; };
  const pick = (o) => {
    c.value = o ? o.value : '';
    inp.value = o ? o.text : '';
    close();
    onPick(c.value);
  };
  inp.addEventListener('focus', () => { inp.select(); shown = c.items; open(); });
  inp.addEventListener('input', () => { c.value = ''; onPick(''); hl = 0; draw(); list.hidden = false; });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) { open(); return; }
      hl = Math.min(shown.length - 1, Math.max(0, hl + (e.key === 'ArrowDown' ? 1 : -1)));
      draw();
      const h = list.querySelector('.hl');
      if (h) h.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && !list.hidden && shown[hl]) { e.preventDefault(); pick(shown[hl]); }
  });
  inp.addEventListener('blur', () => setTimeout(close, 120));
  list.addEventListener('mousedown', (e) => {
    const d = e.target.closest('[data-v]');
    if (!d) return;
    e.preventDefault();
    pick(c.items.find((o) => o.value === d.dataset.v));
  });
  c.set = (items, keepText) => {
    c.items = items;
    const keep = keepText && items.find((o) => o.text === keepText);
    c.value = keep ? keep.value : (items.some((o) => o.value === c.value) ? c.value : '');
    const cur = items.find((o) => o.value === c.value);
    inp.value = cur ? cur.text : '';
    draw();
    onPick(c.value);
  };
  return c;
}

const csSets = (doc) => {
  const sel = doc.getElementById('profileCombatSetDiv') && doc.getElementById('profileCombatSetDiv').querySelector('select');
  return sel ? [...sel.options].filter((o) => o.value !== '-1').map((o) => ({ value: o.value, text: o.text })) : null;
};

// The fields the game's own form sends: use = `Use`, delete = `X`; saving goes to its own subcmd with the name.
export function csFields(kind, id, name) {
  const f = new URLSearchParams();
  f.append('cmd', 'profile');
  if (kind === 'save') {
    f.append('subcmd', 'dosavecombatset');
    f.append('name', name);
    return f;
  }
  f.append('subcmd', 'managecombatset');
  f.append('combat_set_id', id);
  f.append('submit', kind === 'del' ? 'X' : 'Use');
  return f;
}

// Message boxes of a response page: their text, and whether any of them is an error.
const csAlerts = (doc) => {
  const a = gAlerts(doc);
  return { text: bpNote(doc), bad: a.some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || '')) };
};

export function csOpen(testSets) {
  const body = mel('div', 'cs');
  body.innerHTML = '<div class="cb-w"></div><div class="cs-row"><input type="button" class="custombutton" data-c="use" value="Use"><input type="button" class="custombutton bp-del" data-c="del" value="Delete"></div>' +
    '<div class="cs-ask" hidden><div class="q"></div><div class="cs-row"><input type="button" class="custombutton bp-del" data-c="yes" value="Yes, delete"><input type="button" class="custombutton" data-c="no" value="Cancel"></div></div>' +
    '<div class="cs-row"><input type="button" class="custombutton" data-c="save" value="Save set"></div>' +
    '<div class="cs-row cs-new" hidden><input type="text" class="custominput cs-name" maxlength="60" placeholder="Set name"><input type="button" class="custombutton" data-c="ok" value="Confirm"></div>' +
    '<div class="cs-msg" hidden></div>';
  const q = (s) => body.querySelector(s);
  const btn = (c) => q('[data-c="' + c + '"]');
  const msg = (t, bad) => { const m = q('.cs-msg'); m.textContent = t; m.className = 'cs-msg ' + (bad ? 'bad' : 'ok'); m.hidden = !t; };
  const busy = (b) => body.classList.toggle('busy', b);
  const combo = csCombo((v) => { btn('use').disabled = !v; btn('del').disabled = !v; q('.cs-ask').hidden = true; });
  q('.cb-w').append(combo.el);
  combo.set(testSets || csSets(document) || []);
  const reload = async (keepText) => {
    const sets = csSets(new DOMParser().parseFromString(await (await fetch('index.php?cmd=profile', { credentials: 'same-origin' })).text(), 'text/html'));
    if (sets) combo.set(sets, keepText);
    return sets;
  };
  const post = async (fields) => {
    const html = await (await fetch('index.php', { method: 'POST', body: fields, credentials: 'same-origin' })).text();
    return { html, doc: new DOMParser().parseFromString(html, 'text/html') };
  };
  const close = mModal('Combat sets', body, [{ text: 'Close' }]);
  if (!testSets) reload().catch(() => {}); // the list on the page may be older than the server's
  body.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-c]');
    if (!b || b.disabled) return;
    const c = b.dataset.c;
    msg('');
    if (c === 'del') {
      const o = combo.items.find((x) => x.value === combo.value);
      q('.cs-ask .q').textContent = 'Delete the combat set "' + (o ? o.text : '') + '"?';
      q('.cs-ask').hidden = false;
    } else if (c === 'no') q('.cs-ask').hidden = true;
    else if (c === 'save') { q('.cs-new').hidden = false; q('.cs-name').focus(); } else if (c === 'use' && combo.value) {
      busy(true);
      profBusy(true);
      try {
        const r = await post(csFields('use', combo.value));
        close();
        alertModal(gAlerts(r.doc));
        updateHeader(r.html);
        await refreshProfile(); // the gear changed
      } catch (x) { busy(false); msg('The request failed.', true); }
      profBusy(false);
    } else if (c === 'yes' && combo.value) {
      busy(true);
      try {
        const r = await post(csFields('del', combo.value));
        q('.cs-ask').hidden = true;
        const a = csAlerts(r.doc);
        await reload(); // the set disappears from the list; the dialog stays open
        if (a.text) msg(a.text, a.bad);
      } catch (x) { msg('The request failed.', true); }
      busy(false);
    } else if (c === 'ok') {
      const name = q('.cs-name').value.trim();
      if (!name) { msg('Enter a name for the set.', true); return; }
      busy(true);
      try {
        const r = await post(csFields('save', '', name));
        const a = csAlerts(r.doc);
        if (a.bad) msg(a.text, true);
        else {
          const sets = await reload(name);
          if (sets && !sets.some((o) => o.text === name)) msg(a.text || 'The set could not be saved.', true); // the server did not take it
          else {
            q('.cs-name').value = '';
            q('.cs-new').hidden = true;
            msg('Set saved.', false);
          }
        }
      } catch (x) { msg('The request failed.', true); }
      busy(false);
    }
  });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('cs-name')) { e.preventDefault(); btn('ok').click(); } });
}
