// ==UserScript==
// @name         Sigmastorm Wiki - Walkable Tile Mapper
// @namespace    ss.helper
// @version      0.1.0
// @description  On the Sigma Storm 2 wiki map pages: mark which tiles are walkable and export the result as JSON for the Sigmastorm Helper pathfinder.
// @author       Aurik16
// @match        https://sigmastorm2.fandom.com/wiki/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__sswm) return;
  const PREFIX = 'SSWM_';

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
  };
  // tiles:    { "39_49": "b" | "w" }         what a tile PICTURE means, shared by every map
  // maps:     { "<map name>": { over: { "x,y": "b" | "w" }, reviewed: bool } }   exceptions for single tiles
  const D = { tiles: store.get('tiles', {}), maps: store.get('maps', {}) };
  const save = () => { store.set('tiles', D.tiles); store.set('maps', D.maps); };

  // ---------------------------------------------------------------- find the map table
  // The wiki map is a table with an axis row/column around the tiles (22x22 for a 20x20 map);
  // every tile cell holds an image named like 39_49.gif.
  function findMap() {
    for (const t of document.querySelectorAll('table')) {
      if (t.rows.length < 4 || t.rows[1].cells.length < 4) continue;
      const first = t.rows[1].cells[1];
      if (first && first.querySelector('img[data-image-key]')) return t;
    }
    return null;
  }
  const table = findMap();
  if (!table) return;
  window.__sswm = true;

  const hasTile = (td) => !!(td && td.querySelector('img[data-image-key]'));
  let H = 0;
  while (H + 1 < table.rows.length && hasTile(table.rows[H + 1].cells[1])) H++;
  let W = 0;
  while (W + 1 < table.rows[1].cells.length && hasTile(table.rows[1].cells[W + 1])) W++;
  const title = (document.querySelector('h1') || {}).textContent;
  const MAP = (title || document.title.split('|')[0]).trim();
  if (!D.maps[MAP]) D.maps[MAP] = { over: {}, reviewed: false };
  const M = D.maps[MAP];

  const cells = []; // cells[y][x] = { td, id, ov }
  for (let y = 0; y < H; y++) {
    cells[y] = [];
    for (let x = 0; x < W; x++) {
      const td = table.rows[y + 1].cells[x + 1];
      const img = td && td.querySelector('img[data-image-key]');
      const id = img ? img.getAttribute('data-image-key').replace(/\.gif$/i, '') : '';
      const ov = document.createElement('div');
      ov.className = 'sswm-ov';
      const host = td.querySelector(':scope > div') || td;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(ov);
      cells[y][x] = { td, id, ov };
    }
  }

  // ---------------------------------------------------------------- state of a tile
  // Pictures that are not plain ground (stairs, shops, buildings: names like 506_a) count as walkable unless marked otherwise.
  const isSpecial = (id) => id && !/^\d+_\d+$/.test(id);
  function stateOf(c, x, y) {
    const o = M.over[x + ',' + y];
    if (o) return o;
    if (D.tiles[c.id]) return D.tiles[c.id];
    if (isSpecial(c.id)) return 'w';
    return '';
  }

  // ---------------------------------------------------------------- UI
  const st = document.createElement('style');
  st.textContent =
    '.sswm-ov{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;box-sizing:border-box;}' +
    '.sswm-ov.w{background:rgba(40,200,70,.38);}.sswm-ov.b{background:rgba(220,40,40,.45);}' +
    '.sswm-ov.o{outline:2px solid #ffd400;outline-offset:-2px;}' +
    '#sswm-panel{position:fixed;right:14px;bottom:14px;z-index:99999;width:290px;background:#14171a;color:#e8e8e8;border:1px solid #666;' +
    'font:12px Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.6);}' +
    '#sswm-panel .h{padding:6px 10px;background:#222;font-weight:bold;display:flex;justify-content:space-between;cursor:move;}' +
    '#sswm-panel .b{padding:8px 10px;line-height:1.7;}' +
    '#sswm-panel button{background:#2a2f33;color:#e8e8e8;border:1px solid #666;padding:2px 8px;margin:1px 2px 1px 0;cursor:pointer;font:12px Arial;}' +
    '#sswm-panel button:hover{border-color:#9fe0ff;}#sswm-panel button.on{background:#305a78;border-color:#9fe0ff;}' +
    '#sswm-panel textarea{width:100%;height:70px;background:#0b0d0f;color:#cfe;border:1px solid #555;font:11px monospace;box-sizing:border-box;}' +
    '#sswm-panel .k{color:#9aa;font-size:11px;}';
  document.head.appendChild(st);

  const panel = document.createElement('div');
  panel.id = 'sswm-panel';
  panel.innerHTML =
    '<div class="h"><span>Walkable tile mapper</span><span id="sswm-min" style="cursor:pointer">&minus;</span></div><div class="b" id="sswm-body">' +
    '<div id="sswm-stat"></div>' +
    '<div>Paint: <button id="sswm-m-type" class="on" title="One click marks every tile with the same picture, on every map">Tile type</button>' +
    '<button id="sswm-m-one" title="Only this one tile (an exception to its picture)">This tile only</button></div>' +
    '<div class="k">Left click / drag = walkable &middot; right click / drag = blocked &middot; Shift+click = clear</div>' +
    '<div><label><input type="checkbox" id="sswm-rev"> This map is finished (reviewed)</label></div>' +
    '<div><button id="sswm-unsetb">Unset &rarr; blocked</button><button id="sswm-unsetw">Unset &rarr; walkable</button></div>' +
    '<div><button id="sswm-copy">Copy JSON</button><button id="sswm-dl">Download</button><button id="sswm-imp">Import&hellip;</button></div>' +
    '<textarea id="sswm-ta" style="display:none" placeholder="Paste exported JSON here, then press Import again"></textarea>' +
    '<div class="k" id="sswm-msg"></div></div>';
  document.body.appendChild(panel);
  const $ = (id) => panel.querySelector('#' + id);

  let mode = 'type';
  const setMode = (m) => {
    mode = m;
    $('sswm-m-type').classList.toggle('on', m === 'type');
    $('sswm-m-one').classList.toggle('on', m === 'one');
  };
  const say = (t) => { $('sswm-msg').textContent = t; };

  function refresh() {
    let w = 0, b = 0, u = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = cells[y][x];
        const s = stateOf(c, x, y);
        c.ov.className = 'sswm-ov' + (s ? ' ' + s : '') + (M.over[x + ',' + y] ? ' o' : '');
        if (s === 'w') w++; else if (s === 'b') b++; else u++;
      }
    }
    $('sswm-stat').innerHTML = '<b>' + MAP + '</b> (' + W + '&times;' + H + ')<br>walkable ' + w + ' &middot; blocked ' + b + ' &middot; unset ' + u +
      '<br><span class="k">tile pictures learned: ' + Object.keys(D.tiles).length + ' &middot; maps reviewed: ' + Object.values(D.maps).filter((m) => m.reviewed).length + '</span>';
    $('sswm-rev').checked = !!M.reviewed;
    save();
  }

  // ---------------------------------------------------------------- painting
  function apply(c, x, y, op) {
    if (mode === 'one') {
      const k = x + ',' + y;
      if (op === 'clear') delete M.over[k]; else M.over[k] = op;
    } else if (c.id) {
      if (op === 'clear') { delete D.tiles[c.id]; } else { D.tiles[c.id] = op; }
      // a single-tile exception that now agrees with the picture is not needed any more
      Object.keys(M.over).forEach((k) => {
        const [ox, oy] = k.split(',').map(Number);
        if (cells[oy] && cells[oy][ox] && cells[oy][ox].id === c.id) delete M.over[k];
      });
    }
  }
  let drag = null;
  const cellAt = (el) => {
    const td = el && el.closest ? el.closest('td') : null;
    if (!td || !table.contains(td)) return null;
    const y = td.parentElement.rowIndex - 1;
    const x = td.cellIndex - 1;
    return cells[y] && cells[y][x] ? { c: cells[y][x], x, y } : null;
  };
  table.addEventListener('mousedown', (e) => {
    const hit = cellAt(e.target);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    const op = e.shiftKey ? 'clear' : e.button === 2 ? 'b' : e.button === 0 ? 'w' : null;
    if (!op) return;
    drag = op;
    apply(hit.c, hit.x, hit.y, op);
    refresh();
  }, true);
  table.addEventListener('mouseover', (e) => {
    if (!drag) return;
    const hit = cellAt(e.target);
    if (!hit) return;
    apply(hit.c, hit.x, hit.y, drag);
    refresh();
  }, true);
  window.addEventListener('mouseup', () => { drag = null; });
  table.addEventListener('contextmenu', (e) => { if (cellAt(e.target)) e.preventDefault(); }, true);
  table.addEventListener('click', (e) => { if (cellAt(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true); // do not follow marker links
  table.addEventListener('dragstart', (e) => e.preventDefault(), true);

  // ---------------------------------------------------------------- export / import
  function resolvedGrid() {
    const rows = [];
    for (let y = 0; y < H; y++) {
      let r = '';
      for (let x = 0; x < W; x++) { const s = stateOf(cells[y][x], x, y); r += s === 'w' ? '.' : s === 'b' ? '#' : '?'; }
      rows.push(r);
    }
    return rows;
  }
  function exportData() {
    const maps = {};
    Object.keys(D.maps).forEach((name) => {
      const m = D.maps[name];
      if (!Object.keys(m.over).length && !m.reviewed && name !== MAP) return;
      maps[name] = { overrides: m.over, reviewed: !!m.reviewed };
    });
    // the page being edited also carries the fully resolved grid ('.' walkable, '#' blocked, '?' unknown)
    maps[MAP].size = [W, H];
    maps[MAP].grid = resolvedGrid();
    return { version: 1, tiles: D.tiles, maps };
  }
  $('sswm-m-type').onclick = () => setMode('type');
  $('sswm-m-one').onclick = () => setMode('one');
  $('sswm-rev').onchange = (e) => { M.reviewed = e.target.checked; refresh(); };
  const fillUnset = (op) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = cells[y][x]; if (!stateOf(c, x, y)) { if (c.id) D.tiles[c.id] = op; else M.over[x + ',' + y] = op; } }
    refresh();
  };
  $('sswm-unsetb').onclick = () => fillUnset('b');
  $('sswm-unsetw').onclick = () => fillUnset('w');
  $('sswm-copy').onclick = async () => {
    const txt = JSON.stringify(exportData(), null, 1);
    try { await navigator.clipboard.writeText(txt); say('Copied ' + txt.length + ' characters to the clipboard.'); } catch (e) { $('sswm-ta').style.display = 'block'; $('sswm-ta').value = txt; $('sswm-ta').select(); say('Copy it manually from the box.'); }
  };
  $('sswm-dl').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' }));
    a.download = 'sigmastorm-walkable.json';
    a.click();
    say('Downloaded.');
  };
  $('sswm-imp').onclick = () => {
    const ta = $('sswm-ta');
    if (ta.style.display === 'none') { ta.style.display = 'block'; ta.value = ''; say('Paste exported JSON, press Import again.'); return; }
    try {
      const j = JSON.parse(ta.value);
      Object.assign(D.tiles, j.tiles || {});
      Object.keys(j.maps || {}).forEach((n) => { const s = j.maps[n]; D.maps[n] = { over: s.overrides || {}, reviewed: !!s.reviewed }; });
      ta.style.display = 'none';
      say('Imported.');
      Object.assign(M, D.maps[MAP] || {});
      refresh();
    } catch (e) { say('That is not valid JSON.'); }
  };
  $('sswm-min').onclick = () => { const b = $('sswm-body'); b.style.display = b.style.display === 'none' ? '' : 'none'; };

  // draggable panel
  (function () {
    const h = panel.querySelector('.h');
    let d = null;
    h.addEventListener('mousedown', (e) => { if (e.target.id === 'sswm-min') return; const r = panel.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => { if (!d) return; panel.style.left = e.clientX - d.x + 'px'; panel.style.top = e.clientY - d.y + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; });
    window.addEventListener('mouseup', () => { d = null; });
  })();

  refresh();
})();