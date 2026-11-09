// Marks the stairs of the area on the map: a green stairs picture on the tile, or a red "no entry" one when the area it leads to is for a
// higher level than the character. The target of a stairs tile comes from the route data of the Sigmastorm Path Finder website;
// the character's level from the character page. The pictures are under the player's marker, which stays on top.
import { TILE } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { getRouter } from '../pathfinder/panel.js';

const svg = (body) => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 65 65">' + body + '</svg>') + '")';
const GO = svg('<ellipse cx="32.5" cy="40" rx="23" ry="9" fill="#000" opacity=".55"/>' +
  '<path d="M23 42V28a9.5 9.5 0 0 1 19 0v14" fill="none" stroke="#3fbf5a" stroke-width="3.2" stroke-linecap="round"/>' +
  '<path d="M32.5 47V32m-7 7 7-8 7 8" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>' +
  '<path d="M32.5 47V32m-7 7 7-8 7 8" fill="none" stroke="#3fbf5a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>');
const NO = svg('<circle cx="32.5" cy="32.5" r="18" fill="#000" opacity=".55"/>' +
  '<circle cx="32.5" cy="32.5" r="15" fill="none" stroke="#ff2a2a" stroke-width="4.5"/>' +
  '<path d="M22 43 43 22" stroke="#ff2a2a" stroke-width="4.5" stroke-linecap="round"/>');

S.plevel = store.get('plevel', 0); // the character's level, from the character page
let asked = false;
let drawn = '';

// "Level" and the number in the next cell of the character page
export function setLevelFrom(html) {
  const m = String(html).match(/Level:?(?:&nbsp;|\s)*(?:<\/font>)?<\/td>\s*<td[^>]*>\s*(\d+)/i);
  if (!m || +m[1] === S.plevel) return false;
  S.plevel = +m[1];
  store.set('plevel', S.plevel);
  return true;
}

// The stairs tiles are the ones whose picture is in the game's "stairways" folder; where they lead (and so how high a level it asks
// for) is in the route data, by tile.
function marks(router, area, cells, cols) {
  const to = {};
  if (area) {
    (area.stairs || []).forEach((s) => { to[s.x + ',' + s.y] = s.to; });
    (area.worldExits || []).forEach((e) => { if (to[e.x + ',' + e.y] == null) to[e.x + ',' + e.y] = e.world; });
  }
  const out = [];
  cells.forEach((c, i) => {
    if (!c.bg || !/stairways\//.test(c.bg)) return;
    const x = i % cols;
    const y = Math.floor(i / cols);
    const dest = router && router.byName[to[x + ',' + y]];
    out.push({ x, y, lock: !!(dest && S.plevel && dest.level > S.plevel) });
  });
  return out;
}

export async function renderStairs() {
  const box = S.viewer && S.viewer.querySelector('#ssh-st');
  const a = S.loc && S.areas.get(S.loc.area);
  if (!box || !a) return;
  if (!S.cfg.stairMarks) { box.textContent = ''; drawn = ''; return; }
  if (!S.plevel && !asked) {
    asked = true;
    try { if (setLevelFrom(await (await fetch('index.php?cmd=profile', { credentials: 'same-origin' })).text())) drawn = ''; } catch (e) { /* no level: nothing is locked */ }
  }
  const router = await getRouter();
  const key = S.loc.area + '|' + S.plevel + '|' + (router ? 1 : 0);
  if (key === drawn && box.firstChild) return;
  drawn = key;
  box.textContent = '';
  marks(router, router && router.byName[S.loc.area], a.cells, a.cols).forEach((m) => {
    const d = document.createElement('div');
    d.className = 'st' + (m.lock ? ' lk' : '');
    d.style.cssText = 'left:' + m.x * TILE + 'px;top:' + m.y * TILE + 'px';
    box.appendChild(d);
  });
}

export const stairCss = '#ssh-st{position:absolute;left:0;top:0;pointer-events:none}#ssh-st .st{position:absolute;width:' + TILE + 'px;height:' + TILE + 'px;background:' + GO + ' center/100% 100% no-repeat;filter:drop-shadow(0 0 2px #3fbf5a);opacity:.85}' +
  '#ssh-st .st.lk{background-image:' + NO + ';filter:drop-shadow(0 0 3px #ff2a2a)}';
