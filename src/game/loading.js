import { decorateHeader, grabVars, setHeaderFrom } from '../banner.js';
import { SSH } from '../core/constants.js';
import { fetchText, isTravel, navigate } from '../core/net.js';
import { pageParts } from '../core/page.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { parseHtml, sleep } from '../core/util.js';
import { buildWorldPage } from '../layout/worldpage.js';
import { initPathfinder } from '../pathfinder/panel.js';
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
    if (cached && cached.v === 3 && cached.a) {
      S.areas.set(S.loc.area, cached.a);
      return true;
    }
    const html = await fetchText(S.areaUrl);
    const a = parseAreaMap(html);
    if (!a) return false;
    S.areas.set(S.loc.area, a);
    store.set('area:' + S.loc.area, { v: 3, a });
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
  const cur = pageParts();
  const nxt = pageParts(doc);
  if (!cur || !nxt) return false;
  const keep = S.viewer && S.viewer.parentNode ? S.viewer : null;
  if (keep) keep.parentNode.removeChild(keep);
  setHeaderFrom(cur, nxt);
  cur.body.innerHTML = nxt.body.innerHTML;
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
  if (ok) initPathfinder();
  if (!ok) return false;
  if (S.layout === 'modern') buildWorldPage(); // the Modern layout: the page content as divs, with the viewer in it
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

// Puts the text of a world page in place of the current one (header, map, actions). False when it is not a normal world page.
export async function applyHtml(html) {
  grabVars(html);
  const doc = parseHtml(html);
  const info = read(doc);
  const pw = S.viewer && S.viewer.querySelector('#ssh-world');
  const pm = S.viewer && S.viewer.querySelector('#ssh-me');
  const prev = pw && pm ? { t: pw.style.transform, l: pm.style.left, tp: pm.style.top, sy: window.scrollY } : null;
  return !!(info.loc && doc.getElementById('mapDiv') && swapIn(doc) && (await show(info, prev)));
}

const WORLD = 'index.php?cmd=world';

// A move: the game answers the POST with a redirect to the world page, which the browser would follow only after the POST is finished. Here the
// redirect is not followed: PROBE_FIRST ms after sending the move the world page is asked for, and again until one answer shows the
// character on the new tile, so the creatures of the new tile show as soon as the game has moved the character. While the move is being handled the game may answer 409 ("Your location changed. Reload the world."):
// that is not a page and is ignored. A message of the game in the answer of the move itself (not enough energy ...) is the page that is used.
const PROBE_FIRST = 250; // measured (see the move log setting): the game has moved the character 100 to 280 ms after the move was sent; a request sent at 105 ms saw it in half the cases, at 220 to 290 ms in all of them
const PROBE_EVERY = 100;
const PROBES_MAX = 12;

async function travel(url) {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const from = (l) => (l ? l.area + ',' + l.x + ',' + l.y : '');
  const start = from(S.loc);
  let answer = null; // the page the move request itself answered with
  let won = null; // the first world page that shows the new tile
  let over = false;
  let failed = false;
  let postEnd = 0;
  let postKind = '';  const post = fetch(url, { credentials: 'same-origin', redirect: 'manual' })
    .then(async (r) => { postKind = r.type + ' ' + r.status; if (r.type !== 'opaqueredirect' && r.status < 300) answer = await r.text(); })
    .catch(() => { failed = true; postKind = 'failed'; })
    .finally(() => { over = true; postEnd = ms(); });
  const probes = [];
  const probe = () => {
    const p = { n: probes.length + 1, asked: ms(), answered: 0, status: 0, moved: false };
    p.run = fetch(WORLD, { credentials: 'same-origin' })
      .then(async (res) => {
        p.status = res.status;
        const html = res.ok ? await res.text() : null;
        p.answered = ms();
        p.moved = html !== null && from(parseLoc(parseHtml(html))) !== start;
        if (p.moved && won === null) won = html;
      })
      .catch(() => { p.status = 'error'; p.answered = ms(); });
    probes.push(p);
    return p.run;
  };
  // One request at a time (the game answers them one after the other, so more at once only make every one slower): the first after
  // PROBE_EVERY ms, the next one PROBE_EVERY ms after the answer to the one before showed the character still on the old tile.
  await sleep(PROBE_FIRST);
  for (let i = 0; i < PROBES_MAX && won === null && answer === null && !over; i++) {
    await probe();
    if (won === null && answer === null) await sleep(PROBE_EVERY);
  }
  await post; // the answer is only given once the move request is over too: the game refuses a move that comes while the one before is still being handled ("you cannot move more than one tile at a time"), and the next step of a walk starts right after this returns
  if (failed && answer === null) throw new Error('move failed');
  let html = answer !== null ? answer : won;
  if (html === null) html = await fetchText(WORLD); // the move is over and no request has shown the new tile: whatever the world page says now
  if (S.cfg.moveLog) {
    const end = ms();
    Promise.allSettled(probes.map((p) => p.run)).then(() => {
      const hit = probes.filter((p) => p.moved).sort((a, b) => a.asked - b.asked)[0];
      console.log('[Sigmastorm Helper] move timing (ms from sending the move): the move request finished at ' + postEnd + ' (' + postKind + '); ' +
        (hit ? 'the first world request that showed the new tile was sent at ' + hit.asked + ' (#' + hit.n + ', answered at ' + hit.answered + ', took ' + (hit.answered - hit.asked) + ')' : 'no world request showed the new tile in time') +
        '; the page was used at ' + end + '; ' + probes.length + ' world requests');
      console.table(probes.map((p) => ({ '#': p.n, sent: p.asked, answered: p.answered, took: p.answered - p.asked, status: p.status, 'new tile': p.moved })));
    });
  }
  return html;
}

// Loads a world page in the background and swaps the map in place. `init` is extra fetch options (a POST for stairways) and
// `fallback(html)` what to do when the answer is not a normal world page (default: let the browser open the address); html is
// the answer, empty when the request itself failed.
export async function go(href, init, fallback) {
  if (S.busy || S.pending) return;
  S.busy = true;
  S.viewer && S.viewer.classList.add('ssh-busy');
  S.results = [];
  renderActions('Moving...');
  let moved = false; // a move was sent in the background (see travel)
  try {
    const url = new URL(href, location.href).href;
    moved = !init && isTravel(new URL(url));
    const html = moved ? await travel(url) : await (await fetch(url, Object.assign({ credentials: 'same-origin' }, init))).text();
    if (!(await applyHtml(html))) {
      if (fallback) fallback(html); else navigate(moved ? WORLD : url); // not a normal world page: let the browser handle it (a move was sent already: not again)
      return;
    }
  } catch (e) {
    if (fallback) fallback(); else navigate(moved ? WORLD : href);
  } finally {
    S.busy = false;
    S.viewer && S.viewer.classList.remove('ssh-busy');
  }
}

SSH.go = go;
