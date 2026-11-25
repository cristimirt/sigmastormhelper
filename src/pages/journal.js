import { DATA } from '../core/data.js';
import { factionIdFor } from '../core/factions.js';
import { withToken } from '../core/net.js';
import { idFor, knownId } from '../core/players.js';
import { store } from '../core/storage.js';
import { esc, https } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { tableToDivs } from '../layout/tablediv.js';
import { skillByName } from '../tooltips/skills.js';

// The Journal (cmd=log), its Ignore List (subcmd=ignorelist) and its Outbox (subcmd=outbox) for the Modern layout, in the steel container (layout/steel.js): .jr-top (the game's notes and links), the page form (a copy,
// it works like the original: a GET with the page number) and .jr-list, one .jr-row per entry (.jr-ic, .jr-dt, .jr-msg). The game's table stays in
// the page, hidden in the Modern layout, so the Original layout is untouched.

const CSS = 'html.ssh-modern [data-ssh-jr]{display:none!important}#ssh-jr{display:none}html.ssh-modern #ssh-jr{display:block}' +
  '#ssh-jr .ssh-content-body{padding-top:14px;padding-bottom:14px;text-align:left}' +
  '#ssh-jr .jr-top p{margin:0 0 8px}' +
  '#ssh-jr form{margin:0 0 8px}' +
  '#ssh-jr .jr-row{display:flex;align-items:flex-start;gap:6px;padding:7px 4px;border-top:1px solid #1a1d1d;font-size:12px;line-height:1.4}' +
  '#ssh-jr .jr-row.hd{padding:3px 4px;border-top:0;background:#212323;font-weight:bold;color:#fff}' +
  '#ssh-jr .jr-ic{flex:0 0 16px;line-height:0}#ssh-jr .jr-dt{flex:0 0 130px}#ssh-jr .jr-msg{flex:1;min-width:0}';

const HEAD = 'img[src*="header_loghistory"], img[src*="header_ignorelist"], img[src*="header_msgoutbox"]';
export const isJournal = () => !!document.querySelector(HEAD);

// A faction invitation says "You can accept or decline on the Join a Faction page", as plain text: the page's name becomes a link to it
// (with the page's token). It is done in the game's own table, so both layouts have it.
function linkInvitations() {
  document.querySelectorAll('td.log').forEach((td) => {
    if (!/You have been invited to [\s\S]*Join a Faction page/i.test(td.textContent) || td.querySelector('a[data-ssh-join]')) return;
    const walk = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
    let found = null; // the last one: a faction's name stands before the page's
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const i = n.data.lastIndexOf('Join a Faction');
      if (i >= 0) found = [n, i];
    }
    if (!found) return;
    const name = found[0].splitText(found[1]);
    name.splitText('Join a Faction'.length);
    const a = mel('a');
    a.href = withToken('index.php?cmd=guild&subcmd=join');
    a.dataset.sshJoin = '1';
    name.replaceWith(a);
    a.append(name);
  });
}

// "You have been invited to X. You can accept or decline..." and "You have officially joined the faction X.": the faction's name
// becomes a link to its page. The message has no number for it: until the number is found (core/factions.js), and if it is not, the link
// goes to the faction list searched for the name.
const NAMED = [/^(\s*You have been invited to )(.+?)\. You can accept or decline/, /^(\s*You have officially joined the faction )(.+?)\.\s*$/];

function linkFactionNames() {
  document.querySelectorAll('td.log').forEach((td) => {
    const node = td.firstChild;
    if (!node || node.nodeType !== 3) return; // the name is in the message's first text (a link already there: done before)
    const m = NAMED.map((r) => node.data.match(r)).find(Boolean);
    if (!m) return;
    const name = m[2];
    const text = node.splitText(m[1].length);
    text.splitText(name.length);
    const a = mel('a');
    a.href = withToken('index.php?cmd=guild&subcmd=atoz&search_text=' + encodeURIComponent(name));
    a.dataset.sshFaction = name;
    text.replaceWith(a);
    a.append(text);
    factionIdFor(name).then((id) => {
      if (!id) return;
      // this link and its copy in the Modern layout's rows
      document.querySelectorAll('a[data-ssh-faction]').forEach((l) => { if (l.dataset.sshFaction === name) l.href = withToken('index.php?cmd=guild&subcmd=view&guild_id=' + id); });
    });
  });
}

