import { fetchText, withToken } from '../core/net.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { cssUrl, esc, https, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { scaleDesc } from '../tooltips/skills.js';

// The Skill Guide page (cmd=skills&subcmd=guide) for the Modern layout: a list of divs made from the game's table (the game's own table stays in
// the page, hidden in the Modern layout, so the Original layout is untouched). Filters: by class (the skill tree a skill is in: read from
// the five tree pages) and by whether it can be learned (it is in a tree) or only comes from a Stim. Under each skill the Stims that give it, with
// the level and the duration of the buff; hovering a Stim shows the item as it shows in the bag or in a shop. The Stims are read from the
// Guide's list of Stims and the item details (kept in the browser: an item does not change). The level simulator: a level typed in the bar
// (or taken from a Stim's level by a click) shows every description with its numbers worked out for that level.

const TREES = [['Core', '#d6d64a'], ['Mutant', '#5fcf5f'], ['Soldier', '#6f94ff'], ['Purist', '#cf7cf0'], ['Cyborg', '#ff6a5a']];
const WEEK = 7 * 24 * 3600 * 1000;
const PAR = 5;

const CSS = 'html.ssh-modern [data-ssh-sg]{display:none!important}#ssh-sg{display:none}html.ssh-modern #ssh-sg{display:block}' +
  '#ssh-sg{padding:14px 20px 20px;box-sizing:border-box;width:640px;margin:0 auto;text-align:left;color:#fff}' +
  '#ssh-sg .sg-hd{height:54px;margin:-14px -20px 12px;background:center top no-repeat}' +
  '#ssh-sg .sg-ft{height:54px;margin:14px -20px -20px;background:center top no-repeat}' +
  '#ssh-sg a{color:#a7ffff;text-decoration:none}#ssh-sg a:hover{color:#fff}' +
  '#ssh-sg .sg-top{text-align:center;margin-bottom:10px}#ssh-sg .sg-txt{margin:0 0 10px}' +
  '#ssh-sg .sg-bar{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:0 0 6px;padding:6px 8px;background:#101414;border:1px solid #212323}' +
  '#ssh-sg .sg-grp{display:flex;flex-wrap:wrap;gap:4px;align-items:center}#ssh-sg .sg-lb{color:#9a9a92;font-size:10px;margin-right:2px}' +
  '#ssh-sg .sg-ch{cursor:pointer;user-select:none;padding:2px 8px;border:1px solid #3d3d3d;background:#181a1b;color:#b5b1ab;font-size:11px}' +
  '#ssh-sg .sg-ch:hover{border-color:#6a6f6f;color:#fff}#ssh-sg .sg-ch.on{border-color:#d8cfbf;color:#fff;background:#2a2d2d}' +
  '#ssh-sg .sg-q{width:130px;box-sizing:border-box;padding:2px 6px;background:#0b0e0e;color:#fff;border:1px solid #3d3d3d;font:11px Arial,sans-serif}#ssh-sg .sg-q:focus{outline:0;border-color:#9fe0ff}' +
  '#ssh-sg .sg-lv{width:64px;box-sizing:border-box;padding:2px 6px;background:#0b0e0e;color:#fff;border:1px solid #3d3d3d;font:11px Arial,sans-serif;text-align:center}#ssh-sg .sg-lv:focus{outline:0;border-color:#9fe0ff}' +
  '#ssh-sg .sg-d b{color:#7fe08a}#ssh-sg .sg-lvl{cursor:pointer;text-decoration:underline dotted}#ssh-sg .sg-lvl:hover{color:#fff}' +
  '#ssh-sg .sg-n{color:#9a9a92;font-size:11px;margin:0 0 6px;text-align:right}' +
  '#ssh-sg .sg-r{display:grid;grid-template-columns:40px minmax(0,1fr);gap:0 8px;padding:6px 6px;border-bottom:1px solid #212323}' +
  '#ssh-sg .sg-r.h{display:none}#ssh-sg .sg-r img{width:32px;height:32px;display:block}' +
  '#ssh-sg .sg-nm{font-weight:bold;font-size:12px}#ssh-sg .sg-tg{display:inline-block;margin-left:6px;font-size:10px;font-weight:normal}' +
  '#ssh-sg .sg-d{margin-top:2px;color:#e6e6e0;line-height:1.35}' +
  '#ssh-sg .sg-s{margin-top:5px;padding-top:4px;border-top:1px dotted #2c3232;font-size:11px}#ssh-sg .sg-s:empty{display:none}' +
  '#ssh-sg .sg-s .sg-sl{color:#9a9a92;margin-right:4px}#ssh-sg .sg-s div{margin:1px 0}#ssh-sg .sg-s .sg-m{color:#c9d4d4;margin-left:6px}' +
  '#ssh-sg .sg-s .sg-ld{color:#9a9a92}' +
  '#ssh-sg .sg-none{padding:16px;text-align:center;color:#9a9a92}';

