// Where the parts of a page are. The game's page is a table (header, the three columns, the footer); the Modern layout replaces
// it with divs (#ssh-page, see layout/frame.js). A fetched page (a document) is always the game's table.
// -> { header, left, center, right, body, modern } or null when the page has no such frame (a login page, say). body is where
// the page's own content is: the middle cell of the content frame (a table in the game's page, a div in the Modern layout).

// The game's content frame: an outer table of a top picture, two border columns around the content cell, and a bottom picture.
export const isContentFrame = (t) => !!t && t.tagName === 'TABLE' && t.rows.length === 3 && t.rows[1].cells.length === 3 && /inner_bg/.test(t.rows[1].cells[1].getAttribute('background') || '');

function bodyOf(center) {
  const f = center.querySelector(':scope > .ssh-cf > .cf-mid > .cf-body');
  if (f) return f;
  const t = [...center.children].find(isContentFrame);
  return t ? t.rows[1].cells[1] : center;
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
