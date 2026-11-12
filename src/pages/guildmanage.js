import { fetchDoc, fetchText, navigate } from '../core/net.js';
import { alertBad, alertText, parseHtml } from '../core/util.js';
import { gAlerts } from '../layout/modal.js';
import { tableToDivs } from '../layout/tablediv.js';
import { mel } from '../layout/dom.js';
import { sections, sectionsCss } from '../layout/panels.js';
import { openStore } from './guildstore.js';

// The Manage Faction page (cmd=guild&subcmd=manage) for the Modern layout: the game's page is a set of about eighty nested tables (the logo,
// the statistics, the bank, the structures, the members, the store ...). A copy of it is made of divs (layout/tablediv.js), and the game's
// table stays in the page, hidden in the Modern layout, so the Original layout is untouched. Links and forms are copies that work like the originals.

const CSS = 'html.ssh-modern [data-ssh-gm]{display:none!important}#ssh-gm{display:none}html.ssh-modern #ssh-gm{display:block}' +
  '#ssh-gm>.tg{background-position:0 0}#ssh-gm .gm-col{display:flex;flex-direction:column;min-height:60px}#ssh-gm .gm-col>.sec>.tg{width:100%!important}#ssh-gm .sec.shut{margin-bottom:10px}#ssh-gm .sec.busy{opacity:.55;pointer-events:none}.gm-note{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:9800;max-width:80vw;padding:7px 16px;background:#0b130b;color:#cfe8cf;border:1px solid #3c5a3c;box-shadow:0 4px 14px #000;font:12px tahoma,sans-serif;text-align:center;pointer-events:none;transition:opacity .4s}.gm-note.bad{background:#1a0b0b;color:#f0c8c8;border-color:#6a3030}#ssh-gm .tgc.gm-l{padding-left:5px!important}#ssh-gm .tgc.gm-r{padding-right:5px!important}'; // each panel fills its column
const KEY = 'gmsec';

// The panels of a column of the game's table: it is a stack of rows, a title bar row (grey cell) starts each one.
function panelsOf(colTable) {
  const out = [];
  [...colTable.rows].forEach((r) => {
    const c = r.cells[0];
    if (c && c.getAttribute('bgcolor') === '#212323') {
      const name = c.textContent.replace(/[(\[].*$/s, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'panel' + out.length;
      out.push({ name, rows: [], heads: r.cells.length });
    }
    if (out.length) out[out.length - 1].rows.push(r.cloneNode(true));
  });
  return out.map((p) => {
    const t = colTable.cloneNode(false);
    t.setAttribute('width', '100%');
    t.setAttribute('data-tg-trim', '1'); // the empty columns that a wide cell (the logo) makes at the end take no width
    const tb = document.createElement('tbody');
    tb.append(...p.rows);
    t.append(tb);
    return { name: p.name, heads: p.heads, table: t };
  });
}

// A panel as an element: its table made of divs, the cells of its title bar marked.
function panelEl(p) {
  const sec = mel('div', 'sec');
  sec.dataset.sec = p.name;
  const g = tableToDivs(p.table);
  [...g.children].slice(0, p.heads).forEach((c) => c.classList.add('gm-h'));
  sec.append(g);
  if (p.name === 'faction-store') { // what the game calls the Faction Store is the Faction Inventory here, and its Manage link is Store
    sec.querySelectorAll('.gm-h b').forEach((b) => { if (/^Faction Store/.test(b.textContent)) b.textContent = 'Faction Inventory'; });
    sec.querySelectorAll('.gm-h a[href*="subcmd2=storeitems"]').forEach((a) => { if (/^Manage$/i.test(a.textContent.trim())) { a.textContent = 'Store'; a.title = 'Store items from your backpack'; } });
  }
  return sec;
}

// The pages of the Faction Store (the numbers under it): the page is fetched in the background and only what is under the title bar is replaced.
async function loadStore(href, sec) {
  if (sec.classList.contains('busy')) return;
  sec.classList.add('busy');
  sec.dataset.page = (href.match(/guildstore_page=(\d+)/) || [])[1] || '0'; // the page that is shown (a taken item reads the same page again)
  try {
    const doc = await fetchDoc(href);
    const hd = [...doc.querySelectorAll('td[bgcolor="#212323"]')].find((td) => /^\s*( |\s)*Faction Store/.test(td.textContent));
    const ct = hd && hd.closest('table');
    const p = ct && panelsOf(ct).find((x) => x.name === 'faction-store');
    const grid = sec.querySelector(':scope > .tg');
    if (!p || !grid) { navigate(href); return; }
    const fresh = tableToDivs(p.table);
    [...grid.children].filter((c) => !c.classList.contains('gm-h')).forEach((c) => c.remove());
    grid.append(...[...fresh.children].slice(p.heads));
  } catch (e) {
    navigate(href);
  } finally {
    sec.classList.remove('busy');
  }
}

// A small note at the bottom of the page that goes away by itself.
let noteT = 0;
function note(text, bad) {
  document.querySelectorAll('#ssh-gm-note').forEach((e) => e.remove());
  const n = mel('div', 'gm-note' + (bad ? ' bad' : ''));
  n.id = 'ssh-gm-note';
  n.textContent = text;
  document.body.append(n);
  clearTimeout(noteT);
  noteT = setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 400); }, 2600);
}

