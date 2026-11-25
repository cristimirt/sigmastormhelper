import { withToken } from '../core/net.js';
import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { steelContainer } from '../layout/steel.js';

// The Join a Faction page (cmd=guild&subcmd=join: the invitations you received) for the Modern layout: the steel container
// (layout/steel.js) with the game's header, the intro, the pages above and below, and one row per invitation with its two buttons. The
// forms are copies of the game's, with their hidden fields and the game's own "Are you sure" question. The game's table stays in the
// page, hidden in the Modern layout, so the Original layout is untouched.

// an element with plain text (never markup: it comes from the page)
const texted = (cls, text) => { const d = mel('div', cls); d.textContent = text; return d; };

const CSS = 'html.ssh-modern [data-ssh-iv]{display:none!important}#ssh-iv{display:none}html.ssh-modern #ssh-iv{display:block}' +
  '#ssh-iv .iv-in{margin:0 20px}#ssh-iv p{margin:0 0 10px}#ssh-iv form{margin:0}' +
  '#ssh-iv .iv-pages{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin:6px 0}' +
  '#ssh-iv .iv-head{display:flex;justify-content:space-between;padding:3px 8px;background:#212323;font-weight:bold}' +
  '#ssh-iv .iv-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid #2e2a1e}' +
  '#ssh-iv .iv-row:hover{background:#171a1a}#ssh-iv .iv-name{min-width:0;overflow-wrap:anywhere}' +
  '#ssh-iv .iv-act{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}#ssh-iv .iv-act input{cursor:pointer}' +
  '#ssh-iv .iv-act input[disabled]{cursor:default;opacity:.45}#ssh-iv .iv-none{padding:8px;text-align:center}';

const head = () => document.querySelector('td[background*="header_joinguild."]');

export const isInvitations = () => !!head();

// Each invitation's faction name becomes a link to the faction's page (its number is in the invitation's forms). It is done in the
// game's own table, so both layouts have it.
function linkFactions(table) {
  table.querySelectorAll('tr[data-faction-invitation]').forEach((tr) => {
    const id = tr.querySelector('input[name="guild_id"]');
    const cell = tr.cells[0];
    if (!id || !/^\d+$/.test(id.value) || !cell.textContent.trim() || cell.querySelector('a')) return;
    const a = mel('a');
    a.href = withToken('index.php?cmd=guild&subcmd=view&guild_id=' + id.value);
    a.append(...cell.childNodes);
    cell.append(a);
  });
}

export function initInvitations() {
  const table = head() && head().closest('table[width="640"]');
  const inner = table && table.querySelector('table'); // intro, pages, invitations, pages
  if (!inner || document.getElementById('ssh-iv')) return;
  linkFactions(inner);
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const page = steelContainer({ header: head().getAttribute('background') });
  page.id = 'ssh-iv';
  const cs = getComputedStyle(inner.querySelector('td')); // the page is in quirks mode: text in a table has the game's own font for td
  page.style.cssText = 'font:' + cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + '/' + cs.lineHeight + ' ' + cs.fontFamily + ';color:' + cs.color;
  const body = mel('div', 'iv-in');

  // the pages: the form without its little table
  const pages = (form) => {
    const f = form.cloneNode(false);
    f.removeAttribute('id');
    f.className = 'iv-pages';
    const take = (n) => {
      if (n.nodeName === 'TABLE') [...n.rows].forEach((r) => [...r.cells].forEach((c) => c.childNodes.forEach(take)));
      else if (n.nodeType === 1 || n.textContent.trim()) f.append(n.cloneNode(true));
    };
    form.childNodes.forEach(take);
    return f;
  };

  // the intro: a paragraph for every block of text, with its links
  const intro = (cell) => {
    let p = mel('p');
    const flush = () => { if (p.textContent.trim()) body.append(p); p = mel('p'); };
    cell.childNodes.forEach((n) => { if (n.nodeName === 'BR') flush(); else p.append(n.cloneNode(true)); });
    flush();
  };

  const list = (t) => {
    [...t.rows].forEach((tr) => {
      const cells = [...tr.cells];
      if (!tr.textContent.trim() && !tr.querySelector('input')) return; // the game's spacer and line rows
      if (tr.querySelector('b') && !tr.querySelector('form')) {
        const h = mel('div', 'iv-head');
        cells.forEach((c) => h.append(texted('', c.textContent.trim())));
        body.append(h);
        return;
      }
      if (cells.length < 2) { body.append(texted('iv-none', tr.textContent.trim())); return; }
      const row = mel('div', 'iv-row');
      const name = mel('div', 'iv-name');
      cells[0].childNodes.forEach((n) => name.append(n.cloneNode(true)));
      const act = mel('div', 'iv-act');
      [...cells[1].children].forEach((e) => { const c = e.cloneNode(true); c.removeAttribute('id'); act.append(c); });
      row.append(name, act);
      body.append(row);
    });
  };

  [...inner.rows].forEach((tr) => {
    const c = tr.cells[0];
    const form = c.querySelector(':scope > form');
    const t = c.querySelector(':scope > table');
    if (t) list(t);
    else if (form) body.append(pages(form));
    else if (c.textContent.trim()) intro(c);
  });

  page.body.append(body);
  table.setAttribute('data-ssh-iv', '1');
  table.after(page);
  // the game's answer to an invitation may be a box in the hidden table: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
