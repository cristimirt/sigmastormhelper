import { mel } from '../layout/dom.js';
import { alertModal, gAlerts, mModal } from '../layout/modal.js';

// The blueprint list (Inventing): switching folder, creating a folder and moving blueprints are sent in the background and
// only the page's content is replaced, so the page never reloads. A new folder or a move refreshes the folder you are in
// (it does not switch to the other one).

const cell = (doc) => {
  const m = doc.getElementById('mainContentDiv');
  return m && m.rows.length > 1 && m.rows[1].cells.length > 1 ? m.rows[1].cells[1] : null;
};

// The folder and page the content shows (the highlighted folder picture and the page list).
function readState(doc) {
  const on = [...doc.querySelectorAll('img')].find((i) => /folder_on\.gif/.test(i.getAttribute('src') || ''));
  const a = on && on.closest('a');
  const m = a && (a.getAttribute('href') || '').match(/folder_id=(-?\d+)/);
  const sel = doc.querySelector('select[name="page"]');
  return { folder: m ? m[1] : '-1', page: sel ? sel.value : '0' };
}

const parse = async (res) => new DOMParser().parseFromString(await res.text(), 'text/html');

// The game's message boxes of a response page as one line of text.
const alertText = (doc) => gAlerts(doc).map((t) => t.textContent.replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim()).filter(Boolean).join(' ');
const alertBad = (doc) => gAlerts(doc).some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));

