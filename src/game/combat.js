import { grabVars } from '../banner.js';
import { hotkeyOn, TYPE_COLOR, typeOf } from '../core/creatures.js';
import { fetchText, navigate } from '../core/net.js';
import { S } from '../core/state.js';
import { esc, fmt, parseHtml } from '../core/util.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { combatView } from './combatview.js';
import { read, show, swapIn } from './loading.js';

export const isSep = (row) => row.classList.contains('ssh-mech') || row.classList.contains('sep');

// A row of the list (a div) shows the result of a fight, over its whole width.
export function fillResult(row, html) {
  row.className = 'r ssh-resrow';
  row.removeAttribute('style');
  row.innerHTML = '<div class="c full"><div class="w">' + html + '</div></div>';
}

// Put the finished fights back into the action list, in the slot where the creature was.
export function placeResults(bd) {
  if (!S.results.length) { numberSlots(bd); return; }
  let tb = bd.querySelector('.al');
  if (!tb) {
    bd.innerHTML = '<div class="al"></div>';
    tb = bd.querySelector('.al');
  }
  [...S.results].sort((a, b) => a.pos - b.pos).forEach((r) => {
    const slots = [...tb.children].filter((tr) => !isSep(tr));
    const tr = document.createElement('div');
    fillResult(tr, r.html.replace('data-r="#"', 'data-r="' + S.results.indexOf(r) + '"'));
    if (r.quick) tr.dataset.q = '1'; // it was a numbered creature: its slot keeps its number
    const sep = document.createElement('div');
    sep.className = 'r sep';
    sep.innerHTML = '<div class="c full" style="background:#212323;height:1px"><div class="w"></div></div>';
    const before = slots[r.pos] || null;
    if (before) { tb.insertBefore(tr, before); tb.insertBefore(sep, before); } else { tb.appendChild(tr); tb.appendChild(sep); }
  });
  numberSlots(bd);
}

// The names of the special creatures get a colour: (Champion) silver, (Elite) yellow, (HK) red, (Behemoth) purple. Normal ones stay as they are.
function colorNames(tb) {
  if (S.cfg.creatureColors === false) return;
  [...tb.children].filter((tr) => !isSep(tr) && !tr.classList.contains('ssh-resrow')).forEach((tr) => {
    [...tr.children].forEach((td) => {
      if (td.querySelector('.ssh-ct, .c')) return;
      const m = td.textContent.replace(/\s+/g, ' ').trim().match(/(?:\((Champion|Elite|HK|Behemoth)\)|(?:^|\s)(HK))$/i);
      if (!m) return;
      const col = TYPE_COLOR[(m[1] || m[2]).toLowerCase()];
      if (!tr.dataset.kindBar) { // a faint tint behind the row, in the colour of the kind
        tr.dataset.kindBar = '1';
        tr.style.background = 'rgba(' + [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16)).join(',') + ',.14)';
      }
      const w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
      const nodes = [];
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) nodes.push(n);
      nodes.forEach((n) => {
        const sp = document.createElement('span');
        sp.className = 'ssh-ct';
        sp.style.color = col;
        sp.style.fontWeight = 'bold';
        n.replaceWith(sp);
        sp.append(n);
      });
    });
  });
}

