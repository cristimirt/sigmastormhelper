import { S } from '../core/state.js';
import { getRouter, initPathfinderPage, pfUpdate } from '../pathfinder/panel.js';

// A world map (the page "Mastermap": the picture of a realm with its areas): the Path Finder button and panel, as on the map, and each
// area's minimum level in its tooltip. The page does not say the realm's name in text (it is in the picture): it is the realm of the Path
// Finder's data that is entered through the areas shown here.
const head = () => document.querySelector('td[background*="header_mastermap"]');

export const isMastermap = () => !!head();

// the tooltip's text is written as a JavaScript string: "<" stands for "<"
const TIP = /(?:<|\\u003C)center(?:>|\\u003E)([^<\\]+?)(?:<|\\u003C)br/i;
const BR = /(?:<|\\u003C)br(?:>|\\u003E)/i;

// the picture's names are not always the area's own: "101st Highridge HQ", "Highridge Walk" for "Highridge (Walk)"
const plain = (n) => n.toLowerCase().replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').replace(/[^a-z0-9]/g, '');

// The area of the data a name on the picture stands for: one entered from this realm, else a neighbouring world map, else one entered
// from this realm whose name only starts that way ("Desert Path" for "Desert Path (Mouth)", the lowest of them), else any area.
function areaOf(router, entries, name) {
  const p = plain(name);
  const same = (a) => plain(a.name) === p;
  return entries.find(same) || router.masters.find(same) ||
    entries.filter((a) => plain(a.name).startsWith(p)).sort((a, b) => a.level - b.level)[0] || Object.values(router.byName).find(same) || null;
}

function realmOf(router, names) {
  let best = null;
  let most = 0;
  router.masters.forEach((m) => {
    const entries = (m.entries || []).map((n) => router.byName[n]).filter(Boolean);
    const n = names.filter((name) => entries.some((a) => plain(a.name).startsWith(plain(name)))).length;
    if (n > most) { most = n; best = { name: m.name, entries }; }
  });
  return best;
}

function addLevels(router, zones) {
  const realm = realmOf(router, zones.map((z) => z.name));
  zones.forEach((z) => {
    const a = areaOf(router, realm ? realm.entries : [], z.name);
    const tip = z.el.getAttribute('onmouseover');
    if (!a || tip.includes('Min. level')) return;
    z.el.setAttribute('onmouseover', tip.replace(BR, (br) => br + 'Min. level: ' + a.level + br));
  });
  return realm;
}

export function initMastermap() {
  const table = head() && head().closest('table[width="640"]');
  if (!table || S.layout !== 'modern') return;
  const zones = [...document.querySelectorAll('area[onmouseover]')].map((el) => {
    const m = (el.getAttribute('onmouseover') || '').match(TIP);
    return { el, name: m ? m[1].trim() : '' };
  }).filter((z) => z.name);
  // the button goes under the realm's picture and description (the empty place at the bottom of the frame)
  const inner = table.querySelector('table[width="512"]');
  initPathfinderPage(inner || table, null, !!inner);
  getRouter().then((router) => {
    if (!router) return;
    const realm = addLevels(router, zones);
    if (!realm) return;
    S.loc = { area: realm.name, x: null, y: null };
    pfUpdate();
  });
}
