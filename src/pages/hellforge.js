import { fetchText } from '../core/net.js';
import { S } from '../core/state.js';
import { cssUrl, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';

// The Engineering page (cmd=hellforge) for the Modern layout, made of divs: .hf-head (picture), .hf-intro, .hf-items (the items that can be
// upgraded), .hf-forge (the slot in the middle with the Upgrade button), .hf-cost and the level guide. The game's table stays in the page, hidden in the
// Modern layout, so the Original layout is untouched.
// Choosing an item (a click, or dragging it onto the slot in the middle) does not reload the page: the page of that item (cmd=hellforge&inv_id=...)
// is fetched in the background and its table takes the place of the hidden one. Clicking the item in the slot puts it back. The Upgrade button
// clicks the button of the game's own form.

const CSS = '#ssh-hf{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif;transition:opacity .15s}' +
  'html.ssh-modern #ssh-hf{display:block}html.ssh-modern [data-ssh-hf]{display:none!important}' +
  '#ssh-hf.busy{opacity:.55;pointer-events:none}' +
  '#ssh-hf .hf-head,#ssh-hf .hf-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-hf .hf-intro{width:570px;margin:0 auto;padding:12px 0 6px;line-height:1.45}' +
  '#ssh-hf .hf-intro p{margin:0}' +
  '#ssh-hf .hf-items{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;min-height:66px;padding:14px 20px 6px}' +
  '#ssh-hf .hf-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:50px;font-size:10px;color:#a9a091}' +
  '#ssh-hf .hf-slot{width:45px;height:45px;padding:0;box-sizing:content-box;background:#0d0905;border:1px solid #202122;line-height:0;cursor:pointer}' +
  '#ssh-hf .hf-slot:hover{border-color:#8a9090}#ssh-hf .hf-slot img{display:block;width:45px;height:45px}' +
  '#ssh-hf .hf-none{padding:18px 0;color:#a9a091}' +
  '#ssh-hf .hf-forge{display:flex;align-items:center;justify-content:center;gap:34px;padding:30px 0 6px}' +
  '#ssh-hf .hf-mid{display:flex;flex-direction:column;align-items:center;gap:12px}' +
  '#ssh-hf .hf-mid .hf-slot{width:61px;height:61px;display:flex;align-items:center;justify-content:center;border-color:#3c4a3c;background:#0b100b;cursor:default}' +
  '#ssh-hf .hf-mid .hf-slot.full{cursor:pointer}#ssh-hf .hf-mid .hf-slot.over{border-color:#9fe0ff;background:#14202a}' +
  '#ssh-hf .hf-mid .hf-slot img{width:45px;height:45px}' +
  '#ssh-hf .hf-mid .hf-dur{font-size:10px;color:#a9a091;line-height:1;margin-top:-6px}' +
  '#ssh-hf .hf-hint{font-size:10px;color:#7d776b}' +
  '#ssh-hf .hf-cost{padding:12px 0 0;text-align:center}' +
  '#ssh-hf .hf-cost table{margin:4px auto 0}#ssh-hf .hf-cost td{padding:0 2px;color:#fff;font-size:12px}' +
  '#ssh-hf .hf-guide{padding:16px 0 4px;text-align:center}#ssh-hf .hf-guide b{font-size:12px}' +
  '#ssh-hf .hf-text{width:570px;margin:0 auto;padding:8px 0;line-height:1.45;text-align:left}#ssh-hf .hf-text p{margin:0}' +
  '#ssh-hf .hf-levels{padding:6px 0 10px}#ssh-hf .hf-levels table{margin:0 auto}#ssh-hf .hf-levels td{padding:2px 6px;font-size:11px;color:#d8cfbf}' +
  '#ssh-hf button.hf-btn{min-width:68px;height:24px;padding:0 14px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-hf button.hf-btn:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-hf button.hf-btn:disabled{opacity:.45;cursor:default}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
let busy = false;

// The picture of a worn item: a copy that keeps the game's tooltip handler.
function pic(img) {
  if (!img) return null;
  const i = img.cloneNode(false);
  i.src = https(img.getAttribute('src'));
  i.draggable = false;
  return i;
}

// A copy of a piece of the game's markup with its pictures on https.
function copyOf(n) {
  const c = n.cloneNode(true);
  c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
  return c;
}

// What the game's table says.
function read(t) {
  const head = t.querySelector('td[background*="header_"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const rows = [...t.rows];
  const guideAt = rows.findIndex((r) => /Engineering Level Guide/i.test(txt(r)));
  const price = t.querySelector('#engineering-price');
  const des = t.querySelector('#engineering-deselect');
  const form = t.querySelector('#engineering-upgrade');
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    intro: rows[1] && rows[1].querySelector('p'),
    items: [...t.querySelectorAll('td[data-engineering-id]')].map((td) => ({
      id: td.getAttribute('data-engineering-id'),
      img: td.querySelector('img'),
      dur: txt(td.querySelector('font')),
    })),
    chosen: des && { img: des.querySelector('img'), dur: txt(des.closest('td').querySelector('font')) },
    forgeImg: form && form.closest('tr').querySelector('img'),
    form,
    btn: form && form.querySelector('input[type=submit], button'),
    cost: price && price.closest('table[width="400"]'),
    guide: guideAt < 0 ? [] : rows.slice(guideAt, rows.length - 1),
  };
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-hf';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'hf-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.intro) {
    const b = mel('div', 'hf-intro');
    b.append(copyOf(d.intro));
    root.append(b);
  }
  // the items that can be upgraded: a click chooses one, and so does dragging it onto the slot in the middle
  const list = mel('div', 'hf-items');
  d.items.forEach((it) => {
    const box = mel('div', 'hf-item');
    const slot = mel('div', 'hf-slot');
    slot.draggable = true;
    slot.title = 'Click, or drag to the slot below';
    const p = pic(it.img);
    if (p) slot.append(p);
    slot.addEventListener('click', () => choose(it.id));
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', 'ssh-hf:' + it.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    box.append(slot, mel('div', '', ''));
    box.lastChild.textContent = it.dur;
    list.append(box);
  });
  if (!d.items.length) list.append(mel('div', 'hf-none', d.chosen ? 'No other items to upgrade.' : 'Nothing to upgrade.'));
  root.append(list);
  // the forge: the slot in the middle (drop target), the Upgrade button
  const forge = mel('div', 'hf-forge');
  if (d.forgeImg) forge.append(pic(d.forgeImg));
  const mid = mel('div', 'hf-mid');
  const slot = mel('div', 'hf-slot' + (d.chosen ? ' full' : ''));
  if (d.chosen) {
    const p = pic(d.chosen.img);
    if (p) slot.append(p);
    slot.title = 'Click to take the item out';
    slot.addEventListener('click', () => choose(''));
  }
  slot.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; slot.classList.add('over'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('over');
    const m = /^ssh-hf:(\d+)$/.exec(e.dataTransfer.getData('text/plain'));
    if (m) choose(m[1]);
  });
  mid.append(slot);
  if (d.chosen) {
    mid.append(mel('div', 'hf-dur'));
    mid.lastChild.textContent = d.chosen.dur;
  } else mid.append(mel('div', 'hf-hint', 'Drag an item here'));
  if (d.btn) {
    const b = mel('button', 'hf-btn');
    b.type = 'button';
    b.textContent = d.btn.value || d.btn.textContent;
    b.addEventListener('click', () => d.btn.click());
    mid.append(b);
  }
  forge.append(mid);
  root.append(forge);
  if (d.cost) {
    const c = mel('div', 'hf-cost');
    c.append(mel('b', '', 'Upgrade Cost'));
    const tb = copyOf(d.cost.querySelector('table'));
    c.append(tb);
    root.append(c);
  }
  // the level guide: the rows of the game under the forge, copied as they are
  d.guide.forEach((r, i) => {
    const td = r.cells[0];
    if (!td) return;
    const levels = td.querySelector('table[width="400"]');
    const row = mel('div', i === 0 ? 'hf-guide' : levels ? 'hf-levels' : 'hf-text');
    if (i === 0) row.append(mel('b', '', ''));
    if (i === 0) row.lastChild.textContent = txt(td);
    else if (levels) row.append(copyOf(levels));
    else td.querySelectorAll('p').forEach((p) => row.append(copyOf(p)));
    root.append(row);
  });
  const ft = mel('div', 'hf-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  root.append(ft);
  return root;
}

