import { pageParts } from '../core/page.js';
import { store } from '../core/storage.js';
import { https } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { gAlerts, mModal } from '../layout/modal.js';
import { parseItem } from '../tooltips/compare.js';

// Faction Inventory: every item of the faction in one list - the tagged items the members carry (the game's "Tagged Item Report")
// and the items in the faction store - with the numbers of each item, filters, sorting, and buttons to recall them. The list of items
// comes from two pages of the game; what an item is (type, rarity, level, bonuses, durability) comes from its own tooltip data
// (fetchitem.php), read once and kept (a day) so that opening the page again is quick.
// The game's Tagged Item Report page: the helper shows this page there (unless the setting is off)
export const FI_URL = 'index.php?cmd=guild&subcmd=inventory&subcmd2=report';

const REPORT = 'index.php?cmd=guild&subcmd=inventory&subcmd2=report';
const MANAGE = 'index.php?cmd=guild&subcmd=manage';
const ITEM = /ajaxLoadItem\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;
const STORE = 'Faction Store';
const STALE = 24 * 3600 * 1000; // a cached item is read again after a day (its durability changes)
const PER = [25, 50, 100, 250];
const ABBR = { Attack: 'Atk', Damage: 'Dmg', Defense: 'Def', Defence: 'Def', Armor: 'Arm', Armour: 'Arm', HP: 'HP' };
const BYCOLOR = { '#40FFFF': 'Rare', '#FF40FF': 'Unique', '#FFFF40': 'Legendary', '#FFFFFF': 'Common' };
const QRANK = ['Uncrafted', 'Very Poor', 'Poor', 'Average', 'Good', 'Very Good', 'Excellent', 'Perfect']; // worst to best
// the item classes (Core, Psi, ...) of gear; the other items have none
const CLASSES = ['Core', 'Psi', 'Battlesuit', 'Rad', 'Hardwired'];
const NOCLASS = 'None';
const RANK = { Common: 0, Uncommon: 1, Rare: 2, Unique: 3, Epic: 4, Legendary: 5, 'Super Elite': 6, Crystalline: 7 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
const get = async (url) => parse(await (await fetch(url, { credentials: 'same-origin' })).text());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alertText = (al) => al.map((t) => t.textContent.replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim()).filter(Boolean).join(' ');
const alertBad = (al) => al.some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));

// ---- the lists of the game's pages

// The tagged items the members carry: a table with a row of the member's name, then one row per item (its picture holds the item's
// numbers, its name is the link that recalls it; green means the member wears it).
function readReport(doc) {
  const out = [];
  let who = '';
  doc.querySelectorAll('td[bgcolor="#112322"], a[href*="subcmd2=recall"]').forEach((e) => {
    if (e.tagName === 'TD') { who = e.textContent.replace(/ /g, ' ').trim(); return; }
    const im = e.closest('tr').querySelector('img[onmouseover*="ajaxLoadItem"]');
    const m = im && (im.getAttribute('onmouseover') || '').match(ITEM);
    if (!m) return;
    const f = e.querySelector('font');
    out.push({
      k: 'p' + m[2], kind: 'p', item: +m[1], inv: +m[2], type: +m[3], pid: +m[4], icon: https(im.getAttribute('src') || ''),
      name: e.textContent.replace(/\s+/g, ' ').trim(), where: who, eq: !!f && /00ff00/i.test(f.getAttribute('color') || ''), href: e.getAttribute('href'),
    });
  });
  return out;
}

// One page of the faction store (on the Manage page): pictures with a link that takes the item.
function readStore(doc) {
  const out = [];
  doc.querySelectorAll('a[href*="subcmd2=takeitem"]').forEach((a) => {
    const im = a.querySelector('img[onmouseover*="ajaxLoadItem"]');
    const m = im && (im.getAttribute('onmouseover') || '').match(ITEM);
    if (!m) return;
    const q = a.closest('td').querySelector('font[size="1"]');
    const n = q ? parseInt(q.textContent.replace(/ /g, ' '), 10) : 1;
    out.push({ k: 's' + m[2], kind: 's', item: +m[1], inv: +m[2], type: +m[3], pid: +m[4], icon: https(im.getAttribute('src') || ''), name: '', where: STORE, eq: false, href: a.getAttribute('href'), qty: n > 1 ? n : 1 });
  });
  return out;
}

async function loadStore() {
  const all = [];
  const seen = new Set();
  for (let p = 0; p < 80; p++) {
    const rows = readStore(await get(MANAGE + '&guildstore_page=' + p));
    const fresh = rows.filter((r) => !seen.has(r.k));
    if (!fresh.length) break;
    fresh.forEach((r) => { seen.add(r.k); all.push(r); });
  }
  return all;
}

// What an item's tooltip says, as a small record: name, colour of the name, type, rarity, category, quality, level, durability,
// bonuses, whether it belongs to a set.
// The colour the tooltip gives the quality (Perfect, Excellent, ...): the last coloured word of the header line
function gearQ(hdr, parts) {
  if (!hdr || parts.length !== 3) return '';
  const f = [...hdr.querySelectorAll('font[color]')].reverse().find((x) => x.textContent.trim() === parts[2]);
  return f ? f.getAttribute('color') : '';
}

