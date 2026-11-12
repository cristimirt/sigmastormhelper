// Where the parts of a page are. The game's page is a table (header, the three columns, the footer); the Modern layout replaces
// it with divs (#ssh-page, see layout/frame.js). A fetched page (a document) is always the game's table.
// -> { header, left, center, right, body, modern } or null when the page has no such frame (a login page, say). body is where
// the page's own content is: the middle cell of the content frame (a table in the game's page, a div in the Modern layout).

// The game's content frame (a page with an alert of its own has an extra row after the columns): an outer table of a top picture, two border columns around the content cell, and a bottom picture.
// The row of the content frame that holds the page (three cells, the middle one on the inner_bg picture); a page may have a spacer row above the top picture.
export const frameRow = (t) => [...t.rows].findIndex((r) => r.cells.length === 3 && /inner_bg/.test(r.cells[1].getAttribute('background') || ''));
export const isContentFrame = (t) => !!t && t.tagName === 'TABLE' && t.rows.length >= 3 && frameRow(t) >= 1;

// The content frame table in the middle cell: a child of it, or (the world page) a child of the <section> the game puts there.
export const findFrame = (center) => [...center.querySelectorAll(':scope > table, :scope > section > table')].find(isContentFrame) || null;

function bodyOf(center) {
  const f = center.querySelector('.ssh-cf > .cf-mid > .cf-body');
  if (f) return f;
  const t = findFrame(center);
  return t ? t.rows[frameRow(t)].cells[1] : center;
}

export function pageParts(doc) {
  const d = doc || document;
  const f = d.getElementById('ssh-page');
  if (f) {
    const center = f.querySelector('.ssh-center');
    return { header: f.querySelector('.ssh-hd'), left: f.querySelector('.ssh-left'), center, body: bodyOf(center), right: f.querySelector('.ssh-right'), modern: true };
  }
  const m = d.getElementById('mainContentDiv');
  if (!m || !m.rows || m.rows.length < 2 || m.rows[1].cells.length < 3) return null;
  const center = m.rows[1].cells[1];
  return { header: m.rows[0].cells[0], left: m.rows[1].cells[0], center, body: bodyOf(center), right: m.rows[1].cells[2], modern: false };
}
