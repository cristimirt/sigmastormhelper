import { TILE } from '../core/constants.js';
import { DATA } from '../core/data.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { go } from './loading.js';

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
  const pts = path.map((p) => (p[0] * TILE + TILE / 2) + ',' + (p[1] * TILE + TILE / 2)).join(' ');
  const last = path[path.length - 1];
  svg.innerHTML = '<polyline points="' + pts + '" fill="none" stroke="#22ee22" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 8" style="vector-effect:non-scaling-stroke"/>' +
    '<path d="' + br(last[0] * TILE + 3, last[1] * TILE + 3, TILE - 6, 16) + '" fill="none" stroke="#22ee22" stroke-width="3" stroke-linecap="square" style="vector-effect:non-scaling-stroke"/>';
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

// Follow a route one step at a time using the game's own move links. If a step turns out to be blocked, learn from it and re-plan.
export async function walkTo(tx, ty) {
  if (S.walking || S.busy || S.pending) return;
  S.walking = true;
  S.walkStart = Date.now();
  S.cancel = false;
  let replans = 0;
  try {
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
