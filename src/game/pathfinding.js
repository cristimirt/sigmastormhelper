import { TILE } from '../core/constants.js';
import { DATA } from '../core/data.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { applyHtml, go, read } from './loading.js';
import { renderWorld } from './map.js';

const tileIdAt = (area, x, y) => {
  const a = S.areas.get(area);
  const c = a && x >= 0 && y >= 0 && x < a.cols && y < a.rows ? a.cells[y * a.cols + x] : null;
  const m = c ? (c.bg || '').match(/([^\/]+)\.gif/) : null;
  return m ? m[1] : '';
};

// 'w' walkable, 'b' blocked, '' unknown
function tileState(area, x, y) {
  const o = S.learn.over[area] && S.learn.over[area][x + ',' + y];
  if (o) return o;
  const id = tileIdAt(area, x, y);
  if (!id) return 'b';
  return S.learn.tiles[id] || DATA.tiles[id] || (/^\d+_\d+$/.test(id) ? '' : 'w');
}

// Learn from the game's own arrows: a straight move that is allowed (or not) tells us about the tile it leads to,
// and an allowed diagonal move means its target is walkable.
export function learnFrom() {
  if (!S.loc || !S.moves.length || !S.moves.some((m) => m.enabled)) return;
  const area = S.loc.area;
  let changed = false;
  S.moves.forEach((m) => {
    const dx = m.x - S.loc.x;
    const dy = m.y - S.loc.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return;
    const diag = dx !== 0 && dy !== 0;
    if (diag && !m.enabled) return; // a refused diagonal says nothing about the tile itself
    const seen = m.enabled ? 'w' : 'b';
    const id = tileIdAt(area, m.x, m.y);
    if (!id) return;
    const known = S.learn.tiles[id] || DATA.tiles[id] || (/^\d+_\d+$/.test(id) ? '' : 'w');
    const key = m.x + ',' + m.y;
    const ov = S.learn.over[area] || (S.learn.over[area] = {});
    if (!known) { S.learn.tiles[id] = seen; changed = true; } else if (known !== seen) { if (ov[key] !== seen) { ov[key] = seen; changed = true; } } else if (ov[key]) { delete ov[key]; changed = true; }
  });
  if (changed) store.set('learn', S.learn);
}

// Shortest route over walkable tiles (8 directions; a diagonal step needs one of the two tiles beside it to be walkable).
// Unknown tiles are allowed but cost a little more, so a short way through one beats a long way round over known tiles.
export function findPath(area, sx, sy, tx, ty) {
  const a = S.areas.get(area);
  if (!a || (sx === tx && sy === ty)) return null;
  {
    const okAt = (x, y) => {
      if (x < 0 || y < 0 || x >= a.cols || y >= a.rows) return false;
      const t = tileState(area, x, y);
      return t === 'w' || t === '';
    };
    if (!okAt(tx, ty)) return null;
    const dist = new Map([[sx + ',' + sy, 0]]);
    const prev = new Map();
    const open = [[0, sx, sy]];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [d, x, y] = open.splice(bi, 1)[0];
      if (x === tx && y === ty) {
        const path = [[x, y]];
        let k = x + ',' + y;
        while (prev.has(k)) { const p = prev.get(k); path.unshift(p); k = p[0] + ',' + p[1]; }
        return path;
      }
      if (d > dist.get(x + ',' + y)) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!okAt(nx, ny)) continue;
          if (dx && dy && !okAt(x + dx, y) && !okAt(x, y + dy)) continue;
          const nd = d + (dx && dy ? 1.0001 : 1) + (tileState(area, nx, ny) === '' ? 0.4 : 0);
          const nk = nx + ',' + ny;
          if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, [x, y]); open.push([nd, nx, ny]); }
        }
      }
    }
  }
  return null;
}