// Attack hotkeys count the creatures that can be attacked with a key (Elite and Champion creatures and the like have none, as in the
// game), in the order of the list, and a finished fight keeps its row, so the creatures below it never change their number. The
// picture on the attack button says the same number as the key does (the game's own pictures go up to 8).
const ICON = (n) => 'icon_action_attack' + (n <= 8 ? '1_' + n : '3') + '.gif';
function numberSlots(bd) {
  const tb = bd.querySelector('.al');
  if (!tb) return;
  colorNames(tb);
  let n = 0;
  [...tb.children].filter((tr) => !isSep(tr)).forEach((tr) => {
    if (tr.classList.contains('ssh-resrow')) { if (tr.dataset.q) n++; return; }
    const a = tr.querySelector('a[data-atk]');
    if (!a) return;
    // the settings say which kinds of creature have a key (the game gives one to the normal ones and to HK, not to Champion, Elite and
    // Behemoth creatures): the name says the kind. A creature without a key is attacked with a click, and the numbers go on without it.
    const nm = [...tr.children].map((td) => td.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' '); // the creature's name is plain text in the row (its links are pictures)
    const kind = typeOf(nm);
    const want = kind ? hotkeyOn(S.cfg, kind) : a.getAttribute('data-atk') !== 'x';
    if (!want) {
      if (a.getAttribute('data-atk') !== 'x') {
        a.setAttribute('data-atk', 'x');
        const im0 = a.querySelector('img');
        if (im0) im0.setAttribute('src', im0.getAttribute('src').replace(/[^/]*$/, '') + ICON(9));
      }
      return;
    }
    n++;
    a.setAttribute('data-atk', String(n));
    const im = a.querySelector('img');
    if (im) im.setAttribute('src', im.getAttribute('src').replace(/[^/]*$/, '') + ICON(n));
  });
}

// What the fight page says when the fight is over (its script writes the lines into the page, so they are not in the page's markup): the lines
// of what was gained or lost, as { t: text, c: colour }, with the game's wording and colours.
function gainsOf(c, stolen, rating, leader, members) {
  const B = '#97D6E2';
  const R = '#FF3D3D';
  const out = [];
  const add = (t, col) => out.push({ t, c: col });
  const abs = Math.abs;
  if (c.type === 0) {
    if (c.xp > 0) add('You gain ' + c.xp + ' experience.', B);
    if (c.xp < 0) add('You lost ' + abs(c.xp) + ' experience.', R);
    if (c.gold > 0) add('You take ' + c.gold + ' credits from the entity.', B);
    if (c.gold < 0) add('You lost ' + abs(c.gold) + ' credits from the defeat.', R);
    if (c.tax > 0) add('Faction tax deducted ' + c.tax + ' credits to the faction bank.', B);
    if (c.level > 0) add('Your level has increased!', B);
    if (c.level < 0) add('Your level has decreased!', R);
    if (c.surge > 0) add('You gain ' + c.surge + ' ' + c.surgeName + '.', B);
  } else if (c.type === 1) {
    const n = c.name;
    if (c.xp > 0) add(n[1] + ' lost ' + abs(c.xp) + ' experience.', R);
    if (c.level < 0) add(n[1] + "'s level has decreased!", R);
    if (c.gold > 0) add(n[1] + ' lost ' + abs(c.gold) + ' credits of which ' + n[0] + ' stole ' + abs(stolen) + ' credits', R);
    if (c.gold < 0) add(n[0] + ' lost ' + abs(c.gold) + ' credits of which ' + n[1] + ' snatched ' + abs(stolen) + ' credits (this was due to an activated Snatch skill.)', R);
    if (rating !== 0) add(n[c.winner] + ' gained PvP rating of ' + rating + '.', R);
  } else if (c.type === 2) {
    if (c.xp > 0) {
      add('Group Leader (' + leader + ') gained ' + Math.ceil(c.xp * 0.5) + ' xp.', R);
      add('All other group members (' + members + ') gained ' + Math.ceil(c.xp * 0.1) + ' xp.', '#B9DCC9');
    }
    if (c.gold > 0) add('Faction gained ' + abs(c.gold) + ' credits.', '#FFDDBB');
  }
  return out;
}

