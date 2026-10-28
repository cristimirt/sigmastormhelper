import { grabVars } from '../banner.js';
import { S } from '../core/state.js';
import { esc } from '../core/util.js';
import { read, show, swapIn } from './loading.js';

export const isSep = (tr) => tr.classList.contains('ssh-mech') || tr.cells.length === 1 && tr.cells[0].colSpan === 3 && tr.cells[0].hasAttribute('bgcolor');

// Put the finished fights back into the action list, in the slot where the creature was.
export function placeResults(bd) {
  if (!S.results.length) { numberSlots(bd); return; }
  let tb = bd.querySelector('tbody');
  if (!tb) {
    bd.innerHTML = '<table><tbody></tbody></table>';
    tb = bd.querySelector('tbody');
  }
  [...S.results].sort((a, b) => a.pos - b.pos).forEach((r) => {
    const slots = [...tb.children].filter((tr) => !isSep(tr));
    const tr = document.createElement('tr');
    tr.className = 'ssh-resrow';
    if (r.quick) tr.dataset.q = '1'; // it was a numbered creature: its slot keeps its number
    tr.innerHTML = '<td colspan="3">' + r.html.replace('data-r="#"', 'data-r="' + S.results.indexOf(r) + '"') + '</td>';
    const sep = document.createElement('tr');
    sep.innerHTML = '<td colspan="3" height="1" bgcolor="#212323"></td>';
    const before = slots[r.pos] || null;
    if (before) { tb.insertBefore(tr, before); tb.insertBefore(sep, before); } else { tb.appendChild(tr); tb.appendChild(sep); }
  });
  numberSlots(bd);
}

// Attack hotkeys count the creatures that can be attacked with a key (Elite and Champion creatures and the like have none, as in the
// game), in the order of the list, and a finished fight keeps its row, so the creatures below it never change their number. The
// picture on the attack button says the same number as the key does (the game's own pictures go up to 8).
const ICON = (n) => 'icon_action_attack' + (n <= 8 ? '1_' + n : '3') + '.gif';
function numberSlots(bd) {
  const tb = bd.querySelector('tbody');
  if (!tb) return;
  let n = 0;
  [...tb.children].filter((tr) => !isSep(tr)).forEach((tr) => {
    if (tr.classList.contains('ssh-resrow')) { if (tr.dataset.q) n++; return; }
    const a = tr.querySelector('a[data-atk]');
    if (!a || a.getAttribute('data-atk') === 'x') return;
    n++;
    a.setAttribute('data-atk', String(n));
    const im = a.querySelector('img');
    if (im) im.setAttribute('src', im.getAttribute('src').replace(/[^/]*$/, '') + ICON(n));
  });
}

export function parseCombat(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sc = [...doc.scripts].map((t) => t.textContent).find((t) => /combat animator/.test(t));
  if (!sc) return null;
  const num = (n) => { const m = sc.match(new RegExp('var ' + n + '\\s*=\\s*(-?\\d+)')); return m ? parseInt(m[1], 10) : 0; };
  const str = (n) => { const m = sc.match(new RegExp('var ' + n + '\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"')); return m ? m[1] : ''; };
  const arr = (n) => { const o = []; for (const m of sc.matchAll(new RegExp('\\b' + n + '\\[(\\d+)\\]\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|(-?\\d+))', 'g'))) o[+m[1]] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : parseInt(m[3], 10); return o; };
  const c = {
    type: num('combatType'), winner: num('winner'), xp: num('xpGain'), gold: num('goldGain'), surge: num('surgeGain'), surgeName: str('surgeName'),
    tax: num('guildTaxGain'), level: num('levelUp'),
    name: arr('name'), startHP: arr('startHP'), hp: arr('currentHP'), startAmmo: arr('startAmmo'), ammo: arr('currentAmmo'),
    report: arr('report'), color: arr('reportColor'), items: [],
  };
  // Work out the final HP / ammo by replaying the fight stages (defender loses HP, attacker spends ammo).
  const dmg = arr('damage');
  const sh = arr('hp');
  const sa = arr('ammo');
  c.fhp = [c.hp[0], c.hp[1]];
  c.fammo = [c.ammo[0], c.ammo[1]];
  dmg.forEach((d, i) => {
    if (d === undefined) return;
    const att = (c.report[i] || '').indexOf(c.name[0] || '\u0000') === 0 ? 0 : 1;
    if (sh[i] !== undefined) c.fhp[1 - att] = sh[i];
    if (sa[i] !== undefined) c.fammo[att] = sa[i];
  });
  const item = doc.getElementById('itemDiv');
  if (item) {
    const names = [...item.innerHTML.matchAll(/looted the item '<font color="(#\w+)">([^<]+)<\/font>'/g)];
    const imgs = [...item.querySelectorAll('img[onmouseover*="ajaxLoadItem"]')];
    names.forEach((m, i) => {
      const a = ((imgs[i] && imgs[i].getAttribute('onmouseover')) || '').match(/ajaxLoadItem\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*'([^']*)'/);
      c.items.push({ color: m[1], name: m[2], tip: a ? a.slice(1, 6) : null });
    });
  }
  return c;
}

