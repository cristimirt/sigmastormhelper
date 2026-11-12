import { S } from '../core/state.js';
import { cssUrl, https } from '../core/util.js';
import { mel } from '../layout/dom.js';

// The blueprint list (Inventing) for the Modern layout, made of divs: .iv-head (picture), .iv-intro, .iv-folders (.iv-f: the folder picture, its
// name and a small delete button), the "Add New Folder" button, the page list, .iv-list (.iv-r: tick, picture, name, type, item level), the move
// controls and .iv-foot. The game's table stays in the content, hidden in the Modern layout (so the Original layout is untouched), and
// is where the data is read from and what the game's forms are sent from. The controls here only carry a data-iv name: inventing.js handles
// their clicks (a delete asks first, a new folder asks for a name, the page list and the move are sent in the background); ticks and the target
// folder are written to the original controls, which are what the move sends. Built again after every swap of the content.

const CSS = '#ssh-iv{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-iv{display:block}html.ssh-modern [data-ssh-iv]{display:none!important}' +
  '#ssh-iv .iv-head{height:48px;background-repeat:no-repeat;background-position:center top}#ssh-iv .iv-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-iv .iv-intro{padding:14px 30px 4px;line-height:1.45}#ssh-iv .iv-intro p{margin:0 0 10px}' +
  '#ssh-iv .iv-folders{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 6px;padding:14px 20px 4px}' +
  '#ssh-iv .iv-f{position:relative;display:flex;flex-direction:column;align-items:center;width:60px;font-size:9px;line-height:1.2;color:#d8cfbf;text-align:center}' +
  '#ssh-iv .iv-f a{display:flex;flex-direction:column;align-items:center;gap:3px;color:inherit;text-decoration:none}#ssh-iv .iv-f a:hover{color:#fff}#ssh-iv .iv-f img{display:block;border:0}' +
  '#ssh-iv .iv-f.on .iv-fn{color:#9fe0ff;font-weight:bold}' +
  // the delete button: a small round badge in the corner of the folder, shown dimly and red when it is the one being pointed at
  '#ssh-iv .iv-x{position:absolute;top:-5px;right:3px;width:15px;height:15px;padding:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#1b1f1f;border:1px solid #4a5050;color:#8f9494;font:bold 11px/1 Arial,sans-serif;cursor:pointer;opacity:.55;transition:opacity .12s,background .12s,color .12s,border-color .12s}' +
  '#ssh-iv .iv-f:hover .iv-x{opacity:1}#ssh-iv .iv-x:hover{background:#7a1f19;border-color:#d0554b;color:#fff}' +
  '#ssh-iv .iv-new{padding:12px 0 2px;text-align:center}' +
  '#ssh-iv .iv-pg{display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:6px 30px}' +
  '#ssh-iv .iv-list{margin:6px 30px 0;border:1px solid #1d2020}' +
  '#ssh-iv .iv-r{display:flex;align-items:center;gap:8px;padding:3px 6px;border-top:1px solid #151818}#ssh-iv .iv-r:first-child{border-top:0}' +
  '#ssh-iv .iv-r.hd{background:#2a2a2a;font-weight:bold;color:#fff;padding:3px 6px}' +
  '#ssh-iv .iv-r>*:nth-child(1){flex:0 0 16px}#ssh-iv .iv-r>*:nth-child(2){flex:0 0 32px;line-height:0}#ssh-iv .iv-r>*:nth-child(3){flex:1 1 0;min-width:0}' +
  '#ssh-iv .iv-r>*:nth-child(4){flex:0 0 70px;text-align:center}#ssh-iv .iv-r>*:nth-child(5){flex:0 0 70px;text-align:center}' +
  '#ssh-iv .iv-r img{max-width:32px;max-height:32px}' +
  '#ssh-iv .iv-none{padding:10px;text-align:center;color:#a9a091}' +
  '#ssh-iv .iv-move{display:flex;align-items:center;gap:8px;padding:10px 30px 4px}' +
  '#ssh-iv select,#ssh-iv button.iv-b{height:22px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif}' +
  '#ssh-iv button.iv-b{padding:0 12px;cursor:pointer}#ssh-iv button.iv-b:hover{background:#3a4040;border-color:#8a9090;color:#fff}' +
  '#ssh-iv input[type=checkbox]{margin:0}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

function btn(label, act) {
  const b = mel('button', 'iv-b');
  b.type = 'button';
  b.dataset.iv = act;
  b.textContent = label;
  return b;
}

// A copy of the page selector: the list of pages as the game gives it, and "of N".
function pager(form) {
  const sel = form && form.querySelector('select[name="page"]');
  if (!sel) return null;
  const row = mel('div', 'iv-pg');
  const c = sel.cloneNode(true);
  ['id', 'name'].forEach((a) => c.removeAttribute(a));
  c.value = sel.value;
  const of = (txt(form).match(/of\s+\d+/i) || [''])[0];
  row.append('Page:', c, of, btn('Go', 'page'));
  return row;
}