export function initInventing() {
  if (initInventing.on || !cell(document)) return;
  initInventing.on = true;
  let st = readState(document);
  let seq = 0;

  const post = async (fields) => parse(await fetch('index.php', { method: 'POST', body: new URLSearchParams(fields), credentials: 'same-origin' }));

  const showNote = (text, bad) => {
    const c = cell(document);
    if (!c || !text) return;
    c.querySelectorAll('.ssh-inv-note').forEach((n) => n.remove());
    const n = mel('div', 'ssh-inv-note');
    n.textContent = text;
    n.style.cssText = 'margin:6px auto;padding:4px 8px;max-width:560px;text-align:center;font-size:11px;border:1px solid ' + (bad ? '#8a2a22' : '#2d6a39') + ';color:' + (bad ? '#ff8a80' : '#7fe08a') + ';background:rgba(0,0,0,.4)';
    c.insertBefore(n, c.firstChild);
    setTimeout(() => n.remove(), 6000);
  };

  // dims the content while a request is under way
  const busy = (on) => {
    const c = cell(document);
    if (!c) return;
    c.style.opacity = on ? '.45' : '';
    c.style.pointerEvents = on ? 'none' : '';
  };

  // Loads a folder page (a GET address, or the fields the game's own page list sends) and swaps the content in.
  async function load(req, note, bad) {
    const my = ++seq;
    const c = cell(document);
    busy(true);
    try {
      const doc = typeof req === 'string' ? await parse(await fetch(req, { credentials: 'same-origin' })) : await post(req);
      const nc = cell(doc);
      if (!nc || !nc.querySelector('img[src*="folder"]')) throw new Error('not the blueprint list');
      if (my !== seq) return;
      c.innerHTML = nc.innerHTML;
      st = readState(document);
      try { history.replaceState(null, '', 'index.php?cmd=inventing&folder_id=' + st.folder); } catch (e) { /* ignore */ }
      showNote(note, bad);
    } catch (e) {
      if (my === seq) location.href = typeof req === 'string' ? req : 'index.php?cmd=inventing&folder_id=' + (req.folder_id || st.folder); // let the browser do it
    } finally {
      if (my === seq) busy(false);
    }
  }
  const refresh = (note, bad) => load({ cmd: 'inventing', folder_id: st.folder, page: st.page }, note, bad);

  async function createFolder(name) {
    busy(true);
    try {
      const doc = await post({ cmd: 'inventing', subcmd: 'docreatefolder', folder_name: name });
      await refresh(alertText(doc) || 'Folder created.', alertBad(doc));
    } catch (e) { busy(false); showNote('The folder could not be created.', true); }
  }

  // Deleting a folder (the game's own link, which asks with a browser confirmation): a dialog asks, the request is sent in the
  // background, the folder list is refreshed and the game's message box is shown. If the folder you were in is the one that
  // went, the unassigned folder opens (what the game does).
  function askDelete(name, url, id) {
    const body = mel('div');
    body.textContent = 'Are you sure you wish to delete the folder "' + name + '"?';
    mModal('Delete folder', body, [{
      text: 'Delete',
      cls: 'bp-del',
      fn: async () => {
        busy(true);
        let alerts;
        try { alerts = gAlerts(await parse(await fetch(url, { credentials: 'same-origin' }))); } catch (e) { busy(false); showNote('The folder could not be deleted.', true); return; }
        await load(st.folder === id ? 'index.php?cmd=inventing&folder_id=-1' : { cmd: 'inventing', folder_id: st.folder, page: st.page });
        if (alerts.length) alertModal(alerts); else showNote('Folder deleted.');
      },
    }, { text: 'Cancel' }]);
    const pf = document.querySelector('#ssh-mm .pf');
    if (pf && pf.lastChild) pf.lastChild.focus(); // Enter must not delete by accident
  }

  // The fields the game's move form sends, read from the controls themselves: the game's markup puts the controls outside the
  // <form> element, and after the content is replaced they no longer belong to it at all.
  async function moveBlueprints() {
    const c = cell(document);
    const checked = [...c.querySelectorAll('input[name="recipe_selected[]"]:checked')];
    if (!checked.length) { showNote('Tick the blueprints to move first.', true); return; }
    const sel = c.querySelector('select[name="target_folder_id"]');
    const fields = new URLSearchParams({ cmd: 'inventing', subcmd: 'domoverecipes' });
    checked.forEach((i) => fields.append('recipe_selected[]', i.value));
    fields.append('target_folder_id', sel ? sel.value : '-1');
    busy(true);
    try {
      const doc = await post(fields);
      await refresh(alertText(doc) || 'Blueprints moved.', alertBad(doc));
    } catch (e) { busy(false); showNote('The blueprints could not be moved.', true); }
  }

  function askFolder(max) {
    const body = mel('div', '', '<div style="margin-bottom:6px">Folder name:</div>');
    const inp = mel('input', 'custominput');
    inp.type = 'text';
    if (max > 0) inp.maxLength = max;
    inp.style.width = '240px';
    body.append(inp);
    mModal('New folder', body, [{ text: 'Create', fn: () => { const n = inp.value.trim(); if (n) createFolder(n); } }, { text: 'Cancel' }]);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = document.querySelector('#ssh-mm .pf input'); if (b) b.click(); } });
    inp.focus();
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const c = cell(document);
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || !t || typeof t.closest !== 'function' || !c || !c.contains(t)) return;
    const a = t.closest('a[href]');
    const href = a ? a.getAttribute('href') : '';
    if (a && /[?&]cmd=inventing/.test(href) && /[?&]folder_id=-?\d+/.test(href) && !/[?&]subcmd=/.test(href)) {
      e.preventDefault();
      load(href);
      return;
    }
    if (a && /[?&]cmd=inventing/.test(href) && /[?&]subcmd=dodeletefolder/.test(href)) {
      e.preventDefault();
      e.stopPropagation(); // not the game's own confirmation
      const name = (a.closest('td') || a).textContent.replace(/\[\s*x\s*\]/i, '').replace(/\s+/g, ' ').trim();
      askDelete(name, href, (href.match(/folder_id=(-?\d+)/) || [])[1]);
      return;
    }
    const b = t.closest('input[type="button"], input[type="submit"]');
    if (!b) return;
    if (b.type === 'button' && /^Add New Folder$/i.test(b.value)) {
      e.preventDefault();
      e.stopPropagation(); // not the game's own handler, which opens its form
      const nm = c.querySelector('input[name="folder_name"]');
      askFolder(nm ? nm.maxLength : 0);
    } else if (b.type === 'submit' && /^Move Blueprints$/i.test(b.value)) {
      e.preventDefault();
      moveBlueprints();
    } else if (b.type === 'submit' && /^Go$/i.test(b.value) && b.parentNode.querySelector('select[name="page"]')) {
      e.preventDefault(); // the page list
      load({ cmd: 'inventing', folder_id: st.folder, page: b.parentNode.querySelector('select[name="page"]').value });
    }
  }, true);
}
