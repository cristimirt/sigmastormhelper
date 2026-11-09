// A few of the game's responses come with broken markup (the mission page of a quest that has not been started closes its tables in the
// wrong places): the content frame loses its right border and bottom picture, the right sidebar ends up after the page table, and the
// bottom rows of the page table are missing. The helper (and the Original layout) need the usual structure, so it is rebuilt here, once,
// before anything reads the page: the same cells and pictures, in the places the other pages have them.
const SKIN = 'https://cdn.sigmastorm.com/skin/';

export function repairPage(doc) {
  const d = doc || document;
  const m = d.getElementById('mainContentDiv');
  if (!m || !m.rows || m.rows.length !== 3 || m.rows[1].cells.length !== 3) return false;
  const [, columns, bottom] = m.rows;
  const rightBorder = columns.cells[2];
  const side = m.nextElementSibling;
  if (!/inner_right/.test(rightBorder.getAttribute('background') || '') || !side || !side.querySelector('img[src*="sidebar_right_top"]')) return false;
  const cf = [...columns.cells[1].children].find((t) => t.tagName === 'TABLE' && t.rows.length === 4);
  if (!cf) return false;
  const [, cfColumns, stray, cfFoot] = cf.rows;
  // the content frame: its third cell is the game's stray text ("System Start Up"); the right border belongs there
  cfColumns.cells[2].replaceWith(rightBorder);
  // the footer picture closes the mission table
  const mission = cfColumns.cells[1].querySelector('table[background*="large_content_bg"]');
  if (mission && cfFoot.cells[0]) {
    const spare = [...mission.rows].reverse().find((r) => !r.cells.length);
    const row = spare || mission.insertRow(-1);
    row.append(cfFoot.cells[0]);
  }
  stray.remove();
  cfFoot.remove();
  // the bottom picture of the content frame, the sidebar of the right, and the bottom rows of the page table
  cf.tBodies[0].append(bottom);
  const cell = d.createElement('td');
  const bg = columns.cells[0].getAttribute('background');
  if (bg) cell.setAttribute('background', bg);
  cell.setAttribute('width', '140');
  cell.setAttribute('align', 'center');
  cell.setAttribute('valign', 'top');
  cell.append(side);
  columns.append(cell);
  const caps = m.insertRow(-1);
  [0, 1, 2].forEach((i) => {
    const td = caps.insertCell(-1);
    td.height = '42';
    if (i !== 1) td.style.backgroundImage = 'url(' + SKIN + 'right_menu_bottom.gif)';
  });
  const banner = m.insertRow(-1).insertCell(-1);
  banner.colSpan = 3;
  banner.setAttribute('valign', 'top');
  banner.setAttribute('background', SKIN + 'welcome/bottom_banner_x2.jpg');
  banner.setAttribute('height', '85');
  return true;
}
