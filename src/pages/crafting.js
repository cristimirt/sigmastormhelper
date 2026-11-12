import { fetchText } from '../core/net.js';
import { S } from '../core/state.js';
import { cssUrl, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';

// The Item Augmentation page (cmd=crafting) for the Modern layout, made of divs: .au-head (picture), .au-intro, .au-items (the items that can be
// augmented), .au-slot (the slot for the chosen item) and .au-tiers (the augmenters and their prices). The game's table stays in the page, hidden
// in the Modern layout, so the Original layout is untouched. The page is also the answer to a POST (no cmd in the address), so it is found by its markup.
// Choosing an item (a click, or dragging it onto the slot) does not reload the page: the page of that item (cmd=crafting&inv_id=...) is fetched
// in the background and its table takes the place of the hidden one. Clicking the item in the slot puts it back. An augmenter button clicks the
// button of the game's own form.

const CSS = '#ssh-au{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:11px tahoma,sans-serif;transition:opacity .15s}' +
  'html.ssh-modern #ssh-au{display:block}html.ssh-modern [data-ssh-au]{display:none!important}' +
  '#ssh-au.busy{opacity:.55;pointer-events:none}' +
  '#ssh-au .au-head,#ssh-au .au-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-au .au-intro{width:570px;margin:0 auto;padding:12px 0 6px;line-height:1.45;text-align:left}' +
  '#ssh-au .au-label{width:570px;margin:14px auto 0;padding:3px 0;background:#212323;text-align:center;font-weight:bold}' +
  '#ssh-au .au-items{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;min-height:66px;padding:14px 20px 6px}' +
  '#ssh-au .au-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:50px;font-size:10px;color:#a9a091}' +
  '#ssh-au .au-sl{width:45px;height:45px;padding:0;box-sizing:content-box;background:#0d0905;border:1px solid #202122;line-height:0;cursor:pointer}' +
  '#ssh-au .au-sl:hover{border-color:#8a9090}#ssh-au .au-sl img{display:block;width:45px;height:45px}' +
  '#ssh-au .au-none{padding:18px 0;color:#a9a091}' +
  '#ssh-au .au-mid{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 0 6px}' +
  '#ssh-au .au-mid .au-sl{width:61px;height:61px;display:flex;align-items:center;justify-content:center;border-color:#3c4a3c;background:#0b100b;cursor:default}' +
  '#ssh-au .au-mid .au-sl.full{cursor:pointer}#ssh-au .au-mid .au-sl.over{border-color:#9fe0ff;background:#14202a}' +
  '#ssh-au .au-hint{font-size:10px;color:#7d776b}' +
  '#ssh-au .au-tiers{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 0 18px}' +
  '#ssh-au .au-tier{display:flex;align-items:center;gap:6px;width:250px}' +
  '#ssh-au .au-cost{display:flex;align-items:center;justify-content:flex-end;gap:3px;width:42px;color:#fff;font-size:12px}' +
  '#ssh-au button.au-btn{flex:1;height:24px;padding:0 14px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-au button.au-btn:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-au button.au-btn:disabled{opacity:.45;cursor:default}';

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

function copyOf(n) {
  const c = n.cloneNode(true);
  if (c.nodeType !== 1) return c;
  c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
  return c;
}

// What the game's table says.
function read(t) {
  const head = t.querySelector('td[background*="header_"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const sel = t.querySelector('#augmentation-selected');
  const intro = t.rows[1] && t.rows[1].querySelector('table td:last-child');
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    intro,
    label: txt(t.querySelector('td[bgcolor="#212323"]')) || 'Your augmentable items',
    items: [...t.querySelectorAll('td[data-inventory-id]')].map((td) => ({
      id: td.getAttribute('data-inventory-id'),
      img: td.querySelector('img'),
      qty: txt(td.querySelector('small')),
    })),
    chosen: sel && sel.querySelector('img'),
    tiers: [...t.querySelectorAll('form[id^="augmentation-tier-"]')].map((f) => {
      const b = f.querySelector('input[type=submit], button');
      const tr = f.closest('tr');
      return { btn: b, cost: txt(tr.cells[0]), icon: tr.cells[1] && tr.cells[1].querySelector('img') };
    }),
  };
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-au';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'au-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.intro) {
    const b = mel('div', 'au-intro');
    b.append(...[...d.intro.childNodes].map((n) => copyOf(n)));
    root.append(b);
  }
  const lab = mel('div', 'au-label');
  lab.textContent = d.label;
  root.append(lab);
  // the items: a click chooses one, and so does dragging it onto the slot
  const list = mel('div', 'au-items');
  d.items.forEach((it) => {
    const box = mel('div', 'au-item');
    const slot = mel('div', 'au-sl');
    slot.draggable = true;
    slot.title = 'Click, or drag to the slot below';
    const p = pic(it.img);
    if (p) slot.append(p);
    slot.addEventListener('click', () => choose(it.id));
    slot.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', 'ssh-au:' + it.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    const q = mel('div');
    q.textContent = it.qty;
    box.append(slot, q);
    list.append(box);
  });
  if (!d.items.length) list.append(mel('div', 'au-none', d.chosen ? 'No other items to augment.' : 'Nothing to augment.'));
  root.append(list);
  // the slot (drop target)
  const mid = mel('div', 'au-mid');
  const slot = mel('div', 'au-sl' + (d.chosen ? ' full' : ''));
  if (d.chosen) {
    const p = pic(d.chosen);
    if (p) slot.append(p);
    slot.title = 'Click to take the item out';
    slot.addEventListener('click', () => choose(''));
  }
  slot.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; slot.classList.add('over'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('over');
    const m = /^ssh-au:(\d+)$/.exec(e.dataTransfer.getData('text/plain'));
    if (m) choose(m[1]);
  });
  mid.append(slot);
  if (!d.chosen) mid.append(mel('div', 'au-hint', 'Drag an item here'));
  root.append(mid);
  // the augmenters: each button clicks the one of the game's form
  const tiers = mel('div', 'au-tiers');
  d.tiers.forEach((x) => {
    const row = mel('div', 'au-tier');
    const cost = mel('div', 'au-cost');
    cost.append(document.createTextNode(x.cost));
    const ic = pic(x.icon);
    if (ic) cost.append(ic);
    const b = mel('button', 'au-btn');
    b.type = 'button';
    b.textContent = x.btn.value || x.btn.textContent;
    b.disabled = x.btn.disabled;
    b.addEventListener('click', () => x.btn.click());
    row.append(cost, b);
    tiers.append(row);
  });
  root.append(tiers);
  const ft = mel('div', 'au-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  root.append(ft);
  return root;
}

