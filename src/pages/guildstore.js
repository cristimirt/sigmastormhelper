import { fetchDoc, fetchText } from '../core/net.js';
import { https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts, mModal } from '../layout/modal.js';
import { updateSidebars } from '../layout/sidebars.js';

// "Store Items" of the Faction Inventory (Faction > Manage > Store) as a pop-up on the Manage Faction page, so that the page is not left. The game's
// page (cmd=guild&subcmd=inventory&subcmd2=storeitems) is read in the background: its list of the items of the bag (a checkbox, the picture, the
// amount and the name) is shown as rows, with Select all and Store Selected. The button sends the game's own form (the same fields) in the background;
// the game's message shows, and `done` is called so that the page can read its Faction Inventory panel again.

const CSS = '.gm-st{width:360px;max-width:100%;font:11px tahoma,sans-serif;color:#d8cfbf;text-align:left}' +
  '.gm-st .txt{margin:0 0 8px;line-height:1.4;color:#a9a091}' +
  '.gm-st .all{display:inline-block;margin:0 0 6px;color:#9fe0ff;cursor:pointer}' +
  '.gm-st .list{max-height:300px;overflow:auto;border:1px solid #202122;background:#0a0d0d;scrollbar-width:thin;scrollbar-color:#555 #0a0d0d}' +
  '.gm-st .it{display:flex;align-items:center;gap:8px;padding:4px 8px;border-top:1px solid #1a1d1d;cursor:pointer}.gm-st .it:first-child{border-top:0}' +
  '.gm-st .it:hover{background:#151a1a}.gm-st .it.on{background:#14202a}' +
  '.gm-st .pic{position:relative;flex:none;width:36px;height:36px;line-height:0;background:#0d0905;border:1px solid #202122}' +
  '.gm-st .pic img{width:36px;height:36px}' +
  '.gm-st .q{flex:none;width:44px;color:#a9a091;font-size:10px;text-align:center}' +
  '.gm-st .n{flex:1;min-width:0}' +
  '.gm-st .none{padding:18px;text-align:center;color:#a9a091}';

function ensureCss() {
  if (document.getElementById('ssh-gst-css')) return;
  const s = mel('style');
  s.id = 'ssh-gst-css';
  s.textContent = CSS;
  document.head.append(s);
}

const txt = (n) => (n ? n.textContent.replace(/[\s ]+/g, ' ').trim() : '');

// What the game's page offers: the intro text, the form and the items.
function read(doc) {
  const form = doc.getElementById('faction-store');
  if (!form) return null;
  const intro = [...doc.querySelectorAll('td')].find((td) => !td.querySelector('td') && /^Use this section/.test(txt(td)));
  const items = [...form.querySelectorAll('input[name="storeIndex[]"]')].map((cb) => {
    const tr = cb.closest('tr');
    const cells = [...tr.cells];
    return { id: cb.value, img: tr.querySelector('img'), qty: txt(tr.querySelector('font')), name: txt(cells[cells.length - 1]) };
  });
  return { form, intro: txt(intro), items };
}

// The game's fields of the form that are sent (the token and the one-time value are added by the fetch).
function fieldsOf(form, ids) {
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => {
    if (e.name && e.name !== 'storeIndex[]' && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button' && e.type !== 'checkbox') body.append(e.name, e.value);
  });
  ids.forEach((id) => body.append('storeIndex[]', id));
  return body;
}

export async function openStore(href, done) {
  ensureCss();
  const body = mel('div', 'gm-st');
  body.textContent = 'Loading...';
  let close = mModal('Store Items', body, [{ text: 'Cancel' }], { center: true });
  let d = null;
  try {
    d = read(await fetchDoc(href));
  } catch (e) { d = null; }
  if (!d) { body.textContent = 'The items could not be loaded.'; return; }
  body.textContent = '';
  const chosen = new Set();
  if (d.intro) body.append(mel('p', 'txt', ''));
  if (d.intro) body.lastChild.textContent = d.intro;
  if (!d.items.length) {
    body.append(mel('div', 'none', 'Nothing in your backpack can be stored.'));
    return;
  }
  const all = mel('a', 'all', 'Select all');
  const list = mel('div', 'list');
  const rows = d.items.map((it) => {
    const row = mel('label', 'it');
    const cb = mel('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) chosen.add(it.id); else chosen.delete(it.id);
      row.classList.toggle('on', cb.checked);
    });
    const pic = mel('span', 'pic');
    if (it.img) {
      const i = it.img.cloneNode(false); // the item tooltip of the game stays on the copy
      i.src = https(it.img.getAttribute('src'));
      i.draggable = false;
      pic.append(i);
    }
    const q = mel('span', 'q');
    q.textContent = it.qty;
    const n = mel('span', 'n');
    n.textContent = it.name;
    row.append(cb, pic, q, n);
    list.append(row);
    return { cb, it };
  });
  all.addEventListener('click', () => {
    const on = rows.some((r) => !r.cb.checked);
    rows.forEach((r) => { r.cb.checked = on; r.cb.dispatchEvent(new Event('change')); });
    all.textContent = on ? 'Select none' : 'Select all';
  });
  body.append(all, list);
  // the dialog is made again with the buttons that fit (Store Selected needs the choice made here)
  close();
  const send = async () => {
    if (!chosen.size) return;
    let html = '';
    try {
      html = await fetchText('index.php', { method: 'POST', body: fieldsOf(d.form, [...chosen]) });
    } catch (e) {
      const b = mel('div');
      b.textContent = 'The request failed.';
      mModal('Store Items', b, [{ text: 'OK' }], { center: true });
      return;
    }
    const doc = parseHtml(html);
    const al = gAlerts(doc);
    if (al.length) alertModal(al);
    try { updateSidebars(doc); } catch (e) { /* the next live check has it */ }
    if (done) done();
  };
  close = mModal('Store Items', body, [{ text: 'Store Selected', fn: send }, { text: 'Cancel' }], { center: true });
}
