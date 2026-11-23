import { S } from '../core/state.js';
import { initPathfinderPage } from '../pathfinder/panel.js';

// A world map (the page "Mastermap": the picture of a realm with its areas): the Path Finder button and panel, as on the map. The page
// does not say the realm's name in text (it is in the picture); the areas' tooltips do: "Amethyst Peak (Pinnacle)" is in "Amethyst Peak".
const head = () => document.querySelector('td[background*="header_mastermap"]');

export const isMastermap = () => !!head();

// the tooltip's text is written as a JavaScript string: "<" stands for "<"
const TIP = /(?:<|\\u003C)center(?:>|\\u003E)([^<\\]+?)(?:<|\\u003C)br/i;

export function initMastermap() {
  const table = head() && head().closest('table[width="640"]');
  if (!table || S.layout !== 'modern') return;
  const count = {};
  document.querySelectorAll('area[onmouseover]').forEach((a) => {
    const m = (a.getAttribute('onmouseover') || '').match(TIP);
    const n = m && m[1].trim().replace(/\s*\([^()]*\)$/, '');
    if (n) count[n] = (count[n] || 0) + 1;
  });
  const area = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  // the button goes under the realm's picture and description (the empty place at the bottom of the frame)
  const inner = table.querySelector('table[width="512"]');
  initPathfinderPage(inner || table, area ? { area, x: null, y: null } : null, !!inner);
}
