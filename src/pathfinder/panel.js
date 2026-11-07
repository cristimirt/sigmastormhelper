// Sigmastorm Path Finder: a button on the map opens a panel where you search an area by name or level and it shows the
// shortest way from where you stand (stairs, world maps, portals). The route data is route.json of the website.
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { esc } from '../core/util.js';
import { create } from './route.js';
import { liveWalk, startsOnTile, stepMain, stepShort } from './steptext.js';

const SITE = 'https://cristimirt.github.io/sspathfinder/';

const st = { open: false, dest: '', mode: 'name', router: null, error: '', loading: null, route: null, here: null, key: null, tile: null, timer: 0, sugg: [], active: 0 };

const siteUrl = () => store.get('pfurl', '') || SITE; // `SSH_pfurl` in localStorage points it elsewhere (a local copy of the website)

function loadRouter() {
  st.error = '';
  st.loading = (async () => {
    const url = siteUrl() + 'route.json';
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      st.router = create(await r.json());
    } catch (e) {
      st.error = 'Could not load the map data (' + e.message + ') from ' + url;
    }
    st.loading = null;
    recompute();
    draw();
  })();
  return st.loading;
}

function recompute() {
  st.route = null;
  const { router, dest, here, tile } = st;
  if (!router || !dest || !here || !router.byName[dest] || here.name === dest) return;
  st.route = router.findRoute(here.name, dest, tile);
}

// Called after every move (renderWorld) and when the panel opens: re-plans when the area changed, later when the tile did.
export function pfUpdate() {
  if (!st.open || !st.router || !S.loc) return;
  const area = st.router.byName[S.loc.area] || null;
  const tile = [S.loc.x, S.loc.y];
  const key = area ? area.name : '?' + S.loc.area;
  const moved = !st.tile || st.tile[0] !== tile[0] || st.tile[1] !== tile[1];
  st.tile = tile;
  clearTimeout(st.timer);
  if (key !== st.key) {
    st.key = key;
    st.here = area;
    st.route = null;
    recompute();
    draw();
  } else if (moved) {
    draw(); // the step shown follows you right away; the way itself is worked out again once you stand still
    st.timer = setTimeout(() => { recompute(); draw(); }, 450);
  }
}