// The page's own table is replaced by the one of the answer, and the divs are made again from it.
function swap(doc) {
  const f = doc.querySelector('#engineering-upgrade') || doc.querySelector('td[data-engineering-id]');
  const nt = f && f.closest('table[width="640"]');
  const cur = document.querySelector('table[data-ssh-hf]');
  if (!nt || !cur) return false;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-hf', '1');
  cur.replaceWith(fresh);
  const old = document.getElementById('ssh-hf');
  const root = build(fresh);
  if (old) old.replaceWith(root); else fresh.after(root);
  return true;
}

// An item is chosen (id) or taken out of the slot (empty id), without loading the page again.
async function choose(id) {
  if (busy) return;
  busy = true;
  const root = document.getElementById('ssh-hf');
  root && root.classList.add('busy');
  const url = 'index.php?cmd=hellforge' + (id ? '&inv_id=' + id : '');
  try {
    if (!swap(parseHtml(await fetchText(url)))) location.href = url;
  } catch (e) {
    location.href = url; // the page loads the normal way
  } finally {
    busy = false;
    const r = document.getElementById('ssh-hf');
    r && r.classList.remove('busy');
  }
}

export function initHellforge() {
  const f = document.querySelector('#engineering-upgrade, td[data-engineering-id]');
  const table = f && f.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-hf')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-hf', '1');
  table.after(build(table));
}