export const isSkillGuide = () => !!document.querySelector('td[background*="header_skillguide"]');

// which tree(s) every skill is in, and its picture: { 'skill name': { t: [treeNumber, ...], i: 'picture' } } (kept for a week). By name: the Guide
// gives some skills a picture with the number 0 (and so no number of their own), the tree pages have the real ones.
async function loadTrees() {
  const c = store.get('sg_trees2', null);
  if (c && c.m && Date.now() - c.t < WEEK) return c.m;
  const m = {};
  await Promise.all(TREES.map(async (t, n) => {
    const doc = parseHtml(await fetchText('index.php?cmd=skills&tree_id=' + n));
    doc.querySelectorAll('a[href*="skill_id="] img').forEach((im) => {
      const cell = im.closest('table');
      const b = cell && cell.querySelector('b');
      const k = b ? b.textContent.trim().toLowerCase() : '';
      if (!k) return;
      const e = m[k] || (m[k] = { t: [], i: im.getAttribute('src') });
      if (!e.t.includes(n)) e.t.push(n);
    });
  }));
  if (Object.keys(m).length) store.set('sg_trees2', { t: Date.now(), m });
  return m;
}

// the Guide's list of Stims: [{ id, n, l }] (kept for a week)
async function loadStimList() {
  const c = store.get('sg_stims', null);
  if (c && c.list && Date.now() - c.t < WEEK) return c.list;
  const list = [];
  let first = '';
  for (let p = 1; p < 20; p++) { // a page after the last one shows the last one again
    const doc = parseHtml(await fetchText('index.php?cmd=guide&section=items&type=6&sort=level&page=' + p));
    const rows = [...doc.querySelectorAll('tr')].filter((r) => r.querySelector('a[href*="section=items"][href*="id="]') && !r.querySelector('tr'));
    if (!rows.length) break;
    const a0 = rows[0].querySelector('a');
    const k = a0.getAttribute('href');
    if (p > 1 && k === first) break;
    if (p === 1) first = k;
    rows.forEach((r) => {
      const a = r.querySelector('a[href*="id="]');
      const id = (a.getAttribute('href').match(/[?&]id=(\d+)/) || [])[1];
      if (id && !list.some((x) => x.id === id)) list.push({ id, n: a.textContent.trim(), l: parseInt((r.cells[1] || {}).textContent, 10) || 0 });
    });
    if (rows.length < 25) break;
  }
  if (list.length) store.set('sg_stims', { t: Date.now(), list, info: (c && c.info) || {} });
  return list;
}

// what a Stim gives: the skill, its level and how long it lasts (from the item's details, the ones the tooltip shows)
async function loadStimInfo(id) {
  const t = await (await fetch('fetchitem.php?item_id=' + id + '&inv_id=0&t=2&p=0&uid=' + Date.now(), { credentials: 'same-origin' })).text();
  const doc = parseHtml(t);
  const v = {};
  doc.querySelectorAll('tr').forEach((r) => {
    if (r.cells.length === 2 && !r.querySelector('tr')) v[r.cells[0].textContent.replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase()] = r.cells[1].textContent.replace(/\s+/g, ' ').trim();
  });
  if (!v['buff name']) return null;
  return { s: v['buff name'], lv: parseInt(v['buff level'], 10) || 0, d: parseInt(v['buff duration'], 10) || 0 };
}

// the game says "potions" for what are Stims
const stimWord = (t) => t.replace(/\bpotions\b/g, 'stims').replace(/\bPotions\b/g, 'Stims').replace(/\bpotion\b/g, 'stim').replace(/\bPotion\b/g, 'Stim');

const mins = (d) => (d >= 60 && d % 60 === 0 ? d / 60 + ' h' : d + ' min');

