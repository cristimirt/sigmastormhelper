import { withToken } from '../core/net.js';
import { mel } from '../layout/dom.js';

// The menu on top of the three behemoth pages (Doppler Array | Behemoth Rewards | Behemoth Kills) and the link to the Faction Manager under it.
// The page that is shown is bold and not a link.

const PAGES = [
  ['doppler', 'Doppler Array', 'index.php?cmd=guild&subcmd=dopplerarray'],
  ['rewards', 'Behemoth Rewards', 'index.php?cmd=guild&subcmd=titanrewards'],
  ['kills', 'Behemoth Kills', 'index.php?cmd=titan'],
];

export const BM_CSS = '.bm-menu{text-align:center;margin:0 0 12px;line-height:1.7;color:#fff}.bm-menu a{color:#a7ffff;text-decoration:none}.bm-menu a:hover{color:#fff}' +
  '.bm-menu .bm-now{font-weight:bold;color:#fff;border-bottom:1px solid #a7ffff}.bm-menu .bm-sep{margin:0 8px;color:#6c675d}.bm-menu .bm-sub{font-size:11px}';

export function behMenu(current) {
  const box = mel('div', 'bm-menu');
  const row = mel('div', 'bm-row');
  PAGES.forEach(([id, name, href], i) => {
    if (i) row.append(mel('span', 'bm-sep', '|'));
    if (id === current) row.append(mel('span', 'bm-now', name));
    else { const a = mel('a', '', name); a.href = withToken(href); row.append(a); }
  });
  const sub = mel('div', 'bm-sub');
  const f = mel('a', '', 'Faction Manager');
  f.href = withToken('index.php?cmd=guild&subcmd=manage');
  sub.append('[ ', f, ' ]');
  box.append(row, sub);
  return box;
}
