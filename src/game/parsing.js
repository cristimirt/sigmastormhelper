import { fixHellforge } from '../core/imgfix.js';
// The game's tile tooltips still point their pictures at hosts that are gone (old IP addresses, fileserver.huntedcow.com):
// the same files are on the CDN. Also applied when a tooltip is shown, because areas are kept in the browser.
// The text of a JavaScript string literal (the game writes the tooltip of a tile as Tip("...") with \" \/ < and so on in it).
const unJs = (s) => s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, c) => (c.length > 1 ? String.fromCharCode(parseInt(c.slice(1), 16)) : ({ n: '\n', r: '\r', t: '\t' }[c] || c)));

export const fixImgHosts = (html) => fixHellforge(html).replace(/https?:\/\/(?:\d{1,3}(?:\.\d{1,3}){3}|fileserver\.huntedcow\.com)\/sigma2\//g, 'https://cdn.sigmastorm.com/');

const LOC_RE =/([A-Za-z][\w' ]*(?:\([^)]*\))?)\s*-\s*\((\d+),\s*(\d+)\)/;

export function parseLoc(doc) {
  const cb = doc.querySelector('td[background*="coord_bg"]');
  const m = ((cb && cb.textContent.match(LOC_RE)) || (doc.body.textContent || '').match(LOC_RE));
  return m ? { area: m[1].trim(), x: parseInt(m[2], 10), y: parseInt(m[3], 10) } : null;
}

export function parseMoves(doc, loc) {
  const out = new Map();
  doc.querySelectorAll('a[href*="subcmd=move"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const m = href.match(/[?&]x=(\d+)&(?:amp;)?y=(\d+)/);
    if (!m) return;
    const x = parseInt(m[1], 10);
    const y = parseInt(m[2], 10);
    if (loc && x === loc.x && y === loc.y) return;
    const img = a.querySelector('img');
    const title = (img && img.getAttribute('title')) || a.getAttribute('title') || '';
    const cost = (title.match(/\((\d+)\s*Energy\)/i) || [])[1];
    const key = (title.match(/Shortcut Key:\s*(\w)/i) || [])[1];
    // The game draws the arrow of a direction you cannot walk to with a "grey" image (no _on in its name).
    const on = !!img && /_on\.gif/i.test(img.getAttribute('src') || '');
    const prev = out.get(x + ',' + y);
    if (prev) { prev.enabled = prev.enabled || on; return; }
    out.set(x + ',' + y, { x, y, href, cost: cost ? parseInt(cost, 10) : null, title, key: key ? key.toLowerCase() : null, enabled: on });
  });
  return [...out.values()];
}

export function parseAreaUrl(doc) {
  for (const a of doc.querySelectorAll('a[href*="subcmd=map"]')) {
    const h = a.getAttribute('href') || '';
    const m = h.match(/openWindow\('([^']+)'/); // the game used to open the map in a window ...
    if (m) return m[1].replace(/&amp;/g, '&');
    if (/[?&]cmd=world&(?:amp;)?subcmd=map\b|[?&]subcmd=map\b/.test(h) && !/^javascript:/i.test(h)) return h.replace(/&amp;/g, '&'); // ... and now it is a plain link
  }
  // the link's address is written into the page by the game's script, after the helper may have looked: the map page is the same address
  // without it (the helper adds the token to the request)
  return doc.getElementById('mapDiv') ? 'index.php?cmd=world&subcmd=map' : null;
}

// The "Open Area Map" page: one big table, a 65x65 cell per tile with the tile image as background.
export function parseAreaMap(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const outer = [...doc.querySelectorAll('table')].find(
    (t) => t.rows.length > 3 && t.rows[0].cells.length > 3 && t.rows[0].cells[0].hasAttribute('background')
  );
  if (!outer) return null;
  const rows = [...outer.rows];
  const cells = [];
  rows.forEach((r) => {
    [...r.cells].forEach((c) => {
      const on = c.getAttribute('onmouseover') || '';
      const tm = on.match(/Tip\((['"])((?:(?!\1)[^\\]|\\.)*)\1/); // the game now writes the tip in double quotes (it was single)
      const wm = on.match(/tt_setWidth\((\d+)\)/);
      cells.push({
        bg: c.getAttribute('background') || '',
        tip: tm ? fixImgHosts(unJs(tm[2])) : '',
        tipW: wm ? parseInt(wm[1], 10) : 200,
      });
    });
  });
  return { cols: rows[0].cells.length, rows: rows.length, cells };
}
