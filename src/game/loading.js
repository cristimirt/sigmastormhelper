import { decorateHeader, grabVars } from '../banner.js';
import { SSH } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { renderActions } from './actionlist.js';
import { renderWorld } from './map.js';
import { parseAreaMap, parseAreaUrl, parseLoc, parseMoves } from './parsing.js';
import { learnFrom } from './pathfinding.js';
import { attachViewer } from './viewer.js';

async function ensureArea() {
  if (S.areas.has(S.loc.area)) return true;
  if (!S.areaUrl) return false;
  try {
    const cached = store.get('area:' + S.loc.area, null);
    if (cached && cached.v === 1 && cached.a) {
      S.areas.set(S.loc.area, cached.a);
      return true;
    }
    const html = await (await fetch(S.areaUrl, { credentials: 'same-origin' })).text();
    const a = parseAreaMap(html);
    if (!a) return false;
    S.areas.set(S.loc.area, a);
    store.set('area:' + S.loc.area, { v: 1, a });
    return true;
  } catch (e) {
    return false;
  }
}

export function read(doc) {
  const loc = parseLoc(doc);
  const td = doc.querySelector('td[background*="coord_bg"]');
  const bg = td ? (td.getAttribute('background') || '').replace(/^http:/, 'https:') : '';
  return { loc, moves: loc ? parseMoves(doc, loc) : [], areaUrl: parseAreaUrl(doc), bg };
}

// Copies the parts of a freshly fetched page that change (header stats and the centre column).
export function swapIn(doc) {
  const cur = document.getElementById('mainContentDiv');
  const nxt = doc.getElementById('mainContentDiv');
  if (!cur || !nxt || cur.rows.length < 2 || nxt.rows.length < 2) return false;
  const keep = S.viewer && S.viewer.parentNode ? S.viewer : null;
  if (keep) keep.parentNode.removeChild(keep);
  cur.rows[0].cells[0].innerHTML = nxt.rows[0].cells[0].innerHTML;
  cur.rows[1].cells[1].innerHTML = nxt.rows[1].cells[1].innerHTML;
  decorateHeader();
  return true;
}

export async function show(info, prev) {
  S.loc = info.loc;
  S.locBg = info.bg;
  S.pan = { x: 0, y: 0 };
  S.moves = info.moves;
  if (info.areaUrl) S.areaUrl = info.areaUrl;
  const ok = (await ensureArea()) && attachViewer();
  if (!ok) return false;
  learnFrom();
  if (prev) {
    // The viewer was re-inserted, which resets CSS transitions: put it back where it was,
    // force a reflow, then let renderWorld() move it so the map slides.
    const w = S.viewer.querySelector('#ssh-world');
    const me = S.viewer.querySelector('#ssh-me');
    if (w && me && prev.t) {
      w.style.transform = prev.t;
      me.style.left = prev.l;
      me.style.top = prev.tp;
      void w.offsetWidth;
    }
    if (prev.sy !== undefined) window.scrollTo(window.scrollX, prev.sy);
  }
  S.slide = !!(prev && prev.t) && S.cfg.slide;
  renderWorld();
  renderActions();
  return true;
}

// Loads a world page in the background and swaps the map in place. `init` is extra fetch options (a POST for stairways) and
// `fallback` what to do when the answer is not a normal world page (default: let the browser open the address).
export async function go(href, init, fallback) {
  if (S.busy || S.pending) return;
  S.busy = true;
  S.viewer && S.viewer.classList.add('ssh-busy');
  S.results = [];
  renderActions('Moving...');
  try {
    const url = new URL(href, location.href).href;
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, init));
    const html = await res.text();
    grabVars(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const info = read(doc);
    const pw = S.viewer && S.viewer.querySelector('#ssh-world');
    const pm = S.viewer && S.viewer.querySelector('#ssh-me');
    const prev = pw && pm ? { t: pw.style.transform, l: pm.style.left, tp: pm.style.top, sy: window.scrollY } : null;
    if (!info.loc || !doc.getElementById('mapDiv') || !swapIn(doc) || !(await show(info, prev))) {
      if (fallback) fallback(); else location.href = url; // not a normal world page: let the browser handle it
      return;
    }
  } catch (e) {
    if (fallback) fallback(); else location.href = href;
  } finally {
    S.busy = false;
    S.viewer && S.viewer.classList.remove('ssh-busy');
  }
}

SSH.go = go;
