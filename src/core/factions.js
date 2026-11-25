import { fetchDoc } from './net.js';
import { store } from './storage.js';

// A faction's number from its name, for the messages that only have the name. The game's faction list is searched for it (the list
// finds every name that has the text in it: only the same name counts); a number found is kept, so it is asked for once.
const key = (name) => name.replace(/\s+/g, ' ').trim().toLowerCase();
const asked = new Map(); // name -> the search that is running (or done) on this page

async function search(name) {
  const q = 'index.php?cmd=guild&subcmd=atoz&search_text=' + encodeURIComponent(name);
  for (let page = 0, pages = 1; page < Math.min(pages, 5); page++) {
    const d = await fetchDoc(q + (page ? '&page=' + page : ''));
    const hit = [...d.querySelectorAll('tr[data-faction-result] a[href]')].find((a) => key(a.textContent) === key(name));
    const id = hit && (hit.getAttribute('href').match(/[?&]guild_id=(\d+)/) || [])[1];
    if (id) return id;
    pages = d.querySelectorAll('select[name="page"] option').length / 2 || 1; // the pages' list is above and below the factions
  }
  return null;
}

export function factionIdFor(name) {
  const k = key(name);
  const known = (store.get('factions', {}) || {})[k];
  if (known) return Promise.resolve(known);
  if (!asked.has(k)) {
    asked.set(k, search(name).then((id) => {
      if (id) store.set('factions', { ...store.get('factions', {}), [k]: id });
      return id;
    }, () => null));
  }
  return asked.get(k);
}
