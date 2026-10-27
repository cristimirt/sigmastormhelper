import { TILE } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';

S.fp = !!store.get('fp', false);

function getTrail() {
  let t = store.get('trail', null);
  if (!t || t.area !== S.loc.area || !Array.isArray(t.pts)) t = { area: S.loc.area, pts: [] }; // new map: start over
  return t;
}

export function renderTrail() {
  const v = S.viewer;
  const btn = v.querySelector('#ssh-fpbtn');
  btn.classList.toggle('on', S.fp);
  const box = v.querySelector('#ssh-fp');
  if (!box) return;
  let t = getTrail();
  if (S.fp && !t.pts.some((p) => p[0] === S.loc.x && p[1] === S.loc.y)) t.pts.push([S.loc.x, S.loc.y]);
  if (!S.fp) t.pts = [];
  store.set('trail', t);
  const draw = (skipHere) => {
    box.innerHTML = t.pts
      .filter((p) => !(skipHere && p[0] === S.loc.x && p[1] === S.loc.y))
      .map((p) => '<div class="fp" style="left:' + (p[0] * TILE + TILE / 2 - 6) + 'px;top:' + (p[1] * TILE + TILE / 2 - 6) + 'px"></div>')
      .join('');
  };
  clearTimeout(S.fpTimer);
  if (S.slide) {
    // The player marker is still sliding to the new tile: show its footprint once it arrives.
    S.slide = false;
    draw(true);
    S.fpTimer = setTimeout(() => draw(false), 300);
  } else {
    draw(false);
  }
}