// Taking an item (its picture is the button of a form of its own): the game's form is sent in the background, its message shows, and the page of the
// panel is read again.
async function take(form, sec) {
  if (sec.classList.contains('busy')) return;
  sec.classList.add('busy');
  const body = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button' && e.type !== 'image') body.append(e.name, e.value); });
  let ok = false;
  try {
    const html = await fetchText('index.php', { method: 'POST', body });
    const al = gAlerts(parseHtml(html));
    note(al.length ? alertText(al) : 'Item taken.', al.length && alertBad(al)); // the game's message, or a plain one
    ok = true;
  } catch (e) {
    ok = false;
  }
  sec.classList.remove('busy');
  if (!ok) { form.submit(); return; } // the browser sends it the normal way
  loadStore('index.php?cmd=guild&subcmd=manage&guildstore_page=' + (sec.dataset.page || '0'), sec);
}

export function initGuildManage() {
  const head = document.querySelector('td[background*="header_factionmanage"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-gm')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-gm', '1');
  // the Upkeep of the structures: the numbers are aligned to the right (a class on those cells of the game's table, which the copy takes over)
  [...table.querySelectorAll('table')].forEach((t) => {
    const h = t.rows[0];
    const at = h ? [...h.cells].findIndex((c) => c.textContent.trim() === 'Upkeep') : -1;
    if (at < 0) return;
    [...t.rows].forEach((r) => { if (r.cells.length === h.cells.length && r.cells[at]) r.cells[at].dataset.tgClass = 'r'; });
  });
  // the two columns of the page (the cells of the row with the logo and the members) get a class each, for their padding
  const cols = [...table.rows].find((r) => r.cells.length === 4);
  if (cols) { cols.cells[1].dataset.tgClass = 'gm-l'; cols.cells[2].dataset.tgClass = 'gm-r'; }
  // the columns are taken out of a copy of the table and made into stacks of panels (a title bar and what is under it), put back after the copy is made of divs
  const work = table.cloneNode(true);
  const stacks = [];
  const wcols = [...work.rows].find((r) => r.cells.length === 4);
  [1, 2].forEach((i) => {
    const ct = wcols && wcols.cells[i].querySelector(':scope > table');
    if (!ct) return;
    const ph = mel('div', 'gm-col');
    ct.replaceWith(ph);
    stacks.push(panelsOf(ct));
  });
  const root = mel('div');
  root.id = 'ssh-gm';
  const grid = tableToDivs(work);
  grid.querySelectorAll('.gm-col').forEach((col, i) => {
    (stacks[i] || []).forEach((p) => col.append(panelEl(p)));
  });
  grid.style.gridTemplateColumns = '6px minmax(0,1fr) minmax(0,1fr) 6px'; // two equal columns, a small margin at the sides, a small space between
  grid.style.columnGap = '6px';
  root.append(grid);
  table.after(root);
  st.textContent += sectionsCss('#ssh-gm', '.gm-h', '.tgc:not(.gm-h)');
  root.addEventListener('submit', (e) => {
    const f = e.target && e.target.matches && e.target.matches('.sec[data-sec="faction-store"] form[id^="faction-take-"]') ? e.target : null;
    if (!f) return;
    e.preventDefault();
    take(f, f.closest('.sec'));
  });
  root.addEventListener('click', (e) => { // Store: the page of the items to store, as a pop-up; the panel is read again after it
    const st = e.target && typeof e.target.closest === 'function' ? e.target.closest('.sec[data-sec="faction-store"] .gm-h a[href*="subcmd2=storeitems"]') : null;
    if (!st) return;
    e.preventDefault();
    const sec = st.closest('.sec');
    openStore(st.getAttribute('href'), () => loadStore('index.php?cmd=guild&subcmd=manage&guildstore_page=0', sec));
  });
  root.addEventListener('click', (e) => {
    const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('.sec[data-sec="faction-store"] a[href*="guildstore_page="]') : null;
    if (!a) return;
    e.preventDefault();
    loadStore(a.getAttribute('href'), a.closest('.sec'));
  });
  sections({ root, key: KEY, cols: '.gm-col', sec: '.sec', head: '.gm-h', switchIn: (h) => h.firstElementChild || h });
}
