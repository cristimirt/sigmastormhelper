// Static data (walkable tiles, skill descriptions, stim buffs) is not part of the script: it lives in data/*.json and is
// published next to it. The manifest names a hash for every file; a file is downloaded only when its hash changed and is
// kept in localStorage, so a data fix reaches the players without a new build of the script.
import { PREFIX } from './constants.js';

export const DATA = { tiles: {}, skills: {}, extra: {}, realms: {} };

// key in DATA -> file name in data/
const FILES = { tiles: 'tiles', skills: 'skills', extra: 'buffs-extra', realms: 'realms' };

export async function loadData(ctx) {
  const manifest = (ctx && ctx.manifest) || {};
  const base = (ctx && ctx.base) || '';
  await Promise.all(Object.keys(FILES).map(async (key) => {
    const name = FILES[key];
    const want = manifest.data && manifest.data[name];
    const slot = PREFIX + 'data_' + name;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(slot)); } catch (e) { cached = null; }
    if (cached && (!want || cached.h === want)) { DATA[key] = cached.v; return; }
    try {
      const r = await fetch(base + 'data/' + name + '.json?v=' + (want || Date.now()), { cache: want ? 'default' : 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const v = await r.json();
      DATA[key] = v;
      try { localStorage.setItem(slot, JSON.stringify({ h: want || '', v })); } catch (e) { /* storage full: next time again */ }
    } catch (e) {
      if (cached) DATA[key] = cached.v; // offline or the site is down: keep what we have
      else console.warn('[Sigmastorm Helper] could not load data/' + name + '.json', e);
    }
  }));
}
