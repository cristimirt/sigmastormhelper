// Live sidebar: every 10 seconds (the same as the game's global chat), while the tab is the one in front, the character page is
// read once and the banner (HP, energy, Skill Power ...) and the faction chat of the page are brought up to date from it.
// The faction chat form is sent in the background (no page reload) and the chat is read again right after.
import { refreshDur, updateHeader } from '../banner.js';
import { renderStairs, setLevelFrom } from '../game/stairs.js';
import { pageParts } from '../core/page.js';
import { S } from '../core/state.js';
import { alertModal, gAlerts } from './modal.js';
import { parseHtml } from '../core/util.js';
import { fetchText } from '../core/net.js';

const EVERY = 10000;
let timer = 0;
let busy = false;
let last = 0;

const rowOf = (el) => el && el.closest('.dr, tr');

// The rows of the chat: the rows before the input's row that hold the name of a player and what was said.
function chatRows(root) {
  const input = root.querySelector('input[name="msg"]');
  const mine = rowOf(input);
  if (!mine) return null;
  const rows = [...mine.parentNode.children].filter((r) => r !== mine && r.querySelector('a[href*="player_id"]') && r.querySelector('font'));
  return { mine, rows };
}

// The chat of the page becomes the chat of the fetched one (the input row, and what is typed in it, stay).
function updateChat(doc) {
  const cur = chatRows(document);
  const nxt = chatRows(doc);
  if (!cur || !nxt) return;
  const key = (rows) => rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()).join('|');
  if (key(cur.rows) === key(nxt.rows)) return;
  cur.rows.forEach((r) => r.remove());
  nxt.rows.forEach((r) => {
    let row;
    if (cur.mine.classList.contains('dr')) { // the Modern layout: the table rows are divs
      row = document.createElement('div');
      row.className = 'dr';
      const c = document.createElement('div');
      c.className = 'dc';
      c.style.cssText = 'padding:0;text-align:left';
      c.innerHTML = r.querySelector('td').innerHTML;
      row.append(c);
    } else {
      row = document.importNode(r, true);
    }
    cur.mine.parentNode.insertBefore(row, cur.mine);
  });
}

// The banner is not replaced while the pointer is on it (its tooltip would vanish) or while the map is doing something.
export async function refreshLive() {
  if (busy) return;
  busy = true;
  const t0 = Date.now();
  try {
    const html = await fetchText('index.php?cmd=profile');
    const doc = parseHtml(html);
    const p = pageParts();
    const hovered = p && p.header && p.header.matches(':hover');
    if (!S.busy && !hovered && !(S.hdrT > t0)) updateHeader(html);
    updateChat(doc);
    if (setLevelFrom(html)) renderStairs(); // a new level opens the stairs that were red
    last = Date.now();
  } catch (e) { /* offline or logged out: next time */ }
  busy = false;
}

function tick() {
  if (document.visibilityState === 'visible') refreshLive();
}

// Enter or the Send button of the faction chat: the same request, in the background.
async function sendChat(form) {
  const input = form.elements.namedItem('msg');
  if (!input || !input.value.trim() || input.disabled) return;
  const body = new URLSearchParams(new FormData(form));
  input.disabled = true;
  try {
    const res = await fetch(new URL(form.getAttribute('action') || 'index.php', location.href).href, { method: 'POST', body, credentials: 'same-origin' });
    const doc = parseHtml(await res.text());
    // the game's "Message sent to faction chat!" is not shown; any other message (an error) is, and the text stays in the box
    const alerts = gAlerts(doc).filter((a) => !/message sent/i.test(a.textContent));
    if (alerts.length) alertModal(alerts);
    else input.value = '';
  } catch (e) {
    // the text stays in the box, to send again
  }
  input.disabled = false;
  input.focus();
  refreshLive();
}

// A skill used from the Skills widget changes health, energy and gear: read them again once the game has answered.
function bindSkills() {
  document.addEventListener('click', (e) => {
    if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('#skillBoxData')) return;
    [1200, 3500].forEach((ms) => setTimeout(() => { refreshLive(); refreshDur(0); }, ms));
  }, true);
}

export function initLive() {
  bindSkills();
  if (!S.cfg.live || timer || !pageParts()) return;
  timer = setInterval(tick, EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - last > EVERY) refreshLive();
  });
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!f || !f.elements || !f.elements.namedItem('subcmd') || f.elements.namedItem('subcmd').value !== 'dochat' || !f.elements.namedItem('from_rhs')) return;
    e.preventDefault();
    sendChat(f);
  }, true);
}
