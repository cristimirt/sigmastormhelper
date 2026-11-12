import { esc } from '../core/util.js';

// The game's fight page (the two combatants, the combat log and what was won), as divs, for the combat details pop-up: the finished fight
// (final hit points and ammo, the whole log, the victory / defeat marks) without the two links of the page. The game's page is a set of nested
// tables; the pictures and the places they are drawn at are the same (measured on the page). `c` comes from parseCombat (combat.js): the
// numbers and the log, and `c.look` (the pictures of the combatants and the lines of what was gained).
// The frame pictures are the game's own, from its CDN.

const CDN = 'https://cdn.sigmastorm.com/combat/';
const BAR = 189; // the height of a bar (hit points / ammo) when it is full

const CSS = '#ssh-pop .box.cbv-box{width:auto;max-width:96vw}#ssh-pop .box.cbv-box .pb{padding:0;background:#000}' +
  '.cbv{position:relative;width:631px;height:611px;margin:0 auto;font:10.67px tahoma,sans-serif;color:#fff}' +
  '.cbv .cd{position:absolute;left:0;width:248px;height:280px;background-repeat:no-repeat}' +
  '.cbv .cd.def{top:0;background-image:url(' + CDN + 'defender_bg.jpg)}.cbv .cd.att{top:331px;background-image:url(' + CDN + 'attacker_bg.jpg)}' +
  '.cbv .vs{position:absolute;left:0;top:280px;width:248px;height:51px;background:url(' + CDN + 'vs_bg.jpg) no-repeat}' +
  '.cbv .nm{position:absolute;left:20px;width:208px;height:13px;text-align:center;color:#000;white-space:nowrap;overflow:hidden}' +
  '.cbv .def .nm{top:25.5px}.cbv .att .nm{top:241px}' +
  '.cbv .tx{position:absolute;width:88px;height:12px;text-align:center;font-size:10px;color:#fff;line-height:12px}' +
  '.cbv .def .tx{top:258px}.cbv .att .tx{top:9.5px}.cbv .tx.h{left:11px}.cbv .tx.a{left:154px}' +
  '.cbv .bar{position:absolute;width:9px;height:' + BAR + 'px;overflow:hidden}' +
  '.cbv .bar img{display:block;position:absolute;left:0;width:9px}' +
  '.cbv .def .bar{top:54px}.cbv .def .bar img{top:0}.cbv .att .bar{top:36.5px}.cbv .att .bar img{bottom:0}' + // the game draws the opponent's bars from the top, the player's from the bottom
  '.cbv .def .bar.h{left:6px}.cbv .def .bar.a{left:232px}.cbv .att .bar.h{left:7px}.cbv .att .bar.a{left:233px}' +
  '.cbv .por{position:absolute;width:200px;height:200px;overflow:hidden;background-repeat:no-repeat}' +
  '.cbv .def .por{left:23.3px;top:49px;width:197px}.cbv .att .por{left:24px;top:32.5px}' +
  '.cbv .por .w{position:absolute;left:0;top:0;width:50px;height:200px;background-repeat:no-repeat}' +
  '.cbv .por .b{position:absolute;left:50px;top:0;width:150px;height:200px;background-repeat:no-repeat}' +
  '.cbv .por .mk{position:absolute;left:49px;top:49px;width:100px;height:100px}' +
  '.cbv .att .por .mk{left:50px}' +
  '.cbv .wires{position:absolute;left:248px;top:0;width:37px;height:112px}' +
  '.cbv .lg{position:absolute;left:285px;top:0;width:346px;height:451px}' +
  '.cbv .lg .hd{height:52px;background:url(' + CDN + 'combat_header.jpg) no-repeat}' +
  '.cbv .lg .bd{height:347px;background:url(' + CDN + 'combatlogbg.gif)}' +
  '.cbv .lg .ft{height:52px;background:url(' + CDN + 'combatlog_footer.gif) no-repeat}' +
  '.cbv .lg .tx2{position:absolute;left:23px;top:54px;width:300px;height:330px;overflow:auto;text-align:center;scrollbar-width:thin;scrollbar-color:#888 #000}' +
  '.cbv .rw{position:absolute;left:285px;top:451px;width:346px;padding-top:22px;text-align:center;font-size:13px;font-weight:bold;line-height:16px}';

