import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { esc } from '../core/util.js';
import { compareParts, loadItem, pairCss, tipLook } from './compare.js';

const BP_V = 1;

const bpMem = new Map(); // recipe id -> promise of the data (also kept in localStorage)

async function bpItem(a) {
  const key = 'bpi:' + a[0];
  const c = store.get(key, null);
  if (c && c.v === BP_V) return c;
  const html = await (await fetch('fetchitem.php?item_id=' + a[0] + '&inv_id=' + a[1] + '&t=' + a[2] + '&p=' + a[3] + '&uid=' + Date.now(), { credentials: 'same-origin' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const td = doc.querySelector('td');
  let lines = [];
  if (td) {
    const cl = td.cloneNode(true);
    cl.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    lines = cl.textContent.split('\n').map((x) => x.trim()).filter(Boolean);
  }
  const rec = { v: BP_V, name: lines[0] || '?', type: lines[1] || '', quality: lines.slice(2).join(' \u00b7 '), html };
  store.set(key, rec);
  return rec;
}

function parseRecipe(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const c = doc.getElementById('mainContentDiv') || doc.body;
  const out = { v: BP_V, credits: null, items: [], comps: [], target: null, mine: null };
  const cf = [...doc.querySelectorAll('table.sidebars font')].find((f) => /^[\d,]+$/.test(f.textContent.trim()));
  if (cf) out.mine = parseInt(cf.textContent.replace(/,/g, ''), 10);
  [...c.querySelectorAll('td > b')].forEach((b) => {
    const n = b.textContent;
    const key = /Credits Required/.test(n) ? 'credits' : /Items Required/.test(n) ? 'items' : /Components Required/.test(n) ? 'comps' : /Target Invention/.test(n) ? 'target' : null;
    if (!key) return;
    let row = b.closest('tr').nextElementSibling;
    while (row && !row.querySelector('td > b')) {
      if (key === 'credits') {
        const m = row.textContent.replace(/\s+/g, ' ').match(/(\d[\d,]*)/);
        if (m && out.credits === null) out.credits = parseInt(m[1].replace(/,/g, ''), 10);
      } else {
        row.querySelectorAll('img[onmouseover*="ajaxLoadItem"]').forEach((i) => {
          const m = i.getAttribute('onmouseover').match(/ajaxLoadItem\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/);
          if (!m) return;
          const q = (i.closest('table') ? i.closest('table').textContent : '').match(/(\d+)\s*\/\s*(\d+)/);
          const e = { src: i.getAttribute('src'), a: m.slice(1, 5), need: q ? parseInt(q[2], 10) : 1, have: q ? parseInt(q[1], 10) : 0 };
          if (key === 'target') out.target = e; else out[key].push(e);
        });
      }
      row = row.nextElementSibling;
    }
  });
  return out;
}

const bpHave = new Map(); // recipe id -> { t, list: owned counts in the order items, components } (never stored: it changes)

const bpSplit = (d) => { bpHave.set(d.id, { t: Date.now(), mine: d.mine, list: [...d.items, ...d.comps].map((e) => e.have) }); };

function bpStrip(d) {
  const c = JSON.parse(JSON.stringify(d));
  delete c.mine;
  [...c.items, ...c.comps].forEach((e) => { delete e.have; });
  return c;
}

async function bpRefresh(id) {
  const html = await (await fetch('index.php?cmd=inventing&subcmd=viewrecipe&recipe_id=' + id, { credentials: 'same-origin' })).text();
  const d = parseRecipe(html);
  d.id = id;
  if (!d.target) throw new Error('no blueprint data');
  bpSplit(d);
  return d;
}

function bpData(id) {
  const key = 'bp:' + id;
  const c = store.get(key, null);
  if (c && c.v === BP_V) return Promise.resolve(c);
  if (bpMem.has(id)) return bpMem.get(id);
  const pr = (async () => {
    const d = await bpRefresh(id);
    const c = bpStrip(d);
    store.set(key, c);
    return c;
  })();
  bpMem.set(id, pr);
  pr.catch(() => bpMem.delete(id));
  return pr;
}

async function bpHtml(id) {
  const d = await bpData(id);
  const all = await Promise.all([...d.items, ...d.comps, d.target].map((e) => bpItem(e.a)));
  const hv = bpHave.get(id);
  const qty = (e, i) => {
    const have = hv ? hv.list[i] : undefined;
    if (have === undefined) return '&times;' + e.need;
    return '<span style="color:' + (have >= e.need ? '#7fe08a' : '#ff6b6b') + '">' + have + '</span> / ' + e.need;
  };
  const row = (e, i) => '<div class="bp-r"><img src="' + esc(e.src) + '"><div class="bp-i"><div class="bp-n">' + esc(all[i].name) + '</div><div class="bp-t">' + esc([all[i].type, all[i].quality].filter(Boolean).join(' \u00b7 ')) + '</div></div><div class="bp-q">' + qty(e, i) + '</div></div>';
  let k = 0;
  const mine = hv && hv.mine !== null && hv.mine !== undefined ? hv.mine : null;
  const cred = d.credits === null ? '?' : d.credits.toLocaleString('en-US');
  let h = '<div class="bp-s">Credits required: <b style="color:' + (mine === null || d.credits === null ? '#fff' : mine >= d.credits ? '#7fe08a' : '#ff6b6b') + '">' + cred + '</b>' + (mine === null ? '' : ' <span style="font-weight:normal;color:#9a9488">(you have ' + mine.toLocaleString('en-US') + ')</span>') + '</div>';
  h += '<div class="bp-s">Items required</div>' + (d.items.length ? d.items.map((e) => row(e, k++)).join('') : '<div class="bp-t">None</div>');
  h += '<div class="bp-s">Components required</div>' + (d.comps.length ? d.comps.map((e) => row(e, k++)).join('') : '<div class="bp-t">None</div>');
  const ti = all[k];
  // an equippable result is shown next to the worn item of its kind, its numbers coloured against the worn one's
  let target = ti.html;
  let worn = null;
  if (S.cfg.gearCompare) {
    const c = await compareParts(ti.html, loadItem).catch(() => null);
    if (c) { target = c.html; worn = c.worn; }
  }
  h += '<div class="bp-s">Resulting item</div><div class="bp-res"><img src="' + esc(d.target.src) + '"><div class="bp-blk">' + target + '</div></div>';
  return { html: h, worn };
}

const BP_W = 410;

export function initRecipes() {
  const look = tipLook(); // the same look as the game's other tooltips (a slightly see-through background)
  const st = document.createElement('style');
  st.textContent = '#ssh-bp{position:fixed;z-index:9400;width:' + BP_W + 'px;display:none;box-sizing:content-box;' + look.box + 'pointer-events:none;}' +
    pairCss('#ssh-bp') + '#ssh-bp .ce table{max-width:100%}' +
    '#ssh-bp .bp-s{margin:8px 0 4px;padding:2px 6px;background:' + look.title + ';color:#fff;font-weight:bold;}#ssh-bp .bp-s:first-child{margin-top:0;}' +
    '#ssh-bp .bp-r{display:flex;align-items:center;gap:8px;margin:3px 0;}#ssh-bp .bp-r img{width:36px;height:36px;flex:none;background:#0D0905;border:1px solid #202122;object-fit:contain;}' +
    '#ssh-bp .bp-i{flex:1;min-width:0;}#ssh-bp .bp-n{font-weight:bold;color:#fff;}#ssh-bp .bp-t{color:#9a9488;font-size:11px;}#ssh-bp .bp-q{font-weight:bold;color:#e8c36a;}' +
    '#ssh-bp .bp-res{display:flex;gap:8px;align-items:flex-start;}#ssh-bp .bp-res>img{width:45px;height:45px;flex:none;background:#0D0905;border:1px solid #202122;}#ssh-bp .bp-blk{flex:1;min-width:0;overflow:hidden;}#ssh-bp .bp-blk table{max-width:100%;}';
  document.head.appendChild(st);
  const tip = document.createElement('div');
  tip.id = 'ssh-bp';
  document.body.appendChild(tip);
  let cur = null;
  let seq = 0;
  // opens towards the middle of the window, like the other tooltips: left of the pointer on the right half, above it on the lower half
  const place = (e) => {
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    tip.classList.toggle('flip', e.clientX > vw / 2);
    const x = e.clientX > vw / 2 ? e.clientX - look.offX - w : e.clientX + look.offX;
    const y = e.clientY > vh / 2 ? e.clientY - look.offY - h : e.clientY + look.offY;
    tip.style.left = Math.min(Math.max(4, x), Math.max(4, vw - w - 4)) + 'px';
    tip.style.top = Math.min(Math.max(4, y), Math.max(4, vh - h - 4)) + 'px';
  };
  // the tooltip, or the pair of tooltips (the result and the worn item) twice as wide
  const setTip = (r) => {
    tip.style.width = (r.worn ? BP_W * 2 + 17 : BP_W) + 'px';
    tip.innerHTML = r.worn ? '<div class="cw"><div class="cm">' + r.html + '</div><div class="ce"><div class="eqh">Equipped</div>' + r.worn + '</div></div>' : r.html;
  };
  document.addEventListener('mouseover', async (e) => {
    const img = e.target && typeof e.target.closest === 'function' ? e.target.closest('img[src*="/recipes/"]') : null;
    if (!img) return;
    const a = img.closest('tr') && img.closest('tr').querySelector('a[href*="recipe_id="]');
    const id = a && (a.getAttribute('href').match(/recipe_id=(\d+)/) || [])[1];
    if (!id || cur === img) return;
    cur = img;
    const my = ++seq;
    setTip({ html: '<span class="ssh-spin"></span> Loading blueprint...' });
    tip.style.display = 'block';
    place(e);
    try {
      const r = await bpHtml(id);
      if (my !== seq) return;
      setTip(r);
      place(e);
      const hv = bpHave.get(id);
      if (!hv || Date.now() - hv.t > 8000) { // the owned counts are always re-read; everything else comes from the cache
        await bpRefresh(id);
        if (my !== seq) return;
        setTip(await bpHtml(id));
        place(e);
      }
    } catch (x) {
      if (my === seq) setTip({ html: 'Could not load this blueprint.' });
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (!cur) return;
    const to = e.relatedTarget;
    if (to && cur.contains(to)) return;
    if (e.target === cur || cur.contains(e.target)) { cur = null; seq++; tip.style.display = 'none'; }
  });
  document.addEventListener('mousemove', (e) => { if (cur && tip.style.display !== 'none') place(e); });
}
