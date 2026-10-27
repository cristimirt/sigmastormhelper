import { S } from '../core/state.js';
import { esc, txt } from '../core/util.js';

const MAX_TURNS = 20; // a turn = one attack from each side, the player first

const fnum = (m) => (m ? parseFloat(m[1].replace(/,/g, '')) : NaN);

// Text of an element with a marker between cells, so "Attack:" and its value in the next cell still pair up.
function flat(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('td, th, br, tr, div').forEach((e) => e.insertAdjacentText('beforeend', ' \u00a6 '));
  c.querySelectorAll('script, style').forEach((e) => e.remove());
  return String(c.textContent).replace(/\s+/g, ' ');
}

function parseCreature(frame) {
  const t = flat(frame);
  const g = (k) => fnum(t.match(new RegExp('\\b' + k + ':[\\s\u00a6]*(-?[\\d,.]+)')));
  const res = {};
  for (const m of t.matchAll(/([A-Za-z]+):[\s\u00a6]*(-?[\d.]+)%/g)) res[m[1].toLowerCase()] = parseFloat(m[2]);
  const dt = t.match(/Damage Type:[\s\u00a6]*([A-Za-z]+)/);
  const enh = { ps: 0, mla: 0, crit: 0 };
  const em = (n) => { const m = t.match(new RegExp(n + ':[\\s\u00a6]*(\\d+(?:\\.\\d+)?)')); return m ? parseFloat(m[1]) : 0; }; // creatures list the percentage as a plain number
  enh.ps = em('Piercing Strike'); enh.mla = em('Multi-Layered Armor'); enh.crit = em('Critical Hit');
  return { atk: g('Attack'), def: g('Defense'), arm: g('Armor'), dmg: g('Damage'), hp: g('HP'), type: dt ? dt[1].toLowerCase() : '', res, enh };
}

