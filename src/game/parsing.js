// The game's tile tooltips still point their pictures at hosts that are gone (an old IP address, fileserver.huntedcow.com):
// the same files are on the CDN. Also applied when a tooltip is shown, because areas are kept in the browser.
export const fixImgHosts = (html) => html.replace(/https?:\/\/(?:72\.29\.91\.222|fileserver\.huntedcow\.com)\/sigma2\//g, 'https://cdn.sigmastorm.com/');

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
    const m = (a.getAttribute('href') || '').match(/openWindow\('([^']+)'/);
    if (m) return m[1].replace(/&amp;/g, '&');
  }
  return null;
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
      const tm = on.match(/Tip\('((?:[^'\\]|\\.)*)'/);
      const wm = on.match(/tt_setWidth\((\d+)\)/);
      cells.push({
        bg: c.getAttribute('background') || '',
        tip: tm ? fixImgHosts(tm[1].replace(/\\'/g, "'")) : '',
        tipW: wm ? parseInt(wm[1], 10) : 200,
      });
    });
  });
  return { cols: rows[0].cells.length, rows: rows.length, cells };
}