export function resultHtml(c) {
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const part = (label, n, extra) => '<span style="color:' + (n < 0 ? '#FF5a5a' : '#97D6E2') + '">' + label + ': ' + fmt(n) + (extra || '') + '</span>';
  const parts = [part('XP', c.xp), part('Gold', c.gold, c.tax > 0 ? ' [' + fmt(c.tax) + ']' : '')];
  if (c.surge) parts.push(part(esc(c.surgeName || 'Surge'), c.surge));
  if (c.level > 0) parts.push('<span style="color:#7fe08a">Level up!</span>');
  if (c.level < 0) parts.push('<span style="color:#FF5a5a">Level down!</span>');
  const outcome = c.winner === -1 ? 'Draw' : c.winner === 0 ? 'Victory' : 'Defeat';
  let h = '<div class="rs"><div class="rrow"><div class="ln" title="' + esc((c.name[1] || 'Entity') + ' - ' + outcome) + '">' + parts.join(', ') + '</div>' +
    '<a class="clog" data-r="#" title="Combat Log">&#9876;</a></div>';
  c.items.forEach((it) => {
    h += '<div class="loot">[<span class="itm" style="color:' + esc(it.color) + '" data-item="' + esc((it.tip || []).join('|')) + '">' + esc(it.name) + '</span>]</div>';
  });
  return h + '</div>';
}

// The rounds of a fight as HTML (used by the log window and the creature pop-up).
export function logBody(c) {
  const rows = (c.report || []).map((t, i, all) => {
    const last = i === all.length - 1;
    const mine = t.indexOf(c.name[0] || '\u0000') === 0;
    const col = last ? '#FFE3C5' : c.color[mine ? 0 : 1] || '#F3EEE9';
    return '<div style="color:' + col + (last ? ';font-weight:bold' : '') + '">' + esc(t) + '</div>';
  }).join('');
  const stat = (n, i) => '<div class="stat"><span>' + esc(n) + '</span><span>HP ' + c.fhp[i] + ' / ' + c.startHP[i] + (c.startAmmo[i] ? ' &nbsp; Ammo ' + c.fammo[i] + ' / ' + c.startAmmo[i] : '') + '</span></div>';
  return stat(c.name[0], 0) + stat(c.name[1], 1) + '<hr style="border:0;border-top:1px solid #333;margin:6px 0">' + rows;
}

export function openLog(r) {
  const c = r && r.log;
  if (!c) return;
  closeLog();
  const rows = (c.report || []).map((t, i, all) => {
    const last = i === all.length - 1;
    const mine = t.indexOf(c.name[0] || '\u0000') === 0;
    const col = last ? '#FFE3C5' : c.color[mine ? 0 : 1] || '#F3EEE9';
    return '<div style="color:' + col + (last ? ';font-weight:bold' : '') + '">' + esc(t) + '</div>';
  }).join('');
  const stat = (n, i) => '<div class="stat"><span>' + esc(n) + '</span><span>HP ' + c.fhp[i] + ' / ' + c.startHP[i] + (c.startAmmo[i] ? ' &nbsp; Ammo ' + c.fammo[i] + ' / ' + c.startAmmo[i] : '') + '</span></div>';
  const pop = document.createElement('div');
  pop.id = 'ssh-pop';
  pop.innerHTML = '<div class="box"><div class="ph"><div>Combat Log &ndash; ' + esc(c.name[0] || '') + ' vs ' + esc(c.name[1] || '') + '</div><span data-close="1" title="Close">&#10006;</span></div><div class="pb">' +
    stat(c.name[0], 0) + stat(c.name[1], 1) + '<hr style="border:0;border-top:1px solid #333;margin:8px 0">' + rows + '</div></div>';
  document.body.appendChild(pop);
}

export function closeLog() { const p = document.getElementById('ssh-pop'); if (p) p.remove(); }

S.results = [];

S.pending = 0;

S.refreshSeq = 0;

// Refresh the page state (stats, bag, creature list) once all running fights are done.
export async function refreshWorld() {
  const seq = ++S.refreshSeq;
  const url = new URL('index.php?cmd=world', location.href).href;
  const wtext = await (await fetch(url, { credentials: 'same-origin' })).text();
  grabVars(wtext);
  const doc = new DOMParser().parseFromString(wtext, 'text/html');
  if (S.pending || seq !== S.refreshSeq) return true; // another fight started meanwhile: that one will refresh
  const info = read(doc);
  if (!info.loc || !doc.getElementById('mapDiv') || !swapIn(doc)) return false;
  return show(info, { sy: window.scrollY });
}