export function drawPath(path) {
  const svg = S.viewer && S.viewer.querySelector('#ssh-path');
  const info = S.viewer && S.viewer.querySelector('#ssh-pinfo');
  if (!svg) return;
  if (!path || path.length < 2) {
    svg.innerHTML = '';
    if (info) info.style.display = 'none';
    return;
  }
  const br = (x, y, w, l) => 'M' + x + ',' + (y + l) + 'V' + y + 'H' + (x + l) + 'M' + (x + w - l) + ',' + y + 'H' + (x + w) + 'V' + (y + l) + 'M' + (x + w) + ',' + (y + w - l) + 'V' + (y + w) + 'H' + (x + w - l) + 'M' + (x + l) + ',' + (y + w) + 'H' + x + 'V' + (y + w - l);
  const last = path[path.length - 1];
  // The look of Fallen Sword's route: soft green dots (3 px, 9 px apart) over a faint dark shadow of the same dots, and the
  // same two layers for the corners round the last tile.
  // Fallen Sword draws its route inside the map's own scaled drawing, on 40 px tiles: dots 3 px wide (a 4.5 px shadow under them),
  // 9 px apart, starting at the middle of the last tile and going back to the player; corners 8 px long, 4 px in from the tile's
  // edge, 2 px wide (3.5 px shadow). Here it is the same in proportion to our 65 px tile, scaled with the map.
  const k = TILE / 40;
  const dot = 3 * k;
  const gap = 9 * k;
  const shadow = 1.5 * k;
  const ns = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const back = path.map((p) => (p[0] * TILE + TILE / 2) + ',' + (p[1] * TILE + TILE / 2)).reverse().join(' ');
  const corners = br(last[0] * TILE + 4 * k, last[1] * TILE + 4 * k, TILE - 8 * k, 8 * k);
  svg.innerHTML = '<polyline points="' + back + '" ' + ns + ' stroke="rgba(0,0,0,0.3)" stroke-width="' + (dot + shadow) + '" stroke-dasharray="0.001 ' + gap + '"/>' +
    '<polyline points="' + back + '" ' + ns + ' stroke="rgba(120,230,120,0.9)" stroke-width="' + dot + '" stroke-dasharray="0.001 ' + gap + '"/>' +
    '<path d="' + corners + '" ' + ns + ' stroke="rgba(0,0,0,0.3)" stroke-width="' + (2 * k + shadow) + '"/>' +
    '<path d="' + corners + '" ' + ns + ' stroke="rgba(120,230,120,0.9)" stroke-width="' + 2 * k + '"/>';
  if (info) {
    info.textContent = 'Go to (' + last[0] + ', ' + last[1] + ') - ' + (path.length - 1) + ' steps';
    info.style.display = 'block';
  }
}

export function tileUnderMouse(e) {
  const v = S.viewer;
  const area = S.loc && S.areas.get(S.loc.area);
  if (!v || !area) return null;
  const r = v.getBoundingClientRect();
  const px = (e.clientX - r.left - v.clientLeft - S.tx) / (TILE * S.zoom);
  const py = (e.clientY - r.top - v.clientTop - S.ty) / (TILE * S.zoom);
  const x = Math.floor(px);
  const y = Math.floor(py);
  return x >= 0 && y >= 0 && x < area.cols && y < area.rows ? [x, y] : null;
}

S.hover = null;

S.walking = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function stopWalk(msg) {
  S.cancel = true;
  if (msg) {
    const info = S.viewer && S.viewer.querySelector('#ssh-pinfo');
    if (info) { info.textContent = msg; info.style.display = 'block'; }
  }
}

// Fast walk: the steps the energy pays for (1 for a straight step, 2 for a diagonal one) are sent one after another at the pace of Fallen Sword's walking,
// without waiting for each page; the map shows each step as it is sent and the energy goes down with it. Only when the last
// answer is in (or one is wrong) is the page updated, once.
// Fallen Sword's character takes 250 ms for a straight step and 250 x 1.414 ms for a diagonal one; the steps are sent at that pace
// (the map slides the same time), so the character can be seen walking.
const STEP_MS = 250;
const stepMs = (a, b) => Math.round(a[0] !== b[0] && a[1] !== b[1] ? STEP_MS * 1.414 : STEP_MS);
const stepCost = (a, b) => (a[0] !== b[0] && a[1] !== b[1] ? 2 : 1);
const energyEl = () => document.getElementById('staminaCurrent');
const energyNow = () => {
  const e = energyEl();
  const n = e ? parseInt(e.textContent.replace(/\D/g, ''), 10) : NaN;
  return Number.isNaN(n) ? null : n;
};
const moveHref = (x, y) => {
  const tpl = (S.moves.find((m) => m.href) || {}).href;
  return tpl ? new URL(tpl.replace(/([?&;]x=)\d+/, '$1' + x).replace(/([?&;]y=)\d+/, '$1' + y), location.href).href : null;
};

