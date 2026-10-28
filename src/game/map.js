import { TILE, ZOOM_MAX, ZOOM_MIN } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { renderTrail } from './footprints.js';

const KEEP = 80; // px of the map that always stay in the window when it is dragged

export function renderWorld() {
  const v = S.viewer;
  const area = S.areas.get(S.loc.area);
  const w = v.querySelector('#ssh-world');
  if (!area) return;
  if (w.getAttribute('data-area') !== S.loc.area) {
    w.setAttribute('data-area', S.loc.area);
    w.style.width = area.cols * TILE + 'px';
    w.style.height = area.rows * TILE + 'px';
    let h = fillerTiles(v, area);
    area.cells.forEach((c, i) => {
      const x = i % area.cols;
      const y = Math.floor(i / area.cols);
      h += '<img class="t" draggable="false" style="left:' + x * TILE + 'px;top:' + y * TILE + 'px" src="' + c.bg + '"' +
        (c.tip ? ' data-tip="' + i + '"' : '') + '>';
    });
    h += '<div id="ssh-fp"></div>';
    h += '<svg id="ssh-path" width="' + area.cols * TILE + '" height="' + area.rows * TILE + '"></svg>';
    h += '<div id="ssh-me"><img src="http://cdn.sigmastorm.com/skin/player_tile.gif" alt=""></div>';
    w.innerHTML = h;
  }
  renderPad();
  renderTrail();
  const me = w.querySelector('#ssh-me');
  me.style.left = S.loc.x * TILE + 'px';
  me.style.top = S.loc.y * TILE + 'px';
  const lc = v.querySelector('#ssh-loc');
  lc.textContent = S.loc.area + ' - (' + S.loc.x + ', ' + S.loc.y + ')';
  // The game's own title bar carries the area's safety colour (green = no PvP, red = PvP)
  if (S.locBg) lc.style.cssText = 'background:#000 url("' + S.locBg + '") no-repeat 0 0;height:22px;line-height:16px;padding:3px 12px 0 14px;box-sizing:border-box;';
  const wk = v.querySelector('#ssh-wiki');
  if (wk) {
    wk.href = 'https://sigmastorm2.fandom.com/wiki/' + encodeURI(S.loc.area.replace(/\s+/g, '_'));
    wk.style.left = (lc.offsetLeft + lc.offsetWidth + 4) + 'px';
  }
  applyZoom();
}

// Direction pad: 8 buttons on the frame of the map, same directions as the game's arrows.
const PAD = [
  ['q', -1, -1, '&#8598;', 'left:6px;top:6px'], ['w', 0, -1, '&#8593;', 'left:calc(50% - 13px);top:6px'], ['e', 1, -1, '&#8599;', 'right:6px;top:6px'],
  ['a', -1, 0, '&#8592;', 'left:6px;top:calc(50% - 13px)'], ['d', 1, 0, '&#8594;', 'right:6px;top:calc(50% - 13px)'],
  ['z', -1, 1, '&#8601;', 'left:6px;bottom:6px'], ['x', 0, 1, '&#8595;', 'left:calc(50% - 13px);bottom:6px'], ['c', 1, 1, '&#8600;', 'right:6px;bottom:6px'],
];

export const moveFor = (dx, dy) => S.moves.find((q) => q.x === S.loc.x + dx && q.y === S.loc.y + dy);

function renderPad() {
  const pad = S.viewer.querySelector('#ssh-pad');
  if (!pad.firstChild) {
    pad.innerHTML = PAD.map((p) => '<button type="button" data-dx="' + p[1] + '" data-dy="' + p[2] + '" style="' + p[4] + '">' + p[3] + '</button>').join('');
  }
  pad.querySelectorAll('button').forEach((b) => {
    const m = moveFor(+b.getAttribute('data-dx'), +b.getAttribute('data-dy'));
    b.disabled = !m || !m.enabled;
    const key = PAD.find((p) => p[1] === +b.getAttribute('data-dx') && p[2] === +b.getAttribute('data-dy'))[0].toUpperCase();
    b.title = m ? m.title.replace(/\s*\[Shortcut Key:.*$/i, '') + '  [' + key + ']' : '';
  });
}

// Outside the map the view is filled with the map's own wall/edge tiles (the most common ones on its border).
function wallPool(area) {
  if (area.wall) return area.wall;
  const cnt = new Map();
  const add = (c) => { const k = area.cells[c] && area.cells[c].bg; if (k) cnt.set(k, (cnt.get(k) || 0) + 1); };
  for (let x = 0; x < area.cols; x++) { add(x); add((area.rows - 1) * area.cols + x); }
  for (let y = 0; y < area.rows; y++) { add(y * area.cols); add(y * area.cols + area.cols - 1); }
  const max = Math.max(0, ...cnt.values());
  area.wall = [...cnt.entries()].filter((e) => e[1] >= max * 0.25).sort((a, b) => b[1] - a[1]).slice(0, 6).map((e) => e[0]);
  return area.wall;
}

// The filler is made of ordinary tiles in the same layer as the map, so the whole thing moves and zooms as one. A ring of
// tiles around the map is enough for the furthest the view can reach beyond an edge (the map can be dragged until 80px of
// it are left in the window, at the smallest zoom).
function fillerTiles(v, area) {
  const pool = wallPool(area);
  if (!pool.length) return '';
  const pad = Math.ceil((Math.max(v.clientWidth, v.clientHeight, 500) - KEEP) / (TILE * ZOOM_MIN));
  let h = '';
  for (let j = -pad; j < area.rows + pad; j++) {
    for (let i = -pad; i < area.cols + pad; i++) {
      if (i >= 0 && i < area.cols && j >= 0 && j < area.rows) continue;
      const u = pool[(((i * 73856093) ^ (j * 19349663)) >>> 0) % pool.length];
      h += '<img class="f" draggable="false" style="left:' + i * TILE + 'px;top:' + j * TILE + 'px" src="' + u + '">';
    }
  }
  return h;
}

export function applyZoom() {
  const v = S.viewer;
  if (!v || !S.loc) return;
  const w = v.querySelector('#ssh-world');
  const z = S.zoom;
  const area = S.areas.get(S.loc.area);
  const cw = v.clientWidth;
  const ch = v.clientHeight;
  const ww = area ? area.cols * TILE * z : 0;
  const wh = area ? area.rows * TILE * z : 0;
  let tx = cw / 2 - (S.loc.x + 0.5) * TILE * z;
  let ty = ch / 2 - (S.loc.y + 0.5) * TILE * z;
  const bx = tx;
  const by = ty;
  // The player stays in the middle; dragging moves the view, but never so far that the map leaves the window.
  tx = Math.min(cw - KEEP, Math.max(KEEP - ww, tx + S.pan.x));
  S.pan.x = tx - bx;
  ty = Math.min(ch - KEEP, Math.max(KEEP - wh, ty + S.pan.y));
  S.pan.y = ty - by;
  v.classList.add('ssh-pannable');
  S.tx = tx;
  S.ty = ty;
  w.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')';
  v.querySelector('#ssh-zoom span').textContent = Math.round(z * 100) + '%';
}

export function setZoom(z) {
  S.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  store.set('zoom', S.zoom);
  // The canvas filler redraws instantly, so the world must not animate while zooming
  // (otherwise the two disagree for the length of the transition).
  const v = S.viewer;
  if (v) { v.classList.add('ssh-zooming'); void v.offsetWidth; }
  applyZoom();
  if (v) { void v.offsetWidth; clearTimeout(setZoom.t); setZoom.t = setTimeout(() => v.classList.remove('ssh-zooming'), 60); }
}