export function initSkillGuide() {
  const head = document.querySelector('td[background*="header_skillguide"]');
  const table = head && head.closest('table[width="640"]');
  const list = table && table.querySelector('table[width="90%"]');
  if (!table || !list || document.getElementById('ssh-sg')) return;
  const skills = [];
  [...list.rows].forEach((tr) => {
    const im = tr.querySelector('img[src*="skills/"]');
    if (!im || tr.cells.length < 3) return;
    skills.push({ id: (im.getAttribute('src').match(/skills\/(\d+)_small/) || [])[1], name: tr.cells[1].textContent.trim(), desc: stimWord(tr.cells[2].textContent.trim()), src: im.getAttribute('src') });
  });
  if (!skills.length) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-sg', '1');
  const root = mel('div');
  root.id = 'ssh-sg';
  const bg = table.getAttribute('background');
  if (bg) root.style.backgroundImage = cssUrl(bg);
  const hd = mel('div', 'sg-hd');
  hd.style.backgroundImage = cssUrl(https(head.getAttribute('background')));
  root.append(hd);
  const back = table.querySelector('a[href*="cmd=skills"]');
  const top = mel('div', 'sg-top');
  top.innerHTML = '[ <a href="#">View Skill Trees</a> ]';
  top.querySelector('a').href = withToken(back ? back.getAttribute('href') : 'index.php?cmd=skills');
  root.append(top);
  const intro = table.querySelector('p');
  if (intro) { const p = mel('div', 'sg-txt'); p.textContent = stimWord(intro.textContent.trim()); root.append(p); }

  // filters (kept): by class, by whether it can be learned, by name
  const f = Object.assign({ cls: -1, how: 'all', q: '' }, store.get('sg_f', {}));
  const bar = mel('div', 'sg-bar');
  const chips = (label, key, opts) => {
    const g = mel('div', 'sg-grp');
    g.append(mel('span', 'sg-lb', label));
    opts.forEach(([v, text, col]) => {
      const c = mel('span', 'sg-ch', esc(text));
      c.dataset.k = key;
      c.dataset.v = String(v);
      if (col) c.style.color = col;
      g.append(c);
    });
    return g;
  };
  bar.append(chips('Class', 'cls', [[-1, 'All'], ...TREES.map((t, n) => [n, t[0], t[1]])]), chips('Learn', 'how', [['all', 'All'], ['tree', 'In a skill tree'], ['stim', 'Stim only']]));
  const q = mel('input', 'sg-q');
  q.type = 'text';
  q.placeholder = 'Search...';
  q.value = f.q;
  const sim = mel('div', 'sg-grp');
  sim.append(mel('span', 'sg-lb', 'Level simulator'));
  const lv = mel('input', 'sg-lv');
  lv.type = 'number';
  lv.min = '0';
  lv.max = '9999';
  lv.placeholder = 'level';
  lv.title = 'Shows what every skill does at this level (the points put into it, or the level a Stim gives it)';
  sim.append(lv, mel('span', 'sg-ch', 'Off'));
  sim.lastChild.dataset.off = '1';
  bar.append(sim, q);
  root.append(bar);
  const cnt = mel('div', 'sg-n');
  root.append(cnt);
  const box = mel('div');
  root.append(box);

  const byName = new Map();
  const rows = skills.map((s) => {
    const r = mel('div', 'sg-r');
    const im = mel('img');
    im.src = https(new URL(s.src, location.href).href);
    im.alt = s.name;
    const body = mel('div');
    const nm = mel('div', 'sg-nm');
    nm.append(document.createTextNode(s.name));
    const tags = mel('span', 'sg-tg');
    nm.append(tags);
    const d = mel('div', 'sg-d');
    d.textContent = s.desc;
    d.dataset.raw = s.desc;
    const stims = mel('div', 'sg-s');
    body.append(nm, d, stims);
    r.append(im, body);
    box.append(r);
    byName.set(s.name.toLowerCase(), { s, stims });
    return { s, r, tags, stims, d, im };
  });
  const none = mel('div', 'sg-none', 'No skill matches.');
  none.hidden = true;
  box.append(none);

  let trees = null; // { id: [tree numbers] } once read
  const apply = () => {
    let n = 0;
    rows.forEach((x) => {
      const t = trees ? ((trees[x.s.name.toLowerCase()] || {}).t || []) : null; // until the trees are read nothing is hidden by class or by how it is learned
      let ok = !f.q || (x.s.name + ' ' + x.s.desc).toLowerCase().includes(f.q.toLowerCase());
      if (t) {
        if (f.cls >= 0) ok = ok && t.includes(f.cls);
        if (f.how === 'tree') ok = ok && t.length > 0;
        if (f.how === 'stim') ok = ok && t.length === 0;
      }
      x.r.classList.toggle('h', !ok);
      if (ok) n++;
    });
    none.hidden = n > 0;
    cnt.textContent = n + ' of ' + rows.length + ' skills' + (trees === null && (f.cls >= 0 || f.how !== 'all') ? ' (reading the skill trees...)' : '');
    bar.querySelectorAll('.sg-ch').forEach((c) => c.classList.toggle('on', String(f[c.dataset.k]) === c.dataset.v));
  };
  bar.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.sg-ch');
    if (!c) return;
    f[c.dataset.k] = c.dataset.k === 'cls' ? +c.dataset.v : c.dataset.v;
    store.set('sg_f', f);
    apply();
  });
  let level = 0; // the level of the simulator: 0 is off
  const describe = () => {
    rows.forEach((x) => { if (level > 0) x.d.innerHTML = scaleDesc(x.s.desc, level); else x.d.textContent = x.s.desc; });
    lv.value = level > 0 ? String(level) : '';
  };
  lv.addEventListener('input', () => { level = Math.max(0, Math.min(9999, parseInt(lv.value, 10) || 0)); describe(); });
  sim.addEventListener('click', (e) => { if (e.target.dataset && e.target.dataset.off) { level = 0; describe(); } });
  q.addEventListener('input', () => { f.q = q.value.trim(); store.set('sg_f', f); apply(); });
  apply();

  // the tags (class / Stim only)
  loadTrees().then((m) => {
    trees = m;
    rows.forEach((x) => {
      const e = m[x.s.name.toLowerCase()];
      const t = e ? e.t : [];
      if (e && /\/0_small\./.test(x.im.src)) x.im.src = https(new URL(e.i, location.href).href); // the Guide has no picture of its own for it
      x.tags.innerHTML = t.length ? t.map((n) => '<span style="color:' + TREES[n][1] + '">' + TREES[n][0] + '</span>').join(', ') : '<span style="color:#ffb36b">Stim only</span>';
    });
    apply();
  }).catch(() => { cnt.textContent = rows.length + ' skills (the skill trees could not be read)'; });

  // the Stims: listed under the skill they give, as they are read
  const fill = (id, it) => {
    const e = byName.get(it.s.toLowerCase());
    if (!e) return;
    const line = mel('div');
    line.dataset.lv = String(it.lv);
    const a = mel('a', 'sg-stim', esc(it.n));
    a.href = withToken('index.php?cmd=guide&section=items&id=' + id);
    a.dataset.id = id;
    const m = mel('span', 'sg-m', 'level <span class="sg-lvl" title="Show the skills at this level">' + it.lv + '</span> &middot; ' + mins(it.d));
    line.append(a, m);
    if (!e.stims.firstChild) e.stims.append(mel('span', 'sg-sl', 'Stims:'));
    const rest = [...e.stims.querySelectorAll('div')];
    const at = rest.find((x) => +x.dataset.lv > it.lv || (+x.dataset.lv === it.lv && x.textContent > line.textContent));
    if (at) e.stims.insertBefore(line, at); else e.stims.append(line);
  };
  (async () => {
    try {
      const l = await loadStimList();
      const c = store.get('sg_stims', { info: {} });
      const info = c.info || {};
      const todo = [];
      l.forEach((it) => { if (info[it.id]) fill(it.id, { ...info[it.id], n: it.n }); else todo.push(it); });
      let at = 0;
      await Promise.all(Array.from({ length: Math.min(PAR, todo.length) }, async () => {
        while (at < todo.length) {
          const it = todo[at++];
          try {
            const v = await loadStimInfo(it.id);
            info[it.id] = v || { s: '', lv: 0, d: 0 };
            if (v) fill(it.id, { ...v, n: it.n });
          } catch (e) { /* the next visit asks again */ }
        }
      }));
      store.set('sg_stims', { t: c.t || Date.now(), list: l, info });
    } catch (e) { /* the page stays without the Stims */ }
  })();
  root.addEventListener('click', (e) => { const l = e.target.closest && e.target.closest('.sg-lvl'); if (l) { level = parseInt(l.textContent, 10) || 0; describe(); } });
  // a Stim shows its item, as in the bag or a shop
  root.addEventListener('mouseover', (e) => {
    const a = e.target && e.target.closest && e.target.closest('a.sg-stim');
    if (a && typeof window.ajaxLoadItem === 'function') window.ajaxLoadItem(+a.dataset.id, 0, 2, 0, '');
  });

  const ft = mel('div', 'sg-ft');
  const fd = table.querySelector('td[background*="large_content_footer"]');
  ft.style.backgroundImage = S.base ? cssUrl(S.base + 'media/large_content_footer.png') : cssUrl(fd ? fd.getAttribute('background') : '');
  root.append(ft);
  table.after(root);
}