function build(table) {
  const head = table.querySelector('td[background*="header_"]');
  const foot = table.querySelector('td[background*="large_content_footer"]');
  const box = table.rows[1] && table.rows[1].cells[0] && table.rows[1].cells[0].firstElementChild;
  const root = mel('div');
  root.id = 'ssh-iv';
  root.style.backgroundImage = cssUrl(table.getAttribute('background'));
  const hd = mel('div', 'iv-head');
  hd.style.backgroundImage = cssUrl(head && head.getAttribute('background'));
  root.append(hd);
  if (!box) return root;
  const intro = box.querySelector(':scope > p');
  if (intro) {
    const w = mel('div', 'iv-intro');
    w.append(intro.cloneNode(true));
    root.append(w);
  }
  // the folders
  const fl = mel('div', 'iv-folders');
  box.querySelectorAll(':scope > table td').forEach((td) => {
    const a = td.querySelector('a[href]');
    const img = td.querySelector('img');
    if (!a || !img) return;
    const f = mel('div', 'iv-f' + (/folder_on\.gif/.test(img.getAttribute('src') || '') ? ' on' : ''));
    const na = a.cloneNode(false);
    const im = img.cloneNode(false);
    im.src = https(img.getAttribute('src'));
    const nm = mel('span', 'iv-fn', '');
    nm.textContent = txt(td.querySelector('small')) || txt(a);
    na.append(im, nm);
    f.append(na);
    const del = td.querySelector('form input[name="folder_id"]');
    if (del) {
      const x = mel('button', 'iv-x');
      x.type = 'button';
      x.dataset.iv = 'del';
      x.dataset.fid = del.value;
      x.title = 'Delete this folder';
      x.setAttribute('aria-label', 'Delete folder ' + nm.textContent);
      x.textContent = '×';
      f.append(x);
    }
    fl.append(f);
  });
  root.append(fl);
  const nw = mel('div', 'iv-new');
  nw.append(btn('Add New Folder', 'new'));
  root.append(nw);
  // the blueprints
  const top = pager(box.querySelector('#assembly-page-top'));
  if (top) root.append(top);
  const mv = box.querySelector('#assembly-move-blueprints');
  const list = mel('div', 'iv-list');
  const hr = mel('div', 'iv-r hd');
  hr.append(mel('div'), mel('div'), mel('div', '', 'Recipe Name'), mel('div', '', 'Type'), mel('div', '', 'Item Level'));
  list.append(hr);
  const rows = mv ? [...mv.querySelectorAll('tr[data-recipe-id]')] : [];
  rows.forEach((tr) => {
    const r = mel('div', 'iv-r');
    const ck = tr.querySelector('input[type="checkbox"]');
    const c0 = mel('div');
    if (ck) {
      const cb = mel('input');
      cb.type = 'checkbox';
      cb.checked = ck.checked;
      cb.addEventListener('change', () => { ck.checked = cb.checked; }); // the original is what the move sends
      c0.append(cb);
    }
    const c1 = mel('div');
    const im = tr.querySelector('img');
    if (im) {
      const i = im.cloneNode(false);
      i.src = https(im.getAttribute('src'));
      c1.append(i);
    }
    const c2 = mel('div');
    const a = tr.querySelector('a[href]');
    if (a) c2.append(a.cloneNode(true)); else c2.textContent = txt(tr.cells[2]);
    r.append(c0, c1, c2, mel('div', '', ''), mel('div', '', ''));
    r.children[3].textContent = txt(tr.cells[3]);
    r.children[4].textContent = txt(tr.cells[4]);
    list.append(r);
  });
  if (!rows.length) list.append(mel('div', 'iv-none', '[no known blueprints]'));
  root.append(list);
  // moving the ticked blueprints to a folder
  const sel = mv && mv.querySelector('select[name="target_folder_id"]');
  if (sel) {
    const m = mel('div', 'iv-move');
    const c = sel.cloneNode(true);
    ['id', 'name'].forEach((a) => c.removeAttribute(a));
    c.value = sel.value;
    c.addEventListener('change', () => { sel.value = c.value; });
    m.append('Move selected to:', c, btn('Move Blueprints', 'move'));
    root.append(m);
  }
  const bottom = pager(box.querySelector('#assembly-page-bottom'));
  if (bottom) root.append(bottom);
  const ft = mel('div', 'iv-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : foot && foot.getAttribute('background'));
  root.append(ft);
  return root;
}

// The divs of the content `c` (the page's content cell): made from the game's table, which is hidden next to them. Safe to call again.
export function buildInventing(c) {
  const table = c && c.querySelector('table[background*="large_content_bg"]');
  if (!table || !table.querySelector('img[src*="folder"]')) return;
  if (!document.getElementById('ssh-iv-css')) {
    const st = mel('style');
    st.id = 'ssh-iv-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  c.querySelectorAll('#ssh-iv').forEach((e) => e.remove());
  table.setAttribute('data-ssh-iv', '1');
  table.after(build(table));
}