// The pictures of the fight page (for the details pop-up, see combatview.js): the opponent's picture, the player's (a realm background, a weapon, and
// the layers of the worn gear: the nested tables of the page, innermost = on top). Null when the page is not as known.
function readLook(doc) {
  try {
    const s0 = doc.getElementById('side_0');
    const s1 = doc.getElementById('side_1');
    if (!s0 || !s1) return null;
    const abs = (u) => (u ? new URL(u, location.href).href : '');
    const urlOf = (el) => abs(el && (el.getAttribute('background') || ((el.getAttribute('style') || '').match(/url\(["']?([^)"']*)["']?\)/) || [])[1]));
    const layers = [];
    let realm = null;
    for (let e = s0.parentElement; e && e !== doc.body; e = e.parentElement) {
      const b = e.getAttribute('background');
      if (!b || (e.tagName !== 'TABLE' && e.tagName !== 'TD')) continue;
      if (e.tagName === 'TABLE' && /realms/.test(b)) { realm = e; break; }
      layers.push(abs(b));
    }
    if (!realm) return null;
    const weapon = [...realm.querySelectorAll('td[background]')].find((td) => !td.contains(s0));
    return {
      creature: urlOf(s1.closest('td')),
      realm: abs(realm.getAttribute('background')),
      weapon: weapon ? abs(weapon.getAttribute('background')) : '',
      layers,
    };
  } catch (e) {
    return null;
  }
}

export function parseCombat(html) {
  const doc = parseHtml(html);
  const sc = [...doc.scripts].map((t) => t.textContent).find((t) => /combat animator/.test(t));
  if (!sc) return null;
  const intVar = (n) => { const m = sc.match(new RegExp('var ' + n + '\\s*=\\s*(-?\\d+)')); return m ? parseInt(m[1], 10) : 0; };
  const str = (n) => { const m = sc.match(new RegExp('var ' + n + '\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"')); return m ? m[1] : ''; };
  const arr = (n) => { const o = []; for (const m of sc.matchAll(new RegExp('\\b' + n + '\\[(\\d+)\\]\\s*=\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|(-?\\d+))', 'g'))) o[+m[1]] = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : parseInt(m[3], 10); return o; };
  const c = {
    type: intVar('combatType'), winner: intVar('winner'), xp: intVar('xpGain'), gold: intVar('goldGain'), surge: intVar('surgeGain'), surgeName: str('surgeName'),
    tax: intVar('guildTaxGain'), level: intVar('levelUp'),
    name: arr('combatNames').length ? arr('combatNames') : arr('name'), startHP: arr('startHP'), hp: arr('currentHP'), startAmmo: arr('startAmmo'), ammo: arr('currentAmmo'),
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
    const att = i % 2; // the game's own rule (side = 1 - stage % 2 is the one that is hit): the player attacks in the even stages
    if (sh[i] !== undefined) c.fhp[1 - att] = sh[i];
    if (sa[i] !== undefined) c.fammo[att] = sa[i];
  });
  c.hpLost = Math.max(0, (c.hp[0] || 0) - c.fhp[0]); // the hit points the player lost in the fight
  c.turns = dmg.reduce((n, d, i) => (d !== undefined && i % 2 === 0 ? n + 1 : n), 0); // how many times the player attacked
  if (c.type === 0 && c.startAmmo[0] > 0) S.weaponAmmo = { cur: c.fammo[0], max: c.startAmmo[0] }; // the ammo the weapon has after this fight
  c.look = readLook(doc);
  c.gains = gainsOf(c, intVar('goldStolen'), intVar('pvpRatingChange'), str('groupLeader'), str('groupMembers')); // the page writes these lines with a script once the fight is over
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

const CDN_SKIN = 'https://cdn.sigmastorm.com/skin/';