function ensureCss() {
  if (document.getElementById('ssh-cbv-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-cbv-css';
  s.textContent = CSS;
  document.head.append(s);
}

const px = (n) => Math.round(n * 10) / 10;
const bg = (u) => esc("url('" + u.replace(/'/g, '%27') + "')"); // used inside a style="..." attribute

// One combatant's card: i = 0 the player (below), 1 the opponent (above).
function card(c, i, mark) {
  const look = c.look;
  const ratio = (cur, max) => (max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0);
  const bar = (cls, img, r) => '<div class="bar ' + cls + '"><img src="' + CDN + img + '" style="height:' + px(BAR * r) + 'px" alt=""></div>';
  let por;
  if (i === 0) {
    const layers = look.layers.map(bg).join(',');
    por = '<div class="por" style="background-image:' + (look.realm ? bg(look.realm) : 'none') + '">' +
      '<div class="w" style="background-image:' + (look.weapon ? bg(look.weapon) : 'none') + '"></div>' +
      '<div class="b" style="background-image:' + (layers || 'none') + '"></div>' + mark + '</div>';
  } else {
    por = '<div class="por" style="background-image:' + (look.creature ? bg(look.creature) : 'none') + '">' + mark + '</div>';
  }
  return '<div class="cd ' + (i === 0 ? 'att' : 'def') + '">' +
    '<div class="nm">' + esc(c.name[i] || '') + '</div>' + por +
    bar('h', 'health.gif', ratio(c.fhp[i], c.startHP[i])) + bar('a', 'ammo.gif', ratio(c.fammo[i], c.startAmmo[i])) +
    '<div class="tx h">' + c.fhp[i] + ' / ' + c.startHP[i] + '</div><div class="tx a">' + c.fammo[i] + ' / ' + c.startAmmo[i] + '</div></div>';
}

// The finished fight as an element, or null when the fight page did not have what is needed (the caller shows the plain text log then).
export function combatView(c) {
  if (!c || !c.look || !c.look.layers) return null;
  ensureCss();
  const win = c.winner === 0 ? 0 : c.winner > 0 ? 1 : -1; // who won: the player (0), the opponent (1), nobody (-1)
  const mk = (i) => (win < 0 ? '' : '<img class="mk" src="' + CDN + (win === i ? 'victory.gif' : 'defeat.gif') + '" alt="">');
  const lines = (c.report || []).map((t, k, all) => {
    const last = k === all.length - 1;
    const col = last ? '#FFE3C5' : c.color[1 - (k % 2)] || '#F3EEE9'; // the game colours a line by the side that was hit: 1 - stage % 2
    return '<div style="color:' + esc(col) + (last ? ';font-weight:bold' : '') + '">' + esc(t) + '</div>';
  }).join('');
  const gains = (c.gains || []).map((g) => '<div style="color:' + esc(g.c) + '">' + esc(g.t) + '</div>').join('') +
    (c.items || []).map((it) => '<div style="color:#97D6E2">' + esc(c.name[0] || 'You') + ' looted the item \'<span style="color:' + esc(it.color) + '">' + esc(it.name) + '</span>\'</div>').join('');
  const v = document.createElement('div');
  v.className = 'cbv';
  v.innerHTML = card(c, 1, mk(1)) + '<div class="vs"></div>' + card(c, 0, mk(0)) +
    '<img class="wires" src="' + CDN + 'wires.gif" alt="">' +
    '<div class="lg"><div class="hd"></div><div class="bd"></div><div class="ft"></div></div>' +
    '<div class="lg" style="height:auto"><div class="tx2">' + lines + '</div></div>' +
    '<div class="rw">' + gains + '</div>';
  return v;
}
