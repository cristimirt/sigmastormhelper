import { VERSION } from './core/constants.js';
import { pageParts } from './core/page.js';
import { CFG_DEFAULT, S } from './core/state.js';
import { store } from './core/storage.js';
import { esc } from './core/util.js';

export function initSettings() {
  const p = pageParts();
  const t = p && p.body.querySelector('table[background*="large_content_bg"]');
  if (!t || !t.tBodies.length || t.dataset.sshTabs) return;
  t.dataset.sshTabs = '1';
  const body = t.tBodies[0];
  const rows = [...body.rows];
  const head = rows[0];
  rows.slice(1).forEach((r) => r.classList.add('ssh-game-row'));
  const st = document.createElement('style');
  st.textContent =
    '#ssh-tabs{text-align:center;padding:2px 0 8px;}#ssh-tabs input.custombutton{margin:0 3px;width:150px;height:22px;cursor:pointer;}' +
    '#ssh-tabs input.custombutton.on{border-color:#e8872a;color:#ffb36b;}' +
    'table.ssh-helper .ssh-game-row{display:none;}' +
    'table.ssh-game .ssh-helper-row{display:none;}' +
    '.ssh-set{width:540px;margin:0 auto;}.ssh-set h4{margin:14px 0 6px;padding:2px 0;border-bottom:1px solid #4a4a4a;color:#ffb36b;font-size:11px;letter-spacing:1px;text-transform:uppercase;}' +
    '.ssh-set label,.ssh-set .lb{display:block;margin:4px 0;color:#cfcfcf;}.ssh-set .lb small{color:#8b8b8b;}' +
    '.ssh-set input[type=text],.ssh-set input[type=number],.ssh-set textarea{background:#181a1b;color:#fff;border:1px solid #848484;padding:2px;font:11px Verdana,sans-serif;}' +
    '.ssh-set textarea{width:100%;height:90px;box-sizing:border-box;}.ssh-set .btns{margin:12px 0;text-align:center;}' +
    '.ssh-set .btns input{margin:0 4px;}.ssh-set .note{color:#8fd18f;margin-left:8px;}';
  document.head.appendChild(st);
  t.classList.add('ssh-game');
  const tabs = document.createElement('tr');
  tabs.innerHTML = '<td colspan="3"><div id="ssh-tabs"><input type="button" class="custombutton on" data-tab="game" value="Game Settings"><input type="button" class="custombutton" data-tab="ssh" value="Sigmastorm Helper"></div></td>';
  head.parentNode.insertBefore(tabs, head.nextSibling);
  const F = [
    ['h', 'Map and movement'],
    ['route', 'check', 'Route preview and click to walk', 'Hover a tile to see the route, click to walk it. Press any key or click the map to stop.'],
    ['stopOnCreatures', 'check', 'Stop walking when there are creatures on a tile'],
    ['stepDelay', 'number', 'Delay between steps (milliseconds)', 'Lower is faster. Minimum 100.'],
    ['slide', 'check', 'Slide animation when moving'],
    ['h', 'Top banner'],
    ['bannerNums', 'check', 'Write HP, skill power and the energy maximum on the banner'],
    ['durBar', 'check', 'Show the gear durability bar'],
    ['h', 'Items'],
    ['gearCompare', 'check', 'Compare gear in item tooltips', 'An item you are not wearing is shown next to the worn item of the same kind, with the differences coloured.'],
    ['h', 'Side panels'],
    ['movePanels', 'check', 'Move Game Stats and Kill Logs to the left column', 'Takes effect after reloading the page.'],
  ];
  const field = (f) => {
    if (f[0] === 'h') return '<h4>' + f[1] + '</h4>';
    const v = S.cfg[f[0]];
    const tip = f[3] ? ' title="' + esc(f[3]) + '"' : '';
    if (f[1] === 'check') return '<label' + tip + '><input type="checkbox" data-k="' + f[0] + '"' + (v ? ' checked' : '') + '> ' + f[2] + '</label>';
    return '<div class="lb"' + tip + '>' + f[2] + ': <input type="' + f[1] + '" data-k="' + f[0] + '" value="' + esc(v) + '"' + (f[1] === 'number' ? ' min="100" max="3000" style="width:70px"' : ' style="width:260px"') + '></div>' + (f[3] ? '<div class="lb"><small>' + f[3] + '</small></div>' : '');
  };
  const tilesKnown = () => Object.keys(S.learn.tiles).length + Object.values(S.learn.over).reduce((n, o) => n + Object.keys(o).length, 0);
  const panel = document.createElement('tr');
  panel.className = 'ssh-helper-row';
  panel.innerHTML = '<td colspan="3"><div class="ssh-set">' + F.map(field).join('') +
    '<div class="btns"><input type="button" class="custombutton" id="ssh-save" value="Save Settings"><input type="button" class="custombutton" id="ssh-defaults" value="Defaults"><span class="note" id="ssh-note"></span></div>' +
    '<h4>Learned map data</h4><div class="lb">Walkable and blocked tiles the helper has learned while you played: <b id="ssh-known">' + tilesKnown() + '</b> entries.</div>' +
    '<textarea id="ssh-data" placeholder="Export puts the learned data here. To import, paste exported data here and press Import."></textarea>' +
    '<div class="btns"><input type="button" class="custombutton" id="ssh-exp" value="Export"><input type="button" class="custombutton" id="ssh-imp" value="Import"><input type="button" class="custombutton" id="ssh-reset" value="Forget learned data"><input type="button" class="custombutton" id="ssh-fpclear" value="Clear footprints"></div>' +
    '<div class="lb"><small>Sigmastorm Helper ' + esc(VERSION) + ' (build ' + esc(String(S.build)) + '). Settings are kept in this browser.</small></div></div></td>';
  tabs.parentNode.insertBefore(panel, tabs.nextSibling);
  const note = (m) => { const n = document.getElementById('ssh-note'); if (n) { n.textContent = m; setTimeout(() => { n.textContent = ''; }, 2500); } };
  const readCfg = () => {
    const c = Object.assign({}, S.cfg);
    panel.querySelectorAll('[data-k]').forEach((i) => { c[i.getAttribute('data-k')] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Math.min(3000, Math.max(100, +i.value || 320)) : i.value.trim(); });
    return c;
  };
  const show = (which) => {
    t.classList.toggle('ssh-helper', which === 'ssh');
    t.classList.toggle('ssh-game', which !== 'ssh');
    tabs.querySelectorAll('input').forEach((b) => b.classList.toggle('on', b.getAttribute('data-tab') === which));
    try { sessionStorage.setItem('SSH_tab', which); } catch (e) { /* ignore */ }
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('input[data-tab]'); if (b) show(b.getAttribute('data-tab')); });
  panel.addEventListener('click', (e) => {
    const id = e.target && e.target.id;
    if (id === 'ssh-save') { S.cfg = readCfg(); store.set('cfg', S.cfg); note('Saved.'); }
    else if (id === 'ssh-defaults') { store.set('cfg', {}); S.cfg = Object.assign({}, CFG_DEFAULT); panel.querySelectorAll('[data-k]').forEach((i) => { const v = CFG_DEFAULT[i.getAttribute('data-k')]; if (i.type === 'checkbox') i.checked = !!v; else i.value = v; }); note('Defaults restored.'); }
    else if (id === 'ssh-exp') { document.getElementById('ssh-data').value = JSON.stringify(S.learn); note('Exported below.'); }
    else if (id === 'ssh-imp') {
      try {
        const d = JSON.parse(document.getElementById('ssh-data').value);
        if (!d || typeof d !== 'object') throw new Error('bad');
        Object.assign(S.learn.tiles, d.tiles || {});
        Object.keys(d.over || {}).forEach((a) => { S.learn.over[a] = Object.assign(S.learn.over[a] || {}, d.over[a]); });
        store.set('learn', S.learn);
        document.getElementById('ssh-known').textContent = tilesKnown();
        note('Imported.');
      } catch (er) { note('That is not valid exported data.'); }
    } else if (id === 'ssh-reset') {
      if (e.target.value !== 'Sure? Click again') { e.target.value = 'Sure? Click again'; setTimeout(() => { e.target.value = 'Forget learned data'; }, 3000); return; }
      e.target.value = 'Forget learned data';
      S.learn = { tiles: {}, over: {} };
      store.set('learn', S.learn);
      document.getElementById('ssh-known').textContent = '0';
      note('Learned data cleared.');
    } else if (id === 'ssh-fpclear') {
      try { Object.keys(localStorage).filter((k) => /^SSH_(trail|fp)/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (er) { /* ignore */ }
      note('Footprints cleared.');
    }
  });
  let want = 'game';
  try { want = sessionStorage.getItem('SSH_tab') || 'game'; } catch (e) { want = 'game'; }
  show(want === 'ssh' && !/subcmd=savesettings/.test(location.search) ? 'ssh' : 'game');
}

// Game Stats and Kill Logs sit at the bottom of the right column and make the page taller than the
// left column needs; move them under the left menu to balance the two sides.
export function movePanels() {
  if (!S.cfg.movePanels) return;
  const M = document.getElementById('mainContentDiv');
  if (!M || !M.rows[1] || M.rows[1].cells.length < 3 || document.getElementById('ssh-moved')) return;
  const L = M.rows[1].cells[0];
  const R = M.rows[1].cells[M.rows[1].cells.length - 1];
  const lt = L.querySelector(':scope > table');
  if (!lt) return;
  const find = (k) => [...R.querySelectorAll('table')].find((t) => (t.style.backgroundImage || '').indexOf(k) > -1);
  const w = document.createElement('div');
  w.id = 'ssh-moved';
  w.style.marginTop = '13px'; // same gap the game leaves between its panels
  ['subhead_gamestats', 'subhead_killlogs'].forEach((k) => {
    const h = find(k);
    const b = h && h.nextElementSibling;
    const f = b && b.nextElementSibling;
    if (!f) return;
    if (!w.style.marginLeft) w.style.marginLeft = Math.max(0, (lt.offsetWidth - h.offsetWidth) / 2) + 'px'; // measure before moving
    [h, b, f, f.nextElementSibling && f.nextElementSibling.tagName === 'BR' ? f.nextElementSibling : null].forEach((e) => { if (e) w.appendChild(e); });
  });
  if (w.children.length) L.appendChild(w);
}

// A dozen empty <br> after the copyright line only add blank scroll space at the bottom of the page.
export function trimTail() {
  const divs = [...document.querySelectorAll('div')].filter((d) => /Hunted Cow/i.test(d.textContent) && d.textContent.length < 300 && !d.querySelector('div'));
  const c = divs[divs.length - 1];
  if (!c) return;
  let n = c.nextSibling;
  while (n) {
    const nx = n.nextSibling;
    if (n.nodeType === 1 && n.tagName === 'BR') n.remove();
    else if (n.nodeType === 1 && n.tagName !== 'SCRIPT') break;
    n = nx;
  }
}