export function resultHtml(c) {
  // each figure is an icon (or XP) and a number, with a tooltip saying what it is
  const ico = (src) => '<img src="' + esc(src) + '" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:2px">';
  const part = (label, n, tip, extra) => '<span title="' + esc(tip) + '" style="cursor:help;color:' + (n < 0 ? '#FF5a5a' : '#97D6E2') + '">' + label + fmt(n) + (extra || '') + '</span>';
  const heart = '<svg viewBox="0 0 16 16" style="width:13px;height:13px;vertical-align:-2px;margin-right:2px"><path fill="#e0262e" d="M8 14.5S1 10 1 5.6C1 3.4 2.6 2 4.4 2c1.4 0 2.6.8 3.6 2.2C9 2.8 10.2 2 11.6 2 13.4 2 15 3.4 15 5.6 15 10 8 14.5 8 14.5z"/></svg>';
  const classIcon = (document.querySelector('img[src*="/skin/classes/"]') || {}).src;
  const parts = [part('XP ', c.xp, 'Experience'), part(ico(CDN_SKIN + 'gold_button.gif'), c.gold, 'Credits', c.tax > 0 ? ' [' + fmt(c.tax) + ']' : '')];
  if (c.surge) parts.push(part(classIcon ? ico(classIcon) : esc((c.surgeName || 'Surge') + ' '), c.surge, c.surgeName || 'Skill power'));
  parts.push('<span title="Hit points lost in the fight" style="cursor:help;color:' + (c.hpLost > 0 ? '#FF5a5a' : '#97D6E2') + '">' + heart + (c.hpLost > 0 ? '-' : '') + fmt(c.hpLost || 0) + '</span>',
    '<span title="Combat turns (how many times you attacked)" style="cursor:help;color:#97D6E2">&#8635; ' + (c.turns || 0) + '</span>');
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
  const view = combatView(c); // the fight as the game's page shows it, as divs
  pop.innerHTML = '<div class="box' + (view ? ' cbv-box' : '') + '"><div class="ph"><div>Combat Log &ndash; ' + esc(c.name[0] || '') + ' vs ' + esc(c.name[1] || '') + '</div><span data-close="1" title="Close">&#10006;</span></div><div class="pb">' +
    (view ? '' : stat(c.name[0], 0) + stat(c.name[1], 1) + '<hr style="border:0;border-top:1px solid #333;margin:8px 0">' + rows) + '</div></div>';
  if (view) pop.querySelector('.pb').append(view);
  document.body.appendChild(pop);
}

// The game answered an attack with a message instead of a fight (not enough energy, ...): show it in a dialog. False when there is none.
export function attackAlert(html) {
  const alerts = gAlerts(parseHtml(html));
  if (!alerts.length) return false;
  alertModal(alerts);
  return true;
}

export function closeLog() { const p = document.getElementById('ssh-pop'); if (p) p.remove(); }

S.results = [];

S.pending = 0;

S.refreshSeq = 0;

// The player lost the fight: the game takes them somewhere else on the map.
export const playerDied = (c) => c.winner > 0 || (c.winner !== 0 && c.fhp[0] <= 0);

S.died = false;

// All the running fights are done. The header (HP, XP, energy, credits) was updated from each answer and the finished fights keep their
// rows in the list (the list is only read again by the refresh icon or the R key); the gear, the bag and the supplies are read again by
// the live check (live.js), which is told to look. Only a defeat reads the world again: the player is somewhere else now.
export async function fightsDone() {
  if (S.pending) return;
  S.supDirty = true;
  if (!S.died) return;
  S.died = false;
  S.results = [];
  let ok = false;
  try { ok = await refreshWorld(); } catch (e) { ok = false; }
  if (!ok && !S.pending) navigate('index.php?cmd=world');
}

// Refresh the page state (stats, bag, creature list) once all running fights are done.
export async function refreshWorld() {
  const seq = ++S.refreshSeq;
  const url = new URL('index.php?cmd=world', location.href).href;
  const wtext = await fetchText(url);
  grabVars(wtext);
  const doc = parseHtml(wtext);
  if (S.pending || seq !== S.refreshSeq) return true; // another fight started meanwhile: that one will refresh
  const info = read(doc);
  if (!info.loc || !doc.getElementById('mapDiv') || !swapIn(doc)) return false;
  return show(info, { sy: window.scrollY });
}