// Player stats from the profile page, plus the damage type of the equipped weapon.
async function playerStats() {
  if (S.me && Date.now() - S.me.t < 30000) return S.me;
  const html = await (await fetch('index.php?cmd=profile', { credentials: 'same-origin' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const c = (doc.getElementById('mainContentDiv') || doc.body);
  const t = flat(c);
  const g = (k) => fnum(t.match(new RegExp('\\b' + k + ':[\\s\u00a6]*(-?[\\d,.]+)')));
  const hp = t.match(/\bHP:[\s\u00a6]*(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
  const res = {};
  c.querySelectorAll('img[src*="damagetypes/"]').forEach((img) => {
    const row = img.closest('table') && img.closest('table').closest('tr');
    if (!row) return;
    const name = txt(img.closest('table').textContent).replace(/:$/, '').toLowerCase();
    const tipEl = row.querySelector('[onmouseover*="Resistance"]');
    const m = tipEl && (tipEl.getAttribute('onmouseover') || '').match(/Resistance(?:<br>|&lt;br&gt;|&lt;br\/&gt;)\s*(-?[\d.]+)%/);
    if (name && m) res[name] = parseFloat(m[1]);
  });
  const enh = { ps: 0, mla: 0, crit: 0 };
  c.querySelectorAll('[onmouseover*="Skill"]').forEach((e) => {
    const m = (e.getAttribute('onmouseover') || '').match(/Skill(?:&nbsp;|&amp;nbsp;|\s)Level(?:<br>|&lt;br&gt;)\s*([\d.]+)%/);
    const row = e.closest('tr');
    if (!m || !row) return;
    const n = txt(row.textContent).split('[')[0].trim().toLowerCase();
    if (n === 'piercing strike') enh.ps = parseFloat(m[1]);
    else if (n === 'multi-layered armor') enh.mla = parseFloat(m[1]);
    else if (n === 'critical hit') enh.crit = parseFloat(m[1]);
  });
  let type = '';
  const eq = [];
  doc.querySelectorAll('[onmouseover*="ajaxLoadItem"]').forEach((e) => {
    const o = e.getAttribute('onmouseover') || '';
    const m = o.match(/ajaxLoadItem\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)/);
    if (m && /Unequip/.test(o)) eq.push(m);
  });
  await Promise.all(eq.map(async (m) => {
    const it = txt(await (await fetch('fetchitem.php?item_id=' + m[1] + '&inv_id=' + m[2] + '&t=' + m[3] + '&p=' + m[4] + '&uid=' + Date.now(), { credentials: 'same-origin' })).text());
    const d = it.match(/Weapon Type:\s*[A-Za-z ]*?Damage Type:\s*([A-Za-z]+)/) || it.match(/Weapon Data.*?Damage Type:\s*([A-Za-z]+)/);
    if (d && !type) type = d[1].toLowerCase();
  }));
  S.me = { t: Date.now(), atk: g('Attack'), def: g('Defense'), arm: g('Armor'), dmg: g('Damage'), hp: hp ? parseFloat(hp[1].replace(/,/g, '')) : NaN, maxHp: hp ? parseFloat(hp[2].replace(/,/g, '')) : NaN, type, res, enh };
  return S.me;
}

// Turn by turn: you hit only if your attack beats their defense; damage = (damage - armor) * (1 - resistance).
// Enhancements are rolled on every hit: Piercing Strike (attacker) cuts the target's armor by 25%, Multi-Layered Armor
// (defender) raises its own armor by 25%, Critical Hit doubles the damage of that hit.
function fight(me, cr, rnd) {
  const hitMe = cr.atk > me.def;
  const hitIt = me.atk > cr.def;
  const roll = (pc) => rnd && pc > 0 && rnd() * 100 < pc;
  const hitDmg = (dmg, arm, res, att, def) => {
    let a = arm;
    if (roll(att.ps)) a *= 0.75;
    if (roll(def.mla)) a *= 1.25;
    let d = Math.max(0, Math.round((dmg - a) * (1 - res / 100)));
    if (roll(att.crit)) d *= 2;
    return d;
  };
  const rIt = cr.res[me.type] || 0;
  const rMe = me.res[cr.type] || 0;
  let a = me.hp;
  let b = cr.hp;
  let ph = 0;
  let ch = 0;
  let turns = 0;
  while (turns < MAX_TURNS && a > 0 && b > 0) {
    turns++;
    if (hitIt) { b -= hitDmg(me.dmg, cr.arm, rIt, me.enh, cr.enh); ph++; }
    if (b <= 0) break;
    if (hitMe) { a -= hitDmg(cr.dmg, me.arm, rMe, cr.enh, me.enh); ch++; }
  }
  return { win: b <= 0, lose: b > 0 && a <= 0, turns, ph, ch, hp: Math.max(0, a), crHp: Math.max(0, b) };
}

function simulate(me, cr) {
  const none = { ps: 0, mla: 0, crit: 0 };
  const base = fight({ ...me, enh: none }, { ...cr, enh: none }, null);
  const hitMe = cr.atk > me.def;
  const hitIt = me.atk > cr.def;
  const dealt = Math.max(0, Math.round((me.dmg - cr.arm) * (1 - (cr.res[me.type] || 0) / 100)));
  const taken = Math.max(0, Math.round((cr.dmg - me.arm) * (1 - (me.res[cr.type] || 0) / 100)));
  const N = 3000;
  let w = 0; let l = 0; let t = 0; let hp = 0; let ph = 0; let ch = 0;
  for (let i = 0; i < N; i++) {
    const f = fight(me, cr, Math.random);
    if (f.win) w++; else if (f.lose) l++;
    t += f.turns; hp += f.hp; ph += f.ph; ch += f.ch;
  }
  const need = (h, d, ok) => (!ok || d <= 0 ? '-' : Math.ceil(h / d));
  return { hitIt, hitMe, dealt, taken, killIt: need(cr.hp, dealt, hitIt), killMe: need(me.hp, taken, hitMe), base: base.win ? 'Victory' : base.lose ? 'Defeat' : 'Unresolved', win: w / N * 100, lose: l / N * 100, draw: (N - w - l) / N * 100, turns: t / N, hpLeft: hp / N, ph: ph / N, ch: ch / N, resIt: cr.res[me.type] || 0, resMe: me.res[cr.type] || 0 };
}

function evalHtml(me, cr, o) {
  const sg = (n) => (n > 0 ? '+' : '') + n;
  const yn = (v) => '<b style="color:' + (v ? '#7fe08a' : '#ff6b6b') + '">' + (v ? 'Yes' : 'No') + '</b>';
  const col = o.win >= 75 ? '#7fe08a' : o.win >= 40 ? '#e8c36a' : '#ff6b6b';
  const cell = (k, v) => '<div class="ek">' + k + '</div><div class="ev">' + v + '</div>';
  const ex = (n) => '<b style="color:' + (n > 0 ? '#7fe08a' : '#ff6b6b') + '">' + sg(n) + '</b>';
  return '<div class="eh">Combat Evaluation</div><div class="eg">' +
    cell('Will I hit it?', yn(o.hitIt)) + cell('Extra Attack:', ex(me.atk - cr.def)) +
    cell('# Hits to kill it:', '<b>' + o.killIt + '</b>') + cell('Extra Damage:', ex(me.dmg - cr.arm) + (o.resIt ? ' <span class="em">(' + o.resIt + '% res.)</span>' : '')) +
    cell('Will I be hit?', yn(o.hitMe)) + cell('Extra Defense:', ex(me.def - cr.atk)) +
    cell('# Hits to kill me:', '<b>' + o.killMe + '</b>') + cell('Extra Armor:', ex(me.arm - cr.dmg) + (o.resMe ? ' <span class="em">(' + o.resMe + '% res.)</span>' : '')) +
    cell('Avg. player hits:', '<b>' + o.ph.toFixed(1) + '</b> <span class="em">(' + o.dealt + ' each)</span>') + cell('Avg. creature hits:', '<b>' + o.ch.toFixed(1) + '</b> <span class="em">(' + o.taken + ' each)</span>') +
    '</div><div class="ef">Win chance: <b style="color:' + col + '">' + o.win.toFixed(1) + '%</b> &nbsp; Defeat: <b style="color:#ff6b6b">' + o.lose.toFixed(1) + '%</b>' + (o.draw >= 0.05 ? ' &nbsp; Unresolved: <b style="color:#e8c36a">' + o.draw.toFixed(1) + '%</b>' : '') +
    '<br><span class="em">Average: ' + o.turns.toFixed(1) + ' turns, you finish with ' + o.hpLeft.toFixed(1) + '/' + me.hp + ' HP &ndash; without luck: ' + o.base + (me.type ? ' &ndash; your damage: ' + esc(me.type) : '') +
    '<br>Enhancements (chance per hit) &ndash; you: Piercing ' + me.enh.ps + '%, Multi-Layered ' + me.enh.mla + '%, Critical ' + me.enh.crit + '% &ndash; it: ' + cr.enh.ps + '%, ' + cr.enh.mla + '%, ' + cr.enh.crit + '%</span></div>';
}

export async function fillEvaluation(frame) {
  const el = document.getElementById('ssh-eval');
  if (!el) return;
  try {
    const cr = parseCreature(frame);
    if ([cr.atk, cr.def, cr.arm, cr.dmg, cr.hp].some((v) => isNaN(v))) { el.remove(); return; }
    const me = await playerStats();
    if ([me.atk, me.def, me.arm, me.dmg, me.hp].some((v) => isNaN(v))) { el.remove(); return; }
    if (document.getElementById('ssh-eval')) el.innerHTML = evalHtml(me, cr, simulate(me, cr));
  } catch (e) { el.remove(); }
}