// Sends the steps of seg (seg[0] is where we stand) and puts the final page in. Returns true when every step was answered by the
// page of the tile it went to.
async function sendSteps(seg) {
  const v = S.viewer;
  v && v.classList.add('ssh-fast');
  const results = [];
  const reqs = [];
  let bad = false;
  let energy = energyNow();
  const area = S.loc.area;
  for (let i = 1; i < seg.length && !bad && !S.cancel; i++) {
    const [x, y] = seg[i];
    const href = moveHref(x, y);
    if (!href) break;
    const ms = stepMs(seg[i - 1], seg[i]);
    v && v.style.setProperty('--ssh-step', ms + 'ms');
    S.loc = Object.assign({}, S.loc, { x, y });
    renderWorld();
    drawPath(seg.slice(i - 1));
    if (energy !== null) {
      energy -= stepCost(seg[i - 1], seg[i]);
      const el = energyEl();
      if (el) el.textContent = String(Math.max(0, energy));
    }
    const k = i - 1;
    reqs.push(fetch(href, { credentials: 'same-origin' }).then((r) => r.text()).then((html) => {
      const loc = read(new DOMParser().parseFromString(html, 'text/html')).loc;
      const ok = !!loc && loc.area === area && loc.x === x && loc.y === y;
      results[k] = { html, ok };
      if (!ok) bad = true;
    }).catch(() => { results[k] = { html: '', ok: false }; bad = true; }));
    await sleep(ms);
  }
  await Promise.all(reqs);
  const sent = reqs.length;
  let html = sent && results.length === sent && results.every((r) => r && r.ok) ? results[sent - 1].html : '';
  try {
    if (!html) html = await (await fetch('index.php?cmd=world', { credentials: 'same-origin' })).text(); // where are we really?
    if (!(await applyHtml(html))) location.href = 'index.php?cmd=world';
  } catch (e) { location.href = 'index.php?cmd=world'; }
  v && v.classList.remove('ssh-fast');
  return !bad && sent === seg.length - 1;
}

async function fastWalk(tx, ty) {
  let replans = 0;
  let path = findPath(S.loc.area, S.loc.x, S.loc.y, tx, ty);
  while (path && !S.cancel) {
    const energy = energyNow();
    let left = energy === null ? Infinity : energy;
    let n = 0;
    for (let i = 1; i < path.length; i++) {
      const c = stepCost(path[i - 1], path[i]);
      if (c > left) break;
      left -= c;
      n++;
    }
    if (!n) { stopWalk('Not enough energy'); return; }
    const seg = path.slice(0, n + 1);
    const ok = await sendSteps(seg);
    if (S.cancel || (S.loc.x === tx && S.loc.y === ty)) return;
    if (ok && n < path.length - 1) { stopWalk('Out of energy: ' + (path.length - 1 - n) + ' steps left'); return; }
    if (++replans > 3) { stopWalk('Route blocked'); return; }
    path = findPath(S.loc.area, S.loc.x, S.loc.y, tx, ty); // a step was refused: the page now tells us about that tile
  }
  if (!path) stopWalk('No route found');
}

// Follow a route one step at a time using the game's own move links. If a step turns out to be blocked, learn from it and re-plan.
export async function walkTo(tx, ty) {
  if (S.walking || S.busy || S.pending) return;
  S.walking = true;
  S.walkStart = Date.now();
  S.cancel = false;
  let replans = 0;
  try {
    if (S.cfg.fastWalk) { await fastWalk(tx, ty); return; }
    let path = findPath(S.loc.area, S.loc.x, S.loc.y, tx, ty);
    let i = 1;
    while (path && i < path.length && !S.cancel) {
      drawPath(path.slice(i - 1));
      const [x, y] = path[i];
      const m = S.moves.find((q) => q.x === x && q.y === y);
      if (!m || !m.enabled) {
        if (++replans > 6) { stopWalk('Route blocked'); break; }
        path = findPath(S.loc.area, S.loc.x, S.loc.y, tx, ty);
        i = 1;
        continue;
      }
      const before = S.loc.x + ',' + S.loc.y;
      await go(m.href);
      if (!S.loc || S.loc.x !== x || S.loc.y !== y || before === x + ',' + y) { stopWalk('Stopped'); break; }
      if (S.loc.x === tx && S.loc.y === ty) break;
      if (S.cfg.stopOnCreatures && document.querySelector('#ssh-al a[data-atk]')) { stopWalk('Stopped: creatures here'); break; }
      await sleep(Math.max(100, +S.cfg.stepDelay || 320));
      i++;
    }
    if (!path) stopWalk('No route found');
  } finally {
    S.walking = false;
    S.hover = null;
    if (!S.cancel || !S.viewer) drawPath(null);
    else setTimeout(() => { if (!S.walking) drawPath(null); }, 1800);
  }
}
