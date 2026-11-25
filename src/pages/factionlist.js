import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';

// The Faction List, "A - Z Listing" (cmd=guild&subcmd=atoz) for the Modern layout: the steel container (layout/steel.js) with the game's
// header, the intro, the search, the letters, the pages above and below, and the factions one per row. The forms are copies of the
// game's (with their hidden fields: they work like the original) and so are the links. The game's table stays in the page, hidden in
// the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-fl]{display:none!important}#ssh-fl{display:none}html.ssh-modern #ssh-fl{display:block}' +
  '#ssh-fl .fl-in{margin:0 20px}#ssh-fl p{margin:0 0 8px;text-align:center}#ssh-fl form{margin:0}' +
  '#ssh-fl .fl-search{display:flex;gap:4px;max-width:420px;margin:0 auto 10px}#ssh-fl .fl-search input[type="text"]{flex:1;min-width:0}' +
  '#ssh-fl .fl-abc{display:flex;flex-wrap:wrap;justify-content:center;margin-bottom:10px}' +
  '#ssh-fl .fl-abc>*{display:block;min-width:17px;padding:2px 0;text-align:center;border:1px solid transparent}' +
  '#ssh-fl .fl-abc>a:hover{border-color:#3a3d3d;background:#0d0f0f}#ssh-fl .fl-abc>font{border-color:#7a2a24;background:#1c0d0c}' +
  '#ssh-fl .fl-pages{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin:6px 0}' +
  '#ssh-fl .fl-head{padding:3px 8px;background:#212323;font-weight:bold}' +
  '#ssh-fl .fl-row{padding:2px 8px;border-bottom:1px solid #191b1b;overflow-wrap:anywhere}#ssh-fl .fl-row:hover{background:#171a1a}' +
  '#ssh-fl .fl-row a{display:block}#ssh-fl .fl-none{padding:8px;text-align:center}';

export const isFactionList = () => !!document.getElementById('faction-search') && !!document.querySelector('td[background*="header_squadlisting"]');

// the game's nodes, copied into d (the spaces and line breaks between them are left to the helper's own spacing)
const copy = (from, d) => {
  from.childNodes.forEach((n) => { if (n.nodeType === 1 || n.textContent.trim()) d.append(n.cloneNode(true)); });
  return d;
};

export function initFactionList() {
  const head = document.querySelector('td[background*="header_squadlisting"]');
  const table = head && head.closest('table[width="640"]');
  const search = document.getElementById('faction-search');
  const inner = search && search.closest('table'); // intro, search, letters, pages, factions, pages
  if (!table || !inner || document.getElementById('ssh-fl')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ header: head.getAttribute('background') });
  page.id = 'ssh-fl';
  const cell = search.closest('td');
  const cs = getComputedStyle(cell); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  const body = mel('div', 'fl-in');

  const formCopy = (form, cls) => {
    const f = copy(form, form.cloneNode(false));
    f.removeAttribute('id');
    f.className = cls;
    return f;
  };

  [...inner.rows].forEach((tr) => {
    const c = tr.cells[0];
    const form = c.querySelector('form');
    const list = c.querySelector('table');
    if (form) body.append(formCopy(form, form === search ? 'fl-search' : 'fl-pages'));
    else if (list) {
      [...list.rows].forEach((r) => {
        const a = r.querySelector('a[href]');
        const cls = r.hasAttribute('data-faction-result') || a ? 'fl-row' : r.cells[0].querySelector('b') ? 'fl-head' : 'fl-none';
        body.append(copy(r.cells[0], mel('div', cls)));
      });
    } else if (c.querySelector('a[href*="letter="]')) {
      const abc = mel('div', 'fl-abc');
      [...c.children].forEach((e) => abc.append(e.cloneNode(true)));
      body.append(abc);
    } else if (c.textContent.trim()) {
      const p = mel('p');
      p.textContent = c.textContent.replace(/\s+/g, ' ').trim();
      body.append(p);
    }
  });

  page.body.append(body);
  table.setAttribute('data-ssh-fl', '1');
  table.after(page);
}
