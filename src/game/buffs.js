import { refreshLive } from '../layout/live.js';
import { refreshDur } from '../banner.js';
import { mModal } from '../layout/modal.js';
import { fetchDoc, fetchText } from '../core/net.js';

// An active skill's picture (Active Buffs under the world map, the buffs of the Data Sheet) takes the skill off when it is clicked.
// The game does it with a form on the Data Sheet only (and the Modern page's copy of that form ends on the home page without taking the
// skill off), and not at all under the map. Here both do what the Skills box on the right does when an active skill is clicked: the game's
// own background request (fetchdata.php), after the game's own question. The Skills box is on every page, so it is the one way.
const ID = /\/skills\/(\d+)_small\.gif/;

function buffImg(t) {
  const img = t && typeof t.closest === 'function' ? t.closest('img') : null;
  if (!img || img.closest('#skillBoxData') || !ID.test(img.getAttribute('src') || '')) return null;
  if (!/\(Level:/.test(img.getAttribute('onmouseover') || '')) return null; // a buff's tooltip: "Name (Level: N)"
  return img;
}

const gone = (id) => document.querySelectorAll('img[src*="/skills/' + id + '_small.gif"]').forEach((img) => {
  if (img.closest('#skillBoxData') || !/\(Level:/.test(img.getAttribute('onmouseover') || '')) return;
  const cell = img.closest('.bf, .wp-i') || img.closest('td, form') || img; // the picture with its timer
  cell.remove();
});

// The buffs that are not in the Skills box (a stim, say) have only the Data Sheet's form: its fields are sent in the background, and the
// Data Sheet is read again to see that the buff is gone.
const formOf = (doc, id) => [...doc.querySelectorAll('form')].find((f) => f.elements.namedItem('subcmd') && f.elements.namedItem('subcmd').value === 'removeskill' && f.elements.namedItem('skill_id') && f.elements.namedItem('skill_id').value === id);

async function removeByForm(id) {
  const f = formOf(document, id) || formOf(await fetchDoc('index.php?cmd=profile'), id);
  if (!f) return;
  const body = new FormData();
  [...f.elements].forEach((e) => { if (e.name && e.type !== 'submit' && e.type !== 'button') body.append(e.name, e.value); });
  await fetchText('index.php', { method: 'POST', body });
  if (!formOf(await fetchDoc('index.php?cmd=profile'), id)) { gone(id); refreshLive(); refreshDur(0); }
}

async function run(id) {
  const box = () => document.querySelector('#skillBoxData a[data-mode="remove"][data-skill="' + id + '"]');
  const a = box();
  if (!a) { await removeByForm(id); return; }
  a.click();
  // the game redraws the box when it has answered: the skill is off when its "remove" box is gone
  for (let n = 0; n < 40; n++) {
    await new Promise((r) => setTimeout(r, 250));
    if (!box()) { gone(id); refreshLive(); refreshDur(0); return; }
  }
}

// The question is the helper's own dialog (the game's own question looks like the game's, not like the rest of the helper).
function remove(id) {
  const body = document.createElement('div');
  body.textContent = 'Remove this skill?';
  mModal('Remove skill', body, [{ text: 'Cancel' }, { text: 'Remove', fn: () => run(id) }]);
}

// The time left under a buff ("62m 54s") runs down by the second, on the Data Sheet and under the map (the game writes it once, when the
// page is made). A buff's end is worked out when its text is first seen; a page built again from the game's old text (after a move) has
// the same text for the same buff, so it gets the same end.
const TIME = /^\s*(?:(\d+)m\s*)?(\d+)s\s*$/;
const ends = new Map(); // skill id + the text first seen -> the time it ends
function tick() {
  const now = Date.now();
  document.querySelectorAll('.bf, .wp-i').forEach((c) => {
    const img = c.querySelector('img[src*="_small.gif"]');
    const id = img && (img.getAttribute('src').match(ID) || [])[1];
    if (!id) return;
    let t = null;
    for (const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); w.nextNode();) if (TIME.test(w.currentNode.nodeValue)) t = w.currentNode; // in a <font>
    if (!t) return;
    const text = t.nodeValue;
    const key = id + '|' + (c.dataset.sshK || text.trim());
    c.dataset.sshK = c.dataset.sshK || text.trim();
    if (!ends.has(key)) { const m = TIME.exec(text); ends.set(key, now + ((+m[1] || 0) * 60 + +m[2]) * 1000); }
    const left = Math.max(0, Math.round((ends.get(key) - now) / 1000));
    if (!left) { c.remove(); return; }
    const out = (left >= 60 ? Math.floor(left / 60) + 'm ' : '') + (left % 60) + 's';
    if (t.nodeValue.trim() !== out) t.nodeValue = out;
  });
}

export function bindBuffs() {
  setInterval(tick, 1000);
  document.addEventListener('click', (e) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const img = buffImg(e.target);
    if (!img) return;
    const id = img.getAttribute('src').match(ID)[1];
    e.preventDefault();
    e.stopPropagation();
    remove(id);
  }, true);
  const st = document.createElement('style');
  st.textContent = 'img[src*="_small.gif"][onmouseover*="(Level:"]{cursor:pointer}';
  document.head.append(st);
}
