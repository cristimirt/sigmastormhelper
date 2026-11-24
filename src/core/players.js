import { fetchDoc, fetchText } from './net.js';
import { store } from './storage.js';

// The helper's memory of players: number <-> name, kept between visits (`players` in the storage: { number: name }). It grows from what the
// pages show (every link to a player's page with the name as its text, a player's own page), and when a name or a number is not known it is asked
// for: a number from the player's page, a name from the faction's member list and then from Locate Player. Nothing is asked twice in a row.
const byId = new Map();
const byName = new Map(); // lower case name -> number
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  const old = store.get('qbIds', {}); // what an earlier version kept (name in lower case -> number)
  Object.entries(store.get('players', {})).forEach(([id, n]) => { byId.set(id, n); byName.set(n.toLowerCase(), id); });
  Object.entries(old).forEach(([n, id]) => { if (!byName.has(n)) byName.set(n, id); }); // those names are all lower case: they give numbers, not names
}

function save() {
  store.set('players', Object.fromEntries(byId));
}

export function remember(id, name) {
  load();
  id = String(id);
  name = (name || '').trim();
  if (!id || !/[a-z]/i.test(name) || /\s/.test(name) || byId.get(id) === name) return; // a name has letters (a link "0" is a counter)
  const prev = byId.get(id);
  if (prev && byName.get(prev.toLowerCase()) === id) byName.delete(prev.toLowerCase()); // renamed
  byId.set(id, name);
  byName.set(name.toLowerCase(), id);
  save();
}

// The player links of a page: "Name" with a link to cmd=profile&player_id=N; and a player's own page.
export function harvest(root = document) {
  load();
  let n = 0;
  root.querySelectorAll('a[href*="player_id="]').forEach((a) => {
    const m = (a.getAttribute('href') || '').match(/[?&]player_id=(\d+)/);
    const t = a.textContent.trim();
    if (m && t && !/\s/.test(t) && !/^\W|^player$/i.test(t)) { if (byId.get(m[1]) !== t) n++; remember(m[1], t); }
  });
  if (root === document) { // a player's own page: the number is in the address, the name at the top
    const id = (location.search.match(/[?&]cmd=profile(?:&|$)/) && location.search.match(/[?&]player_id=(\d+)/) || [])[1];
    const b = id && [...document.querySelectorAll('b')].map((e) => e.textContent.match(/^\s*=\s*([^=]+?)\s*=\s*$/)).find(Boolean);
    if (b) remember(id, b[1]);
  }
  return n;
}

const nameFromProfile = (html) => (html.match(/<b>\s*=\s*([^=<]+?)\s*=\s*<\/b>/) || [])[1] || null; // "= Name =" at the top of a player's page

export const knownName = (id) => { load(); return byId.get(String(id)) || null; };
export const knownId = (name) => { load(); return byName.get(String(name).toLowerCase()) || null; };

const asking = new Map();
export function nameFor(id) {
  id = String(id);
  const k = knownName(id);
  if (k) return Promise.resolve(k);
  if (!asking.has(id)) {
    asking.set(id, fetchText('index.php?cmd=profile&player_id=' + id).then((html) => {
      const n = nameFromProfile(html);
      if (n) remember(id, n);
      return n;
    }).catch(() => null));
  }
  return asking.get(id);
}

let listAt = 0;
const miss = new Map(); // a name that was not found: not asked again for a minute
export async function idFor(name) {
  load();
  const k = name.toLowerCase();
  if (byName.has(k)) return byName.get(k);
  if (Date.now() - listAt > 300000) { // the faction's member list: every member with a link to the page
    listAt = Date.now();
    try { harvest(await fetchDoc('index.php?cmd=guild&subcmd=manage')); } catch (e) { /* the next look tries again */ }
    if (byName.has(k)) return byName.get(k);
  }
  if (miss.has(k) && Date.now() - miss.get(k) < 60000) return null;
  // anyone else: Locate Player (a POST that the game answers with a redirect to the player's page; the address has the number)
  try {
    const res = await fetch('index.php', { method: 'POST', credentials: 'same-origin', body: new URLSearchParams({ cmd: 'findplayer', subcmd: 'dofindplayer', target_username: name }) });
    const m = res.url.match(/[?&]player_id=(\d+)/);
    if (m) { remember(m[1], name); return m[1]; }
  } catch (e) { /* no answer */ }
  miss.set(k, Date.now());
  return null;
}