const tableOf = (doc) => {
  const s = doc.querySelector('#augmentation-selected');
  return s && s.closest('table[width="640"]');
};

// The page's own table is replaced by the one of the answer, and the divs are made again from it.
function swap(doc) {
  const nt = tableOf(doc);
  const cur = document.querySelector('table[data-ssh-au]');
  if (!nt || !cur) return false;
  const fresh = document.importNode(nt, true);
  fresh.setAttribute('data-ssh-au', '1');
  cur.replaceWith(fresh);
  const old = document.getElementById('ssh-au');
  const root = build(fresh);
  if (old) old.replaceWith(root); else fresh.after(root);
  return true;
}

// An item is chosen (id) or taken out of the slot (empty id), without loading the page again.
async function choose(id) {
  if (busy) return;
  busy = true;
  const root = document.getElementById('ssh-au');
  root && root.classList.add('busy');
  const url = 'index.php?cmd=crafting' + (id ? '&inv_id=' + id : '');
  try {
    if (!swap(parseHtml(await fetchText(url)))) location.href = url;
  } catch (e) {
    location.href = url;
  } finally {
    busy = false;
    const r = document.getElementById('ssh-au');
    r && r.classList.remove('busy');
  }
}

export function initCrafting() {
  const table = tableOf(document);
  if (!table || document.getElementById('ssh-au')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-au', '1');
  table.after(build(table));
}