function readDetail(html) {
  const it = parseItem(html);
  const d = it.doc;
  const text = d.body.textContent.replace(/\s+/g, ' ');
  const b = d.querySelector('b');
  const fc = b && b.closest('font[color]');
  const hdr = d.querySelector('td[colspan="6"]');
  let rest = hdr ? hdr.textContent.replace(/\s+/g, ' ') : '';
  const at = it.type ? rest.lastIndexOf(it.type) : -1; // the name may hold the type too ("... Body Armor"): the last one is the type
  rest = at >= 0 ? rest.slice(at + it.type.length) : '';
  const parts = rest.split(' - ').map((s) => s.trim());
  // gear says "Rarity - Category - Quality"; other things (stims, drones, mission items) say less, and may add a line like "Bound (Non-Tradable)"
  const gear = parts.length === 3;
  // gear that cannot be crafted has no quality: "Common - Core"
  const noQ = parts.length === 2 && CLASSES.includes(parts[1]);
  const col = fc ? fc.getAttribute('color') : '';
  // gear says its rarity first, and it may be a condition like "HK" or "Fragile (Non-Repairable)"; for the rest it is the first word, if any;
  // with none, the colour of the name says it (cyan Rare, magenta Unique, yellow Legendary, white Common)
  const rar = (gear || noQ ? parts[0].replace(/\s*\(.*$/, '') : (rest.match(/^(Common|Uncommon|Rare|Unique|Epic|Legendary|Super Elite|Crystalline)/) || [''])[0]) || BYCOLOR[col.toUpperCase()] || '';
  const qf = gearQ(hdr, parts);
  // the upgrade level is shown as a row of pictures under "Upgrade Level"
  const ul = [...d.querySelectorAll('td')].find((td) => !td.querySelector('td') && td.textContent.trim() === 'Upgrade Level');
  const up = ul ? (ul.closest('table').innerHTML.match(/forgelevel/g) || []).length : 0;
  const lv = text.match(/Min Level:\s*(\d+)/);
  const du = text.match(/Durability:\s*(\d+)\s*\/\s*(\d+)/);
  return {
    n: it.name, k: col, v: 4, qc: qf, u: up, t: it.type, r: rar, c: gear || noQ ? parts[1] : '', q: gear ? parts[2] : '',
    l: lv ? +lv[1] : 0, d: du ? +du[1] : -1, m: du ? +du[2] : 0, b: it.stats.Bonuses || {}, s: /Set Details/.test(text) ? 1 : 0, ts: Date.now(),
  };
}

// ---- the members (their profile page: shown when the pointer rests on a name)

// "0 days, 1 hours, 16 mins, 0 secs" as "1 hour 16 mins ago"
function ago(s) {
  const m = s.match(/(\d+)\s*days?,\s*(\d+)\s*hours?,\s*(\d+)\s*mins?/);
  if (!m) return s; // "Inactive Account"
  const [d, h, mi] = [+m[1], +m[2], +m[3]];
  const n = (v, w) => v + ' ' + w + (v === 1 ? '' : 's');
  if (d) return n(d, 'day') + (h ? ' ' + n(h, 'hour') : '') + ' ago';
  if (h) return n(h, 'hour') + (mi ? ' ' + n(mi, 'min') : '') + ' ago';
  return mi ? n(mi, 'min') + ' ago' : 'just now';
}

function readPlayer(html, name) {
  const t = parse(html).body.textContent.replace(/\s+/g, ' ');
  const g = (re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
  const raw = {
    title: g(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(.{0,80}?)\\s+Last Activity')),
    last: g(/Last Activity:\s*(.*?)\s*(?:Joined:|Class:)/),
    cls: g(/Class:\s*(.*?)\s*Gender:/),
    level: g(/Gender:\s*\S+\s*Level:\s*(\d+)/) || g(/Level:\s*(\d+)/),
    pvp: g(/PvP Rating:\s*([\d,]+)/),
  };
  raw.title = raw.title.replace(/^[^A-Za-z0-9]+/, ''); // the page's script text leaves a "=" in front
  return raw;
}

const PLAYERS = new Map();
function loadPlayer(pid, name) {
  let p = PLAYERS.get(pid);
  if (!p || Date.now() - p.t > 600000) {
    p = { t: Date.now(), p: fetch('index.php?cmd=profile&player_id=' + pid, { credentials: 'same-origin' }).then((r) => r.text()).then((h) => readPlayer(h, name)) };
    p.p.catch(() => PLAYERS.delete(pid));
    PLAYERS.set(pid, p);
  }
  return p.p;
}

const playerTip = (name, r) => '<b>' + esc(name) + '</b>' + (r.title ? '<br><i>' + esc(r.title) + '</i>' : '') +
  '<br>' + (r.level ? 'Level <b>' + esc(r.level) + '</b>' : '') + (r.cls ? ' &middot; ' + esc(r.cls) : '') +
  (r.pvp ? '<br>PvP rating: ' + esc(r.pvp) : '') + '<br>Last active: <b>' + esc(ago(r.last || '?')) + '</b>';

// ---- the page

export function initFactionInv() {
  if (initFactionInv.on) return;
  const p = pageParts(document);
  if (!p || !p.body) return;
  initFactionInv.on = true;

  const st = { q: '', where: '', min: '', max: '', eq: '', set: '', offT: new Set(), offC: new Set(), offR: new Set(), offQ: new Set(), sort: { k: 'l', d: -1 }, per: 50, page: 0, ...store.get('fi_ui', {}) };
  st.offT = new Set(); st.offC = new Set(); st.offR = new Set(); st.offQ = new Set(); st.page = 0;
  let items = [];
  let det = store.get('fi3', {}); // k -> record
  const sel = new Set();
  let busy = 0; // running loads
  let stop = false;
  let rows = []; // what the table shows now (filtered and sorted)

  addCss();
  // The page is the game's report: its content is the first list of this view (no second request for it), then it is replaced.
  let pre = readReport(p.body);
  const root = mel('div', 'fi');
  root.id = 'ssh-fi';
  root.innerHTML =
    '<div class="fi-h"><b>Faction Inventory</b><span class="fi-n" id="fi-n"></span>' +
    '<span class="fi-r"><a href="' + MANAGE + '">Manage Faction</a> &middot; <a href="#" id="fi-ref">Refresh</a></span></div>' +
    '<div class="fi-bar" id="fi-st"></div>' +
    '<div class="fi-f">' +
    '<div class="fi-row"><label>Search <input type="text" id="fi-q" placeholder="name, member, type..." autocomplete="off"></label>' +
    '<label>Where <select id="fi-w"></select></label>' +
    '<label>Level <input type="text" id="fi-min" size="4" placeholder="min" inputmode="numeric"> - <input type="text" id="fi-max" size="4" placeholder="max" inputmode="numeric"></label></div>' +
    '<div class="fi-row"><label>Worn <select id="fi-eq"><option value="">Any</option><option value="1">Worn</option><option value="0">Not worn</option></select></label>' +
    '<label>Set item <select id="fi-set"><option value="">Any</option><option value="1">Yes</option><option value="0">No</option></select></label>' +
    '<span class="fi-sp"></span><a href="#" id="fi-reset">Reset filters</a></div>' +
    '<div class="fi-grp"><span class="fi-gl">Type</span><span class="fi-chips" id="fi-ct"></span><span class="fi-all"><a href="#" data-all="T:1">All</a> <a href="#" data-all="T:0">None</a></span></div>' +
    '<div class="fi-grp"><span class="fi-gl">Class</span><span class="fi-chips" id="fi-cc"></span><span class="fi-all"><a href="#" data-all="C:1">All</a> <a href="#" data-all="C:0">None</a></span></div>' +
    '<div class="fi-grp"><span class="fi-gl">Rarity</span><span class="fi-chips" id="fi-cr"></span><span class="fi-all"><a href="#" data-all="R:1">All</a> <a href="#" data-all="R:0">None</a></span></div>' +
    '<div class="fi-grp"><span class="fi-gl">Quality</span><span class="fi-chips" id="fi-cq"></span><span class="fi-all"><a href="#" data-all="Q:1">All</a> <a href="#" data-all="Q:0">None</a></span></div>' +
    '</div>' +
    '<div class="fi-act"><span id="fi-cnt"></span><span class="fi-sp"></span><input type="button" class="custombutton" id="fi-rs" value="Recall selected" disabled><input type="button" class="custombutton" id="fi-ts" value="Take selected" disabled>' +
    '<label>Show <select id="fi-per">' + PER.map((n) => '<option value="' + n + '">' + n + '</option>').join('') + '</select> per page</label></div>' +
    '<div class="fi-tw"><table class="fi-t"><thead id="fi-th"></thead><tbody id="fi-tb"></tbody></table></div>' +
    '<div class="fi-pg" id="fi-pg"></div>';
  p.body.replaceChildren(root);
  document.title = 'Faction Inventory';
  const $ = (id) => root.querySelector('#' + id);
  $('fi-per').value = String(st.per);

  const status = (html, cls) => { const s = $('fi-st'); s.className = 'fi-bar' + (cls ? ' ' + cls : ''); s.innerHTML = html; s.hidden = !html; };

  // ---- data
  const save = () => {
    const keep = {};
    items.forEach((i) => { if (det[i.k]) keep[i.k] = det[i.k]; });
    det = keep;
    store.set('fi3', det);
  };
  const info = (i) => det[i.k];
  const nameOf = (i) => { const d = info(i); return (d && d.n) || i.name || '...'; };
  const durOf = (i) => { const d = info(i); return d && d.m ? Math.round((d.d / d.m) * 100) : -1; };
  const bonusKeys = () => {
    const c = {};
    items.forEach((i) => { const d = info(i); if (d) Object.keys(d.b).forEach((k) => { c[k] = (c[k] || 0) + 1; }); });
    const pref = ['Attack', 'Damage', 'Defense', 'Defence', 'Armor', 'Armour', 'HP'];
    const rank = (k) => (pref.includes(k) ? pref.indexOf(k) - 100 : 0);
    return Object.keys(c).sort((a, b) => rank(a) - rank(b) || c[b] - c[a]).slice(0, 5);
  };

  // Fetches what the items are, six at a time; the table fills in as the answers arrive.
  async function loadDetails(force) {
    const todo = items.filter((i) => force || !det[i.k] || Date.now() - det[i.k].ts > STALE || det[i.k].v < 3 || (det[i.k].v === 3 && !det[i.k].c));
    // the ones never read first, then the stale ones
    todo.sort((a, b) => (det[a.k] ? 1 : 0) - (det[b.k] ? 1 : 0));
    if (!todo.length) { status(''); return; }
    let done = 0;
    let fail = 0;
    let last = 0;
    const paint = () => {
      status('<span class="ssh-spin"></span> Reading the items: ' + done + ' / ' + todo.length + ' <a href="#" id="fi-stop">Stop</a>');
      const t = Date.now();
      if (t - last > 700) { last = t; drawChips(); drawTable(); }
    };
    paint();
    let next = 0;
    const worker = async () => {
      while (!stop && next < todo.length) {
        const i = todo[next++];
        try {
          const html = await (await fetch('fetchitem.php?item_id=' + i.item + '&inv_id=' + i.inv + '&t=' + i.type + '&p=' + i.pid + '&uid=' + Date.now(), { credentials: 'same-origin' })).text();
          const r = readDetail(html);
          if (r.n) det[i.k] = r; else fail++;
        } catch (e) { fail++; }
        done++;
        paint();
      }
    };
    await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
    save();
    drawChips();
    drawTable();
    status(stop ? 'Stopped: ' + done + ' of ' + todo.length + ' items read. Refresh continues.' : fail ? fail + ' item(s) could not be read.' : '', fail && !stop ? 'bad' : '');
  }

  async function load(force) {
    busy++;
    stop = false;
    status('<span class="ssh-spin"></span> Loading the lists...');
    try {
      const [rep, sto] = await Promise.all([
        (pre && pre.length ? Promise.resolve(pre) : get(REPORT).then(readReport)).catch(() => null),
        loadStore().catch(() => null),
      ]);
      if (!rep && !sto) { status('The lists could not be loaded. Are you in a faction, and allowed to see its items?', 'bad'); return; }
      pre = null;
      items = [...(rep || []), ...(sto || [])];
      sel.clear();
      drawChips();
      drawTable();
      await loadDetails(force);
    } catch (e) {
      status('Something went wrong while loading.', 'bad');
    } finally { busy--; }
  }

  // ---- filtering and sorting
  const val = (i, k) => {
    const d = info(i);
    switch (k) {
      case 'n': return nameOf(i).toLowerCase();
      case 'l': return d ? d.l : -1;
      case 'w': return i.where.toLowerCase();
      case 'e': return i.eq ? 1 : 0;
      case 't': return d ? d.t.toLowerCase() : '';
      case 'q': return d ? d.q : '';
      case 'g': return d ? d.u : -1;
      case 'u': return durOf(i);
      default: return d && d.b[k.slice(2)] !== undefined ? d.b[k.slice(2)] : -1;
    }
  };

  function pass(i) {
    const d = info(i);
    if (st.where && i.where !== st.where) return false;
    if (st.eq === '1' && !i.eq) return false;
    if (st.eq === '0' && i.eq) return false;
    if (d) {
      if (st.offT.has(d.t) || st.offC.has(d.c || NOCLASS) || st.offR.has(d.r) || st.offQ.has(d.q)) return false;
      if (st.set === '1' && !d.s) return false;
      if (st.set === '0' && d.s) return false;
      const lo = parseInt(st.min, 10);
      const hi = parseInt(st.max, 10);
      if (!isNaN(lo) && d.l < lo) return false;
      if (!isNaN(hi) && d.l > hi) return false;
    } else if (st.set === '1') return false;
    if (st.q) {
      const hay = (nameOf(i) + ' ' + i.where + ' ' + (d ? d.t + ' ' + d.r + ' ' + d.c + ' ' + d.q : '')).toLowerCase();
      if (!st.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function filtered() {
    const k = st.sort.k;
    const dir = st.sort.d;
    const list = items.filter(pass);
    list.sort((a, b) => {
      const x = val(a, k);
      const y = val(b, k);
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      return c ? c * dir : nameOf(a).localeCompare(nameOf(b));
    });
    return list;
  }

  // ---- drawing
  function drawChips() {
    const cnt = (f) => { const m = new Map(); items.forEach((i) => { const d = info(i); const v = d && f(d); if (v) m.set(v, (m.get(v) || 0) + 1); }); return m; };
    const chips = (host, m, off, order, color) => {
      host.innerHTML = [...m.keys()].sort(order).map((v) => '<label class="fi-chip' + (off.has(v) ? '' : ' on') + '" data-v="' + esc(v) + '"' + (color ? ' style="--c:' + color(v) + '"' : '') + '>' + esc(v) + ' <i>' + m.get(v) + '</i></label>').join('');
    };
    const hue = {};
    const qh = {};
    items.forEach((i) => { const d = info(i); if (d && d.r && d.k && !hue[d.r]) hue[d.r] = d.k; if (d && d.q && d.qc && !qh[d.q]) qh[d.q] = d.qc; });
    chips($('fi-ct'), cnt((d) => d.t), st.offT, (a, b) => a.localeCompare(b));
    chips($('fi-cc'), cnt((d) => d.c || NOCLASS), st.offC, (a, b) => (CLASSES.indexOf(a) + 1 || 99) - (CLASSES.indexOf(b) + 1 || 99) || a.localeCompare(b));
    chips($('fi-cr'), cnt((d) => d.r), st.offR, (a, b) => (RANK[a] ?? 99) - (RANK[b] ?? 99) || a.localeCompare(b), (v) => hue[v] || '#9fb0b0');
    chips($('fi-cq'), cnt((d) => d.q), st.offQ, (a, b) => (QRANK.indexOf(a) + 1 || 99) - (QRANK.indexOf(b) + 1 || 99) || a.localeCompare(b), (v) => qh[v] || '#9fb0b0');
    // where: the store, then the members (with how many items each carries)
    const w = $('fi-w');
    const by = new Map();
    items.forEach((i) => by.set(i.where, (by.get(i.where) || 0) + 1));
    const names = [...by.keys()].filter((n) => n !== STORE).sort((a, b) => a.localeCompare(b));
    const keep = st.where;
    w.innerHTML = '<option value="">Everywhere (' + items.length + ')</option>' + (by.has(STORE) ? '<option value="' + STORE + '">' + STORE + ' (' + by.get(STORE) + ')</option>' : '') +
      names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + ' (' + by.get(n) + ')</option>').join('');
    w.value = by.has(keep) ? keep : '';
    st.where = w.value;
  }

  function drawTable() {
    rows = filtered();
    const bk = bonusKeys();
    const arrow = (k) => (st.sort.k === k ? (st.sort.d > 0 ? ' &#9650;' : ' &#9660;') : '');
    const th = (k, label, cls, title) => '<th class="s ' + (cls || '') + '" data-s="' + k + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + label + arrow(k) + '</th>';
    $('fi-th').innerHTML = '<tr><th class="c"><input type="checkbox" id="fi-all" title="Select all the items shown (every page)"></th><th class="i"></th>' +
      th('n', 'Name') + th('l', 'Lv', 'n') + th('w', 'Where') + th('e', 'Eq', 'ck', 'Equipped (worn by the member)') + th('t', 'Type') + th('q', 'Qual') + th('g', 'Up', 'n', 'Upgrade level') +
      bk.map((k) => th('b:' + k, ABBR[k] || k.slice(0, 4), 'n', k)).join('') + th('u', 'Du%', 'n', 'Durability') + '<th class="a"></th>';
    const pages = Math.max(1, Math.ceil(rows.length / st.per));
    st.page = Math.min(st.page, pages - 1);
    const from = st.page * st.per;
    const show = rows.slice(from, from + st.per);
    $('fi-tb').innerHTML = show.map((i) => {
      const d = info(i);
      const du = durOf(i);
      const name = esc(nameOf(i));
      return '<tr data-k="' + i.k + '"' + (sel.has(i.k) ? ' class="sel"' : '') + '><td class="c"><input type="checkbox"' + (sel.has(i.k) ? ' checked' : '') + (i.href ? '' : ' disabled') + '></td>' +
        '<td class="i"><img src="' + esc(i.icon) + '" alt="" data-item="' + i.item + '|' + i.inv + '|' + i.type + '|' + i.pid + '"></td>' +
        '<td class="nm"><span data-item="' + i.item + '|' + i.inv + '|' + i.type + '|' + i.pid + '"' + (d && d.k ? ' style="color:' + esc(d.k) + '"' : '') + '>' + name + '</span>' + (i.qty > 1 ? ' <i>x' + i.qty + '</i>' : '') + (d && d.s ? ' <em class="set">set</em>' : '') + '</td>' +
        '<td class="n">' + (d ? d.l : '') + '</td><td class="w' + (i.kind === 's' ? ' st' : '') + '"' + (i.kind === 'p' ? ' data-pid="' + i.pid + '"' : ' title="' + esc(i.where) + '"') + ' data-who="' + esc(i.where) + '">' + esc(i.where) + '</td><td class="ck">' + (i.eq ? '&#10003;' : '') + '</td><td title="' + esc(d ? d.t : '') + '">' + esc(d ? d.t : '') + '</td><td' + (d && d.qc ? ' style="color:' + esc(d.qc) + '"' : '') + '>' + esc(d ? d.q : '') + '</td><td class="n">' + (d && d.u ? d.u : '') + '</td>' +
        bk.map((k) => '<td class="n">' + (d && d.b[k] !== undefined ? d.b[k] : '') + '</td>').join('') +
        '<td class="n' + (du >= 0 && du < 30 ? ' low' : '') + '">' + (du >= 0 ? du : '') + '</td>' +
        '<td class="a">' + (i.href ? (i.kind === 's' ? '<a href="#" class="fi-do" data-do="take" title="Take it to your backpack">Take</a>' : '<a href="#" class="fi-do" data-do="recall" title="Recall it to the faction store">Recall</a> <span class="fi-bar2">|</span> <a href="#" class="fi-do" data-do="bp" title="Recall it to the faction store, then take it to your backpack">Take</a>') : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="' + (11 + bk.length) + '" class="fi-none">' + (busy ? 'Loading...' : 'No items match.') + '</td></tr>';
    const all = $('fi-all');
    const can = rows.filter((i) => i.href);
    all.checked = !!can.length && can.every((i) => sel.has(i.k));
    $('fi-n').textContent = ' - ' + items.filter((i) => i.kind === 'p').length + ' tagged items carried by ' + new Set(items.filter((i) => i.kind === 'p').map((i) => i.where)).size + ' members, ' + items.filter((i) => i.kind === 's').length + ' in the store';
    $('fi-cnt').textContent = rows.length === items.length ? rows.length + ' items' : rows.length + ' of ' + items.length + ' items';
    const rs = $('fi-rs');
    const ts = $('fi-ts');
    const chosen = items.filter((i) => sel.has(i.k));
    const np = chosen.filter((i) => i.kind === 'p').length;
    rs.disabled = !np || busy > 1;
    rs.value = np ? 'Recall selected (' + np + ')' : 'Recall selected';
    ts.disabled = !chosen.length || busy > 1;
    ts.value = chosen.length ? 'Take selected (' + chosen.length + ')' : 'Take selected';
    $('fi-pg').innerHTML = pages > 1
      ? '<a href="#" data-pg="' + (st.page - 1) + '"' + (st.page ? '' : ' class="off"') + '>&laquo; Prev</a> ' + (from + 1) + ' - ' + (from + show.length) + ' of ' + rows.length + ' &middot; page ' + (st.page + 1) + ' / ' + pages + ' <a href="#" data-pg="' + (st.page + 1) + '"' + (st.page < pages - 1 ? '' : ' class="off"') + '>Next &raquo;</a>'
      : '';
  }

  // ---- recalling and taking
  async function send(i) {
    const doc = parse(await (await fetch(i.href, { credentials: 'same-origin' })).text());
    const al = gAlerts(doc);
    const again = i.kind === 'p' && !!doc.querySelector('a[href*="subcmd2=recall"][href*="id=' + i.inv + '"]'); // the report still lists it
    return { ok: !alertBad(al) && !again, msg: alertText(al) };
  }
  const drop = (i) => { const at = items.indexOf(i); if (at >= 0) items.splice(at, 1); sel.delete(i.k); delete det[i.k]; };

  async function act(i, row) {
    const link = row && row.querySelector('.fi-do[data-do]:not([data-do="bp"])');
    row && row.querySelectorAll('.fi-do').forEach((l) => l.classList.add('wait'));
    if (link) link.textContent = '...';
    busy++;
    let r;
    try { r = await send(i); } catch (e) { r = { ok: false, msg: 'The request failed.' }; }
    busy--;
    if (r.ok) {
      const what = i.kind === 's' ? 'Taken' : 'Recalled';
      drop(i);
      status('<b>' + what + '</b> ' + esc(nameOf(i)) + (i.kind === 'p' ? ' from ' + esc(i.where) : '') + '.' + (r.msg ? ' ' + esc(r.msg) : ''), 'ok');
      save();
      drawChips();
      drawTable();
      if (i.kind === 'p') refreshStore();
    } else {
      if (link) { link.textContent = 'Failed'; link.classList.remove('wait'); link.classList.add('bad'); link.title = r.msg || ''; }
      status('<b>' + esc(nameOf(i)) + '</b>: ' + esc(r.msg || 'The game did not do it.'), 'bad');
    }
  }

  // To the backpack: recall the item to the store, find it there (the item that was not in the store before), and take it.
  async function toBackpack(i, row) {
    row.querySelectorAll('.fi-do').forEach((l) => l.classList.add('wait'));
    const bp = row.querySelector('[data-do="bp"]');
    if (bp) bp.textContent = '...';
    busy++;
    const fail = (msg) => {
      row.querySelectorAll('.fi-do').forEach((l) => l.classList.remove('wait'));
      if (bp) { bp.textContent = 'Failed'; bp.classList.add('bad'); bp.title = msg; }
      status('<b>' + esc(nameOf(i)) + '</b>: ' + esc(msg), 'bad');
    };
    try {
      status('<span class="ssh-spin"></span> Moving ' + esc(nameOf(i)) + ' to your backpack...');
      const before = new Set((await loadStore()).map((s) => s.k));
      const r = await send(i);
      if (!r.ok) { fail(r.msg || 'The game did not recall it.'); return; }
      drop(i);
      const after = await loadStore();
      items = [...items.filter((x) => x.kind === 'p'), ...after];
      const fresh = after.filter((s) => !before.has(s.k));
      const s = fresh.find((x) => x.item === i.item) || (fresh.length === 1 ? fresh[0] : null);
      if (!s) {
        drawChips(); drawTable();
        status('<b>' + esc(nameOf(i)) + '</b> was recalled to the faction store, but could not be found there to take.', 'bad');
        loadDetails(false);
        return;
      }
      const t = await send(s);
      if (!t.ok) {
        drawChips(); drawTable();
        status('<b>' + esc(nameOf(i)) + '</b> was recalled to the faction store, but not taken: ' + esc(t.msg || 'the game did not do it.'), 'bad');
        loadDetails(false);
        return;
      }
      items = items.filter((x) => x !== s);
      status('<b>' + esc(nameOf(i)) + '</b> is in your backpack (recalled from ' + esc(i.where) + ').' + (t.msg ? ' ' + esc(t.msg) : ''), 'ok');
      save();
      drawChips();
      drawTable();
    } catch (e) {
      fail('The request failed.');
    } finally { busy--; }
  }

  // The store changed (items arrive in it): read its pages again, and the new items.
  let storeTimer = 0;
  function refreshStore() {
    clearTimeout(storeTimer);
    storeTimer = setTimeout(async () => {
      try {
        const sto = await loadStore();
        items = [...items.filter((i) => i.kind === 'p'), ...sto];
        drawChips();
        drawTable();
        await loadDetails(false);
      } catch (e) { /* the next refresh has it */ }
    }, 600);
  }

  function askRecall() {
    const list = items.filter((i) => sel.has(i.k) && i.href && i.kind === 'p');
    if (!list.length) return;
    const worn = list.filter((i) => i.eq).length;
    const body = mel('div');
    body.style.cssText = 'max-width:380px;line-height:1.5';
    body.textContent = 'Recall ' + list.length + ' item' + (list.length === 1 ? '' : 's') + ' from ' + new Set(list.map((i) => i.where)).size + ' member(s) to the faction store?' + (worn ? ' ' + worn + ' of them ' + (worn === 1 ? 'is' : 'are') + ' worn.' : '');
    mModal('Recall items', body, [{ text: 'Recall', fn: () => recallAll(list) }, { text: 'Cancel' }]);
  }

  async function recallAll(list) {
    let ok = 0;
    let bad = 0;
    let last = '';
    stop = false;
    busy++;
    for (const i of list) {
      if (stop) break;
      status('<span class="ssh-spin"></span> Recalling ' + (ok + bad + 1) + ' / ' + list.length + ' <a href="#" id="fi-stop">Stop</a>');
      let r;
      try { r = await send(i); } catch (e) { r = { ok: false, msg: 'The request failed.' }; }
      if (r.ok) { ok++; drop(i); } else { bad++; last = r.msg; }
      if ((ok + bad) % 5 === 0) { drawChips(); drawTable(); }
      await sleep(120);
    }
    busy--;
    save();
    drawChips();
    drawTable();
    status('<b>' + ok + '</b> recalled' + (bad ? ', <b>' + bad + '</b> not' + (last ? ' (' + esc(last) + ')' : '') : '') + (stop ? ' (stopped)' : '') + '.', bad ? 'bad' : 'ok');
    if (ok) refreshStore();
  }

  // Take the selected items into the backpack: the members' ones are recalled to the store first (all of them, then the store is read
  // once and what arrived is matched by item), then everything is taken. The store's own items are only taken.
  function askTake() {
    const list = items.filter((i) => sel.has(i.k) && i.href);
    if (!list.length) return;
    const np = list.filter((i) => i.kind === 'p');
    const worn = np.filter((i) => i.eq).length;
    const body = mel('div');
    body.style.cssText = 'max-width:380px;line-height:1.5';
    body.textContent = 'Take ' + list.length + ' item' + (list.length === 1 ? '' : 's') + ' into your backpack?' + (np.length ? ' ' + np.length + ' of them ' + (np.length === 1 ? 'is' : 'are') + ' recalled from members first' + (worn ? ' (' + worn + ' worn)' : '') + '.' : '');
    mModal('Take items', body, [{ text: 'Take', fn: () => takeAll(list) }, { text: 'Cancel' }]);
  }

  async function takeAll(list) {
    const players = list.filter((i) => i.kind === 'p');
    const inStore = list.filter((i) => i.kind === 's');
    let got = 0;
    let bad = 0;
    let last = '';
    let lost = 0;
    stop = false;
    busy++;
    try {
      const todo = [...inStore];
      if (players.length) {
        const before = new Set((await loadStore()).map((s) => s.k));
        const sent = [];
        for (const i of players) {
          if (stop) break;
          status('<span class="ssh-spin"></span> Recalling ' + (sent.length + bad + 1) + ' / ' + players.length + ' <a href="#" id="fi-stop">Stop</a>');
          let r;
          try { r = await send(i); } catch (e) { r = { ok: false, msg: 'The request failed.' }; }
          if (r.ok) { sent.push(i); drop(i); } else { bad++; last = r.msg; }
          await sleep(120);
        }
        if (sent.length) {
          status('<span class="ssh-spin"></span> Finding the items in the store...');
          const after = await loadStore();
          items = [...items.filter((x) => x.kind === 'p'), ...after];
          const fresh = after.filter((s) => !before.has(s.k));
          sent.forEach((i) => {
            const at = fresh.findIndex((s) => s.item === i.item);
            if (at >= 0) todo.push(fresh.splice(at, 1)[0]); else lost++;
          });
        }
      }
      let n = 0;
      for (const s of todo) {
        if (stop) break;
        status('<span class="ssh-spin"></span> Taking ' + (++n) + ' / ' + todo.length + ' <a href="#" id="fi-stop">Stop</a>');
        const live = items.find((x) => x.k === s.k) || s;
        let r;
        try { r = await send(live); } catch (e) { r = { ok: false, msg: 'The request failed.' }; }
        if (r.ok) { got++; items = items.filter((x) => x.k !== s.k); sel.delete(s.k); } else { bad++; last = r.msg; }
        await sleep(120);
      }
    } catch (e) {
      bad++;
      last = 'Something went wrong.';
    } finally { busy--; }
    save();
    drawChips();
    drawTable();
    status('<b>' + got + '</b> in your backpack' + (bad ? ', <b>' + bad + '</b> not' + (last ? ' (' + esc(last) + ')' : '') : '') + (lost ? ', <b>' + lost + '</b> recalled but not found in the store' : '') + (stop ? ' (stopped)' : '') + '.' + (bad || lost || stop ? ' Anything left is in the faction store.' : ''), bad || lost ? 'bad' : 'ok');
    loadDetails(false);
  }

  // ---- events
  const remember = () => store.set('fi_ui', { sort: st.sort, per: st.per });
  let typing = 0;
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'fi-q') st.q = t.value.trim();
    else if (t.id === 'fi-min') st.min = t.value.trim();
    else if (t.id === 'fi-max') st.max = t.value.trim();
    else return;
    clearTimeout(typing);
    typing = setTimeout(() => { st.page = 0; drawTable(); }, 150);
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'fi-w') st.where = t.value;
    else if (t.id === 'fi-eq') st.eq = t.value;
    else if (t.id === 'fi-set') st.set = t.value;
    else if (t.id === 'fi-per') { st.per = +t.value; remember(); }
    else if (t.id === 'fi-all') {
      rows.filter((i) => i.href).forEach((i) => { if (t.checked) sel.add(i.k); else sel.delete(i.k); });
    } else if (t.closest('td.c')) {
      const k = t.closest('tr').dataset.k;
      if (t.checked) sel.add(k); else sel.delete(k);
      t.closest('tr').classList.toggle('sel', t.checked);
      drawTable();
      return;
    } else return;
    st.page = 0;
    drawTable();
  });
  root.addEventListener('click', (e) => {
    const t = e.target;
    const a = t.closest('a, th.s, label.fi-chip, input[type=button]');
    if (!a || !root.contains(a)) return;
    if (a.tagName === 'A') e.preventDefault();
    if (a.id === 'fi-ref') { if (!busy) { load(true); } return; }
    if (a.id === 'fi-stop') { stop = true; return; }
    if (a.id === 'fi-reset') {
      Object.assign(st, { q: '', where: '', min: '', max: '', eq: '', set: '', page: 0 });
      st.offT.clear(); st.offC.clear(); st.offR.clear(); st.offQ.clear();
      $('fi-q').value = ''; $('fi-min').value = ''; $('fi-max').value = ''; $('fi-eq').value = ''; $('fi-set').value = '';
      drawChips(); drawTable();
      return;
    }
    if (a.dataset.all) {
      const [g, on] = a.dataset.all.split(':');
      const off = g === 'T' ? st.offT : g === 'C' ? st.offC : g === 'R' ? st.offR : st.offQ;
      off.clear();
      if (on === '0') root.querySelectorAll('#fi-c' + g.toLowerCase() + ' .fi-chip').forEach((c) => off.add(c.dataset.v));
      st.page = 0; drawChips(); drawTable();
      return;
    }
    if (a.classList.contains('fi-chip')) {
      e.preventDefault();
      const id = a.parentNode.id;
      const off = id === 'fi-ct' ? st.offT : id === 'fi-cc' ? st.offC : id === 'fi-cr' ? st.offR : st.offQ;
      const v = a.dataset.v;
      if (off.has(v)) off.delete(v); else off.add(v);
      st.page = 0; drawChips(); drawTable();
      return;
    }
    if (a.dataset.pg !== undefined && !a.classList.contains('off')) { st.page = +a.dataset.pg; drawTable(); $('fi-tb').scrollIntoView({ block: 'nearest' }); return; }
    if (a.classList.contains('s')) {
      const k = a.dataset.s;
      st.sort = { k, d: st.sort.k === k ? -st.sort.d : (k === 'n' || k === 'w' || k === 't' || k === 'q' ? 1 : -1) };
      remember(); drawTable();
      return;
    }
    if (a.id === 'fi-rs') { askRecall(); return; }
    if (a.id === 'fi-ts') { askTake(); return; }
    if (a.classList.contains('fi-do') && !a.classList.contains('wait')) {
      const row = a.closest('tr');
      const i = items.find((x) => x.k === row.dataset.k);
      if (i) (a.dataset.do === 'bp' ? toBackpack : act)(i, row);
    }
  });
  // an item's picture shows its tooltip (the game's own, which the helper makes quick)
  root.addEventListener('mouseover', (e) => {
    const im = e.target.closest && e.target.closest('[data-item]');
    if (!im || typeof window.ajaxLoadItem !== 'function') return;
    const a = im.dataset.item.split('|').map(Number);
    window.ajaxLoadItem(a[0], a[1], a[2], a[3], '');
  });
  // a member's name shows who they are: level, class, rating, when they were last active (read from their profile once)
  let overPid = '';
  root.addEventListener('mouseover', (e) => {
    const td = e.target.closest && e.target.closest('td.w[data-pid]');
    if (!td || typeof window.Tip !== 'function') return;
    const pid = td.dataset.pid;
    if (overPid === pid) return;
    overPid = pid;
    const name = td.dataset.who;
    if (typeof window.tt_setWidth === 'function') window.tt_setWidth(190);
    window.Tip('<center>' + esc(name) + '<br>Loading...</center>');
    loadPlayer(pid, name).then((r) => { if (overPid === pid) window.Tip(playerTip(name, r)); }, () => { if (overPid === pid) window.Tip('Could not load ' + esc(name) + '.'); });
  });
  root.addEventListener('mouseout', (e) => {
    const td = e.target.closest && e.target.closest('td.w[data-pid]');
    if (td && !(e.relatedTarget && td.contains(e.relatedTarget))) { overPid = ''; if (typeof window.UnTip === 'function') window.UnTip(); }
  });
  root.addEventListener('mouseout', (e) => {
    if (e.target.closest && e.target.closest('[data-item]') && typeof window.UnTip === 'function') window.UnTip();
  });

  drawTable();
  load(false);
}

function addCss() {
  if (document.getElementById('ssh-fi-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-fi-css';
  s.textContent =
    '#ssh-fi{padding:8px 10px 12px;font:11px tahoma,sans-serif;color:#d8d4cb;text-align:left}' +
    '#ssh-fi a{color:#a7ffff;text-decoration:none}#ssh-fi a:hover{color:#fff}' +
    '#ssh-fi .fi-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 10px;padding:0 2px 6px}#ssh-fi .fi-h b{font-size:15px;color:#fff;letter-spacing:.5px}#ssh-fi .fi-n{color:#9a9488;flex:1}' +
    '#ssh-fi .fi-r{font-size:10px;color:#6c675d}' +
    '#ssh-fi .fi-bar{margin:0 0 6px;padding:4px 8px;border:1px solid #2c2f2f;background:#101414;color:#bdb6aa}#ssh-fi .fi-bar[hidden]{display:none}' +
    '#ssh-fi .fi-bar.ok{border-color:#2d6a39;color:#7fe08a}#ssh-fi .fi-bar.bad{border-color:#8a2a22;color:#ff8a80}#ssh-fi .fi-bar a{margin-left:8px}' +
    '#ssh-fi .fi-f{border:1px solid #2c2f2f;background:#0d1010;padding:6px 8px;display:flex;flex-direction:column;gap:6px}' +
    '#ssh-fi .fi-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}#ssh-fi .fi-row label,#ssh-fi .fi-act label{display:flex;align-items:center;gap:5px;color:#9a9488}' +
    '#ssh-fi input[type=text],#ssh-fi select{background:#0b0e0e;border:1px solid #3a3d3d;color:#e6e2d8;font:11px tahoma,sans-serif;padding:2px 4px;border-radius:2px}' +
    '#ssh-fi input[type=text]:focus,#ssh-fi select:focus{outline:0;border-color:#5fbfbf}#ssh-fi #fi-q{width:170px}#ssh-fi #fi-w{max-width:170px}' +
    '#ssh-fi .fi-sp{flex:1}' +
    '#ssh-fi .fi-grp{display:flex;align-items:flex-start;gap:8px}#ssh-fi .fi-gl{flex:none;width:44px;padding-top:3px;color:#9a9488}' +
    '#ssh-fi .fi-chips{flex:1;display:flex;flex-wrap:wrap;gap:3px}#ssh-fi .fi-all{flex:none;padding-top:3px;font-size:10px}' +
    '#ssh-fi .fi-chip{cursor:pointer;user-select:none;padding:1px 6px;border:1px solid #2c2f2f;border-radius:9px;color:#6c675d;background:#0b0e0e}#ssh-fi .fi-chip i{font-style:normal;opacity:.6}' +
    '#ssh-fi .fi-chip.on{color:var(--c,#d8d4cb);border-color:#4a5252;background:#161b1b}#ssh-fi .fi-chip:hover{border-color:#7fc9c9}' +
    '#ssh-fi .fi-act{display:flex;align-items:center;gap:10px;margin:8px 0 4px}#ssh-fi #fi-cnt{color:#9a9488}' +
    '#ssh-fi .fi-act .custombutton{width:auto;padding:0 12px}#ssh-fi .fi-bar2{color:#4a5252}#ssh-fi .fi-act .custombutton:disabled{opacity:.4;cursor:default}' +
    '#ssh-fi .fi-tw{border:1px solid #2c2f2f;background:#0b0e0e;overflow-x:auto}' +
    '#ssh-fi .fi-t{border-collapse:collapse;width:100%;table-layout:auto}' +
    '#ssh-fi .fi-t th{position:sticky;top:0;background:#1b1f1f;color:#fff;text-align:left;font-weight:normal;padding:4px 3px;border-bottom:1px solid #3a3d3d;white-space:nowrap}' +
    '#ssh-fi .fi-t th.s{cursor:pointer;user-select:none}#ssh-fi .fi-t th.s:hover{background:#252b2b}' +
    '#ssh-fi .fi-t td{padding:2px 3px;border-bottom:1px solid #1c2020;white-space:nowrap}#ssh-fi .fi-t tr:hover td{background:#12181a}#ssh-fi .fi-t tr.sel td{background:#14262a}' +
    '#ssh-fi .fi-t .n{text-align:right}#ssh-fi .fi-t .c{width:16px;padding-right:0}#ssh-fi .fi-t .c input{margin:0;vertical-align:middle}' +
    '#ssh-fi .fi-t .i{width:26px;padding:1px 2px}#ssh-fi .fi-t .i img{display:block;width:24px;height:24px;border:1px solid #202122;background:#0D0905;cursor:help}' +
    '#ssh-fi .fi-t .nm{max-width:150px;cursor:help;overflow:hidden;text-overflow:ellipsis}#ssh-fi .fi-t .nm i{font-style:normal;color:#9a9488}' +
    '#ssh-fi .fi-t .nm em{font-style:normal;font-size:9px;padding:0 3px;border-radius:2px;margin-left:2px}#ssh-fi .fi-t em.set{color:#e8c872;border:1px solid #6a5a2a}#ssh-fi .fi-t em.eq{color:#7fe08a;border:1px solid #2d6a39}' +
    '#ssh-fi .fi-t .w{max-width:70px;overflow:hidden;text-overflow:ellipsis}#ssh-fi .fi-t .w.st{color:#7fb8ff}#ssh-fi .fi-t .w[data-pid]{cursor:help;text-decoration:underline dotted #6c675d;text-underline-offset:3px}#ssh-fi .fi-t .w[data-pid]:hover{text-decoration-color:#a7ffff}#ssh-fi .fi-t td:nth-child(7){max-width:72px;overflow:hidden;text-overflow:ellipsis}' +
    '#ssh-fi .fi-t .ck{text-align:center;color:#7fe08a;padding:2px 0}#ssh-fi .fi-t th.ck{text-align:center}#ssh-fi .fi-t .low{color:#ff8a80}#ssh-fi .fi-t .a{text-align:right;white-space:nowrap}#ssh-fi .fi-t .fi-do.wait{color:#9a9488;pointer-events:none}#ssh-fi .fi-t .fi-do.bad{color:#ff8a80}' +
    '#ssh-fi .fi-none{text-align:center;color:#6c675d;padding:14px 0}' +
    '#ssh-fi .fi-pg{margin:6px 0 0;text-align:center;color:#9a9488}#ssh-fi .fi-pg a.off{visibility:hidden}' +
    '#ssh-fi .fi-tw::-webkit-scrollbar{height:8px;width:8px}#ssh-fi .fi-tw::-webkit-scrollbar-track{background:#0b0e0e}#ssh-fi .fi-tw::-webkit-scrollbar-thumb{background:#2c3232;border-radius:4px;border:1px solid #0b0e0e}';
  document.head.appendChild(s);
}