// "120" is one level, "100-120" (or "100 120") a range
function byLevel(text) {
  const n = text.match(/\d+/g);
  if (!n) return [];
  const lo = Math.min(+n[0], +n[n.length - 1]);
  const hi = Math.max(+n[0], +n[n.length - 1]);
  return st.router.realms.filter((a) => a.level >= lo && a.level <= hi).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function setDest(name) {
  st.dest = name || '';
  store.set('pfdest', st.dest);
  recompute();
  draw();
}

function suggest(input) {
  const q = input.value;
  if (!st.router || !q.trim()) st.sugg = [];
  else st.sugg = st.mode === 'level' ? byLevel(q) : st.router.search(q, 8);
  st.active = 0;
  drawSugg();
}

function drawSugg() {
  const ul = document.querySelector('#ssh-pf .sg');
  if (!ul) return;
  ul.hidden = !st.sugg.length;
  ul.innerHTML = st.sugg.map((a, i) => '<li data-n="' + esc(a.name) + '"' + (i === st.active ? ' class="on"' : '') + '>' + esc(a.name) +
    '<span>' + (a.kind === 'master' ? 'World map' : 'Lv ' + a.level) + '</span></li>').join('');
}

function bodyHtml() {
  const { router, dest, here, route } = st;
  if (!dest) return '<div class="m">' + (st.mode === 'level' ? 'Type a level above, then pick one of its areas.' : 'Type an area name above to see the way there.') + '</div>';
  if (st.error) return '<div class="m er">' + esc(st.error) + '<br><a href="#" data-a="retry">Try again</a></div>';
  if (!router) return '<div class="m">Loading the map data…</div>';
  const to = router.byName[dest];
  if (!to) return '<div class="m er">“' + esc(dest) + '” is not in the map data.</div>';
  let h = '<div class="ds">Going to <b>' + esc(to.name) + '</b> <span>Lv ' + to.level + '</span></div>';
  if (!here) return h + '<div class="m">Your current area is not in the map data' + (S.loc ? ' (' + esc(S.loc.area) + ')' : '') + '.</div>';
  if (here.name === to.name) return h + '<div class="dn">You have arrived.</div>';
  if (!route || !route.length) return h + '<div class="m er">No known way from <b>' + esc(here.name) + '</b> in this data.</div>';
  const first = route[0];
  const walk = liveWalk(first, st.tile);
  const moves = Math.max(0, Math.round(route.total - first.walk + walk));
  const m = stepMain(router, first);
  h += '<div class="ct"><b>' + route.length + '</b> step' + (route.length === 1 ? '' : 's') + ' · about <b>' + moves + '</b> moves</div>';
  h += '<div class="nx"><div class="in">Next, in ' + esc(first.from) + '</div>' + (m.lead ? '<div class="ld">' + esc(m.lead) + '</div>' : '') +
    '<div class="bg">' + esc(m.main) + '</div>' + (m.sub ? '<div class="sb">' + esc(m.sub) + '</div>' : '') +
    (first.edge.note ? '<div class="nt">' + esc(first.edge.note) + '</div>' : '');
  if (startsOnTile(first)) h += walk === 0 ? '<div class="aw hr">You are on the tile</div>' : '<div class="aw">' + walk + ' move' + (walk === 1 ? '' : 's') + ' away</div>';
  h += '</div>';
  if (route.length > 1) {
    h += '<ol class="rs" start="2">' + route.slice(1).map((s) => '<li><span>' + esc(s.from) + '</span>' + esc(stepShort(router, s)) + '</li>').join('') + '</ol>';
  }
  return h;
}

function draw() {
  const p = document.getElementById('ssh-pf');
  if (!p) return;
  p.hidden = !st.open;
  const b = document.getElementById('ssh-pfbtn');
  if (b) b.classList.toggle('on', st.open);
  p.querySelector('.bd').innerHTML = bodyHtml();
}

function clampPanel(p) {
  const doc = document.documentElement;
  p.style.left = Math.max(0, Math.min(p.offsetLeft, doc.scrollWidth - p.offsetWidth)) + 'px';
  p.style.top = Math.max(0, Math.min(p.offsetTop, doc.scrollHeight - 40)) + 'px';
}

function ensurePanel() {
  let p = document.getElementById('ssh-pf');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ssh-pf';
  p.hidden = true;
  p.innerHTML = '<div class="hd">Path Finder<span class="x" title="Close">&times;</span></div>' +
    '<div class="md"><button type="button" data-m="name">Name</button><button type="button" data-m="level">Level</button></div>' +
    '<div class="sr"><input type="text" autocomplete="off" spellcheck="false"><button type="button" class="cl" title="Clear the destination">Clear</button><ul class="sg" hidden></ul></div>' +
    '<div class="bd"></div>' +
    '<div class="ft"><a target="_blank" rel="noopener">Sigmastorm Path Finder website ↗</a></div>';
  document.body.appendChild(p);
  p.querySelector('.ft a').href = siteUrl();
  const input = p.querySelector('input');
  const setMode = (m) => {
    st.mode = m;
    p.querySelectorAll('.md button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    input.placeholder = m === 'level' ? 'Level, e.g. 120 or 100-120' : 'Where to? e.g. Data Store';
    input.inputMode = m === 'level' ? 'numeric' : 'text';
  };
  setMode('name');
  p.querySelector('.md').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.m === st.mode) return;
    setMode(b.dataset.m);
    input.value = '';
    st.sugg = [];
    drawSugg();
    draw();
  });
  // typing here must not walk the character: the game listens to the keyboard on the whole page
  ['keydown', 'keyup', 'keypress'].forEach((t) => input.addEventListener(t, (e) => e.stopPropagation()));
  input.addEventListener('input', () => suggest(input));
  input.addEventListener('focus', () => suggest(input));
  input.addEventListener('blur', () => setTimeout(() => { st.sugg = []; drawSugg(); }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!st.sugg.length) return;
      e.preventDefault();
      st.active = (st.active + (e.key === 'ArrowDown' ? 1 : st.sugg.length - 1)) % st.sugg.length;
      drawSugg();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = st.sugg.length ? st.sugg[st.active].name : st.mode === 'name' && st.router && st.router.byName[input.value.trim()] ? input.value.trim() : '';
      if (pick) { input.value = pick; st.sugg = []; drawSugg(); setDest(pick); }
    } else if (e.key === 'Escape') {
      st.sugg = [];
      drawSugg();
    }
  });
  // mousedown, so it happens before the input loses focus
  p.querySelector('.sg').addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    input.value = li.dataset.n;
    st.sugg = [];
    drawSugg();
    setDest(li.dataset.n);
  });
  p.querySelector('.cl').addEventListener('click', () => { input.value = ''; st.sugg = []; drawSugg(); setDest(''); });
  p.querySelector('.x').addEventListener('click', closePanel);
  p.querySelector('.bd').addEventListener('click', (e) => {
    if (e.target.closest('[data-a="retry"]')) { e.preventDefault(); loadRouter(); draw(); }
  });
  input.value = st.dest;
  // draggable anywhere on the page, like the Action List
  const pos = store.get('pfpos', null);
  if (pos) {
    p.style.left = pos.x + 'px';
    p.style.top = pos.y + 'px';
  } else {
    const r = S.viewer.getBoundingClientRect();
    p.style.left = Math.max(8, r.left + window.scrollX + 38) + 'px';
    p.style.top = Math.max(8, r.top + window.scrollY + 76) + 'px';
  }
  let drag = null;
  const hd = p.querySelector('.hd');
  hd.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.x')) return;
    drag = { dx: e.pageX - p.offsetLeft, dy: e.pageY - p.offsetTop };
    hd.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  hd.addEventListener('pointermove', (e) => {
    if (!drag) return;
    p.style.left = e.pageX - drag.dx + 'px';
    p.style.top = e.pageY - drag.dy + 'px';
    clampPanel(p);
  });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    try { hd.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
    store.set('pfpos', { x: p.offsetLeft, y: p.offsetTop });
  };
  hd.addEventListener('pointerup', end);
  hd.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => clampPanel(p));
  return p;
}

function openPanel() {
  st.open = true;
  store.set('pfopen', true);
  ensurePanel();
  st.key = null;
  draw();
  if (st.router) pfUpdate();
  else if (!st.loading) loadRouter().then(() => { st.key = null; pfUpdate(); });
}

function closePanel() {
  st.open = false;
  store.set('pfopen', false);
  clearTimeout(st.timer);
  draw();
}

// The button of the map's top row; clicking it opens or closes the panel.
export function initPathfinder() {
  const btn = document.getElementById('ssh-pfbtn');
  if (!btn || btn.sshPf) return;
  btn.sshPf = true;
  btn.addEventListener('click', () => (st.open ? closePanel() : openPanel()));
  st.dest = store.get('pfdest', '');
  if (store.get('pfopen', false)) openPanel();
}