// "Player Name activated the skill Strike (Level: 10) on you.": the player's name becomes a link, and the skill's name gets a dotted line
// and the skill's tooltip, with the values of that level (tooltips/tips.js adds them to an element marked with the skill's number).
const BUFF = /^(\s*Player )(\S+)( activated the skill )(.+?)( \(Level: (\d+)\) on you\.?\s*)$/;

// the skill's number by its name ("0": known by name only, as the stims' skills are)
const skillId = (name) => (Object.entries({ ...DATA.skills, ...store.get('skills', {}) }).find(([, s]) => s.n.toLowerCase() === name.toLowerCase()) || ['0'])[0];

function skillMark(name, level) {
  if (!skillByName(name)) return name; // nothing is known about it: left as text
  const s = mel('span');
  s.textContent = name;
  s.dataset.tipskill = skillId(name);
  s.dataset.sshSkill = name;
  s.dataset.sshLevel = level;
  s.style.cssText = 'text-decoration:underline dotted;text-underline-offset:3px;cursor:help';
  return s;
}

// the names whose numbers are not known yet are looked for one after the other, each once
async function findPlayers(names) {
  for (const name of names) {
    const id = await idFor(name);
    // this name's links and their copies in the Modern layout's rows
    if (id) document.querySelectorAll('a[data-ssh-player]').forEach((a) => { if (a.dataset.sshPlayer === name) a.href = withToken('index.php?cmd=profile&player_id=' + id); });
  }
}

function linkBuffs() {
  const unknown = new Set();
  document.querySelectorAll('td.log').forEach((td) => {
    const node = td.firstChild;
    const m = node && node.nodeType === 3 && node.data.match(BUFF);
    if (!m) return;
    const a = mel('a');
    a.textContent = m[2];
    a.dataset.sshPlayer = m[2];
    const id = knownId(m[2]);
    if (id) a.href = withToken('index.php?cmd=profile&player_id=' + id);
    else unknown.add(m[2]);
    node.replaceWith(m[1], a, m[3], skillMark(m[4], m[6]), m[5]);
  });
  if (unknown.size) findPlayers(unknown);
  // one listener for the marks of both layouts (the Modern layout's rows are copies, which would not keep their own)
  document.addEventListener('mouseover', (e) => {
    const s = e.target && e.target.closest && e.target.closest('[data-ssh-skill]');
    if (s && typeof window.Tip === 'function') window.Tip('<center><b>' + esc(s.dataset.sshSkill) + '</b> (Level: ' + s.dataset.sshLevel + ')</center>');
  });
}

// The entries of the Journal: one row each (the game's table has two more empty rows after every entry).
function entries(table, copy) {
  const list = mel('div', 'jr-list');
  const hd = mel('div', 'jr-row hd');
  hd.append(mel('div', 'jr-ic'), mel('div', 'jr-dt', 'Date'), mel('div', 'jr-msg', 'Message'));
  list.append(hd);
  table.querySelectorAll('td.log').forEach((m) => {
    const tr = m.parentElement;
    const row = mel('div', 'jr-row');
    const ic = mel('div', 'jr-ic');
    const im = tr.querySelector('img');
    if (im) ic.append(copy(im));
    const dt = mel('div', 'jr-dt');
    dt.append(...[...tr.cells[1].childNodes].map(copy));
    const msg = mel('div', 'jr-msg');
    msg.append(...[...m.childNodes].map(copy));
    row.append(ic, dt, msg);
    list.append(row);
  });
  return list;
}

export function initJournal() {
  const head = document.querySelector(HEAD);
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-jr')) return;
  linkFactionNames(); // before the page's name: it needs the message's text in one piece
  linkInvitations();
  linkBuffs();
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const root = steelContainer({ header: https(new URL(head.getAttribute('src'), location.href).href) });
  root.id = 'ssh-jr';
  const copy = (n) => {
    const c = n.cloneNode(true);
    if (c.nodeType === 1) c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
    return c;
  };
  const cell = table.rows[1] && table.rows[1].cells[0];
  const top = mel('div', 'jr-top');
  root.body.append(top);
  [...(cell ? cell.children : [])].forEach((n) => {
    if (n.tagName === 'P') top.append(copy(n));
    else if (n.tagName === 'FORM') root.body.append(copy(n));
    else if (n.tagName === 'TABLE' && n.querySelector('td.log')) root.body.append(entries(n, copy)); // the Journal
    else if (n.tagName === 'TABLE') { // the Ignore List
      n.setAttribute('data-tg-trim', '1');
      root.body.append(tableToDivs(n));
    }
  });
  table.setAttribute('data-ssh-jr', '1');
  table.after(root);
}
