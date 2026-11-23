import { fetchText, withToken } from '../core/net.js';
import { parseHtml } from '../core/util.js';
import { DATA } from '../core/data.js';
import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';

// The Official Guide (cmd=guide: overview, Items, Entities, Missions, Areas, Locations and the page of each entry) for the Modern layout. The game
// made it of divs (official-guide.css), on a page that has no content frame: the helper builds the frame (the same pictures the other pages
// have) and the steel container (layout/steel.js) around the game's <main id="official-guide">, which stays as it is (its links, forms and scripts
// are the game's own), and restyles it to the rest of the UI. The Original layout shows the guide as the game made it: the frame and the container
// are hidden (.gd-c) or made transparent (.gd-w) there.

const SKIN = 'https://cdn.sigmastorm.com/skin/';
const G = 'html.ssh-modern #ssh-gd #official-guide';
const CSS = '#official-guide .guide-map-cell{position:relative}#official-guide .gd-loc{position:absolute;inset:0;cursor:pointer}#official-guide .gd-loc:focus{outline:0}#official-guide .guide-map-cell.gd-ico{outline:0;box-shadow:none}#gd-tip{position:fixed;z-index:9500;display:none;padding:5px 8px;background:#101414;color:#e8e8e8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.6)}#gd-tip b{color:#fff}' +
  '#official-guide .gd-wiki{float:right;margin-left:12px;padding:2px 10px;font:11px/16px Verdana,Arial,sans-serif;text-transform:none;letter-spacing:0;color:#a7ffff;background:#15191a;border:1px solid #3a3d3d;border-radius:2px;text-decoration:none}#official-guide .gd-wiki:hover{color:#fff;background:#252b2b;text-decoration:none}' +
  '#official-guide.gd-busy{opacity:.55;cursor:progress}#official-guide .guide-cards+p{display:none}' + // the plain Locations link of the overview: it is a card (and a tab) now, in both layouts
  'html:not(.ssh-modern) .gd-w{display:contents!important}html:not(.ssh-modern) .gd-c{display:none!important}' +
  'html.ssh-modern #ssh-gd{display:flex;flex-direction:column;flex:1}html.ssh-modern #ssh-gd .ssh-cf{width:723px}' +
  // the game's own page styles go: the container gives the frame, the width and the padding
  G + '{max-width:none;width:auto;margin:0;padding:0;background:none;border:0;box-shadow:none;color:#d8d8d8;font:12px/1.5 Verdana,Arial,sans-serif}' +
  G + '{position:relative}' + G + ' .guide-heading{position:absolute;top:0;right:0;z-index:1;display:flex;align-items:center;height:33px;margin:0;padding:0;border:0}' + // the title is in the container's header; the link to the game is in the row of the tabs
  G + ' .guide-heading .guide-brand{display:none}' +
  G + ' .guide-play{font-size:11px;color:#a7ffff;padding:0;background:none;border:0}' +
  G + ' a{color:#a7ffff;text-decoration:none}' + G + ' a:hover{color:#fff;text-decoration:underline}' +
  // the sections: tabs under a line
  G + ' nav:not(.guide-pagination){display:flex;gap:2px;margin:0 0 16px;padding:0;border:0;border-bottom:1px solid #3a3d3d;background:none}' +
  G + ' nav:not(.guide-pagination) a{padding:6px 12px;border:1px solid transparent;border-bottom:0;border-radius:3px 3px 0 0;color:#9fb0b0;background:none;text-decoration:none}' +
  G + ' nav:not(.guide-pagination) a:hover{color:#fff;background:#12181a}' +
  G + ' nav:not(.guide-pagination) a[aria-current="page"]{color:#fff;background:#1b1f1f;border-color:#3a3d3d;margin-bottom:-1px;padding-bottom:7px}' +
  G + ' .guide-content{margin:0;padding:0;border:0;background:none}' +
  G + ' h1{font:20px/1.2 Marcellus,"Times New Roman",serif;color:#e6dcc8;margin:0 0 12px;padding:0 0 6px;border-bottom:1px solid #3a3d3d;text-transform:uppercase;letter-spacing:.5px}' +
  G + ' h2{font:16px/1.2 Marcellus,"Times New Roman",serif;color:#d8cfbf;margin:18px 0 8px;padding:0 0 4px;border-bottom:1px solid #2c3232;text-transform:uppercase}' +
  G + ' h3{font-size:13px;color:#d8cfbf;margin:12px 0 6px}' +
  G + ' p{margin:0 0 10px}' + G + ' ul{margin:0 0 10px;padding-left:20px}' +
  G + ' .guide-breadcrumb{font-size:11px;color:#8a9494;margin:0 0 8px}' +
  // the overview: the sections as panels
  G + ' .guide-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}' +
  G + ' .guide-card{display:flex;flex-direction:column;gap:2px;padding:10px 12px;background:#0b0e0e;border:1px solid #2c3232;border-radius:3px;text-decoration:none}' +
  G + ' .guide-card:hover{background:#12181a;border-color:#4a5555;text-decoration:none}' +
  G + ' .guide-card strong{font:15px Marcellus,"Times New Roman",serif;color:#e6dcc8;text-transform:uppercase}' + G + ' .guide-card span{color:#8a9494;font-size:11px}' +
  // the search form
  G + ' .guide-filters,' + G + ' .guide-map-position{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-end;margin:0 0 12px;padding:10px;background:#0b0e0e;border:1px solid #2c3232;border-radius:3px}' +
  G + ' label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#8a9494}' +
  G + ' input,' + G + ' select{box-sizing:border-box;height:24px;padding:2px 6px;font:12px Verdana,Arial,sans-serif;color:#cfd8d8;background:#15191a;border:1px solid #3a3d3d;border-radius:2px}' +
  G + ' input:focus,' + G + ' select:focus{outline:0;border-color:#7fb8ff}' +
  G + ' button{height:24px;padding:0 14px;font:12px Verdana,Arial,sans-serif;color:#e6dcc8;background:#252b2b;border:1px solid #3a3d3d;border-radius:2px;cursor:pointer}' +
  G + ' button:hover{background:#303838;color:#fff}' +
  G + ' .guide-filter-actions{display:flex;gap:10px;align-items:center}' +
  // the lists
  G + ' .guide-result-count,' + G + ' .guide-note{font-size:11px;color:#8a9494;margin:0 0 6px}' +
  G + ' .guide-table-scroll{overflow-x:auto;margin:0 0 10px}' +
  G + ' .guide-results{width:100%;border-collapse:collapse;border:0;background:none}' +
  G + ' .guide-results th{padding:5px 8px;text-align:left;font-weight:normal;color:#fff;background:#1b1f1f;border:0;border-bottom:1px solid #3a3d3d}' +
  G + ' .guide-results td{padding:4px 8px;border:0;border-bottom:1px solid #1c2020;background:none}' +
  G + ' .guide-results tbody tr:nth-child(2n){background:none}' + G + ' .guide-results tbody tr:hover td{background:#12181a}' +
  G + ' .guide-pagination{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;padding:0;border:0;background:none}' +
  G + ' .guide-pagination a,' + G + ' .guide-pagination span{padding:2px 8px;border:1px solid #2c3232;border-radius:2px;background:#0b0e0e;color:#a7ffff;text-decoration:none}' +
  G + ' .guide-pagination a:hover{background:#12181a;color:#fff}' +
  G + ' .guide-pagination [aria-current]{background:#1b1f1f;color:#fff;border-color:#3a3d3d}' +
  // an entry: its facts and its picture
  G + ' .guide-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0;margin:0 0 14px;padding:0;background:#0b0e0e;border:1px solid #2c3232;border-radius:3px;overflow:hidden}' +
  G + ' .guide-stats>div{background:none;margin:0 -1px -1px 0;padding:6px 10px;border-right:1px solid #1c2020;border-bottom:1px solid #1c2020}' + G + ' .guide-prose{overflow:hidden;margin:0 0 10px}' +
  G + ' .guide-stats dt{margin:0;font-size:11px;color:#8a9494}' + G + ' .guide-stats dd{margin:0;color:#fff;font-weight:bold}' +
  G + ' .guide-entry-art{float:right;margin:0 0 10px 14px;padding:3px;background:#0D0905;border:1px solid #3a3d3d;border-radius:3px}' +
  G + ' .guide-clear{clear:both}' +
  G + ' .guide-related{margin:0 0 6px}' +
  G + ' details{margin:0 0 8px;background:#0b0e0e;border:1px solid #2c3232;border-radius:3px}' +
  G + ' summary{padding:8px 12px;cursor:pointer;color:#a7ffff;font-weight:bold}' + G + ' summary:hover{background:#12181a}' +
  G + ' details>:not(summary){margin-left:12px;margin-right:12px}' +
  G + ' .guide-map-scroll{overflow:auto;max-width:100%;margin:0 0 10px;background:#000;border:1px solid #2c3232}' +
  G + ' .guide-panel-foot{display:none}';

export const isGuide = () => !!document.getElementById('official-guide') && /[?&]cmd=guide/.test(location.search);

export function initGuide() {
  const main = document.getElementById('official-guide');
  if (!main || document.getElementById('ssh-gd')) return;
  if (!document.getElementById('ssh-gd-css')) {
    const st = mel('style');
    st.id = 'ssh-gd-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  locationsCard(); // in both layouts
  fixMap(main);
  mapTip(main);
  wikiButton(main);
  ajax(main);
  const center = main.closest('.ssh-center');
  if (!center) return; // the Original layout: the game's own page, with the card
  // the content frame the other pages have (its pictures are the game's, on its CDN)
  const cf = mel('div', 'ssh-cf gd-w');
  const top = mel('div', 'cf-top gd-c');
  top.style.backgroundImage = 'url("' + SKIN + 'inner_top.jpg")';
  const mid = mel('div', 'cf-mid gd-w');
  const l = mel('div', 'cf-l gd-c');
  l.style.backgroundImage = 'url("' + SKIN + 'inner_lefttop.jpg"),url("' + SKIN + 'inner_left.jpg")';
  const body = mel('div', 'cf-body gd-w');
  body.style.backgroundImage = 'url("' + SKIN + 'inner_bg.jpg")';
  const r = mel('div', 'cf-r gd-c');
  r.style.backgroundImage = 'url("' + SKIN + 'inner_righttop.jpg"),url("' + SKIN + 'inner_right.jpg")';
  const bot = mel('div', 'cf-bot gd-c');
  bot.style.backgroundImage = 'url("' + SKIN + 'inner_bottom.jpg")';
  mid.append(l, body, r);
  cf.append(top, mid, bot);
  const page = steelContainer({ title: 'Official Guide' });
  page.classList.add('gd-w');
  page.querySelector('.ssh-content-header').classList.add('gd-c');
  page.querySelector('.ssh-content-footer').classList.add('gd-c');
  page.body.classList.add('gd-w');
  center.id = center.id || '';
  const root = mel('div', 'gd-w');
  root.id = 'ssh-gd';
  main.before(root);
  page.body.append(main);
  body.append(page);
  root.append(cf);
  addTab(main);
}

// The Locations section is in the guide but not in its tabs: one is added, next to Areas (the Modern layout)
function addTab(main) {
  const nav = main.querySelector('nav:not(.guide-pagination)');
  const areas = nav && [...nav.querySelectorAll('a')].find((a) => /section=areas/.test(a.getAttribute('href') || ''));
  if (areas && !nav.querySelector('a[href*="section=locations"]')) {
    const a = areas.cloneNode(false);
    a.removeAttribute('aria-current');
    a.setAttribute('href', areas.getAttribute('href').replace(/section=areas[^&]*/, 'section=locations').replace(/[?&]id=[^&]*/, ''));
    a.textContent = 'Locations';
    if (/[?&]section=locations/.test(location.search)) a.setAttribute('aria-current', 'page');
    areas.after(a);
  }
}

// The overview has a card for four sections and a plain link for the fifth: Locations gets a card too (with its number of entries, read from its list)
let count = '';
function locationsCard() {
  const cards = document.querySelector('#official-guide .guide-cards');
  const link = cards && cards.nextElementSibling && cards.nextElementSibling.querySelector('a[href*="section=locations"]');
  if (!cards || !link || cards.querySelector('a[href*="section=locations"]')) return;
  const card = cards.querySelector('.guide-card').cloneNode(true);
  card.setAttribute('href', link.getAttribute('href'));
  card.querySelector('strong').textContent = 'Locations';
  const n = card.querySelector('span');
  n.textContent = count;
  cards.append(card);
  if (count) return;
  fetch(link.href, { credentials: 'same-origin' }).then((r) => r.text()).then((t) => {
    const m = t.match(/([\d,]+)\s+matching\s+entr/i);
    if (m) { count = m[1] + ' entries'; n.textContent = count; }
  }).catch(() => {});
}

// Only the guide's content is loaded when a link or a search of the guide is used (the game's pages of the guide are plain pages: links and
// forms with GET): the answer's <main> replaces the content of this one, the address and the title change as for a page, Back and Forward
// work. Anything that is not clearly a page of the guide (another cmd, a new tab, a modifier key, no <main> in the answer) is left to the browser.
function ajax(main) {
  if (main.dataset.sshAjax) return;
  main.dataset.sshAjax = '1';
  let seq = 0;
  const guideUrl = (href) => {
    try {
      const u = new URL(href, location.href);
      return u.origin === location.origin && /index\.php$/.test(u.pathname) && u.searchParams.get('cmd') === 'guide' ? u : null;
    } catch (e) { return null; }
  };
  const same = (a, b) => ['section', 'id'].every((k) => (a.searchParams.get(k) || '') === (b.searchParams.get(k) || ''));
  async function load(u, push) {
    const my = ++seq;
    main.classList.add('gd-busy');
    try {
      const doc = parseHtml(await fetchText(u.href));
      const next = doc.getElementById('official-guide');
      if (!next) throw new Error('not a guide page');
      if (my !== seq) return; // a newer click is on its way
      const stay = same(u, new URL(location.href)); // the map's buttons, the sort of a list: where you are stays
      main.replaceChildren(...[...next.childNodes].map((n) => document.importNode(n, true)));
      document.title = doc.title || document.title;
      if (push) history.pushState({ gd: 1 }, '', u.href);
      locationsCard();
      fixMap(main);
      wikiButton(main);
      if (main.closest('.ssh-center')) addTab(main);
      const top = main.getBoundingClientRect().top;
      if (!stay && top < 0) window.scrollTo({ top: window.scrollY + top - 80 }); // the new page starts at its top (the header just above it)
    } catch (e) {
      if (my === seq) location.href = withToken(u.href);
      return;
    }
    main.classList.remove('gd-busy');
  }
  main.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !main.contains(a) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const u = guideUrl(a.getAttribute('href'));
    if (!u) return;
    e.preventDefault();
    load(u, true);
  });
  main.addEventListener('submit', (e) => {
    const f = e.target;
    if (e.defaultPrevented || !f || f.tagName !== 'FORM' || (f.method || 'get').toLowerCase() !== 'get') return;
    let u;
    try { u = new URL(f.getAttribute('action') || location.href, location.href); } catch (x) { return; }
    u.search = '';
    new FormData(f, e.submitter || undefined).forEach((v, k) => { if (typeof v === 'string' && v !== '') u.searchParams.set(k, v); });
    if (!guideUrl(u.href)) return;
    e.preventDefault();
    load(u, true);
  });
  window.addEventListener('popstate', () => { const u = guideUrl(location.href); if (u && document.getElementById('official-guide') === main) load(u, false); });
}

// The area map of the guide: the tiles are asked through asset.php (slow), here from the CDN like the real map. A location (a shop, a mechanic, a
// cloning facility ...) has its own picture (locations/<number>.gif, the number is the one of its page in the guide) in place of the tile, as on
// the real map. The guide does not say which picture a shop or a stairway has, so those two get an icon of the helper's on their tile; any other
// marker (a portal) stays the guide's dot.
const svg = (body) => 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' + body + '</svg>') + '")';
const ICON = {
  shops: svg('<circle cx="16" cy="16" r="12" fill="#000" opacity=".6"/><path d="M8 13h16l-1.5-5h-13zM9.5 13v10h13V13M14 23v-5h4v5" fill="none" stroke="#ffd25a" stroke-width="1.8" stroke-linejoin="round"/>'),
  stairways: svg('<circle cx="16" cy="16" r="12" fill="#000" opacity=".6"/><path d="M16 24V9m-6 6 6-7 6 7" fill="none" stroke="#3fbf5a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>')
};
const CDN = 'https://cdn.sigmastorm.com/';

function fixMap(main) {
  const q = new URLSearchParams(location.search);
  const area = q.get('section') === 'areas' ? q.get('id') || '' : '';
  const cells = [...main.querySelectorAll('.guide-map-cell')];
  if (!cells.length) return;
  // the list under the map: where each location, shop and stairway is
  const at = {};
  main.querySelectorAll('.guide-content li').forEach((li) => {
    const m = li.textContent.match(/·\s*(locations|shops|stairways|portals)\s*\((\d+),\s*(\d+)\)/i);
    if (!m) return;
    const a = li.querySelector('a[href]');
    let id = '', href = '';
    const kind = m[1].toLowerCase();
    if (a && kind === 'locations') { try { const u = new URL(a.getAttribute('href'), location.href); if (u.searchParams.get('section') === 'locations') { id = u.searchParams.get('id') || ''; href = a.getAttribute('href'); } } catch (e) { /* no picture */ } } else if (a && kind === 'stairways') href = a.getAttribute('href'); // a stairway: the page of the area it leads to
    (at[m[2] + ',' + m[3]] = at[m[2] + ',' + m[3]] || []).push({ kind, id, href });
  });
  cells.forEach((c) => {
    if (c.title) { c.dataset.tip = c.title; c.removeAttribute('title'); } // the tooltip is the helper's (below): it appears at once
    const st = c.getAttribute('style') || '';
    const m = st.match(/asset\.php\?path=([^)'"]+)/);
    if (m) c.style.backgroundImage = 'url("' + CDN + decodeURIComponent(m[1]) + '")';
    const dot = c.querySelector('[aria-label="Location"]');
    const xy = ((c.dataset.tip || '').match(/^\((\d+),\s*(\d+)\)/) || [])[0];
    if (!dot || !xy || c.dataset.gdMap) return;
    c.dataset.gdMap = '1';
    const list = at[xy.replace(/[() ]/g, '')] || [];
    const loc = list.find((x) => x.kind === 'locations' && x.id);
    const kind = ['shops', 'stairways'].find((k) => list.some((x) => x.kind === k));
    const pic = kind && ((DATA.guidemap[area] || {})[kind === 'shops' ? 's' : 'a'] || {})[xy.replace(/[() ]/g, '')]; // the picture, from the wiki's map of the area
    let href = '';
    if (loc) {
      c.style.backgroundImage = 'url("' + CDN + 'locations/' + loc.id + '.gif")';
      dot.remove();
      href = loc.href;
    } else if (kind) {
      if (pic) { c.style.backgroundImage = 'url("' + CDN + kind + '/' + pic + '")'; dot.remove(); } else { dot.textContent = ''; c.classList.add('gd-ico'); dot.style.cssText = 'display:block;width:100%;height:100%;border:0;outline:0;box-shadow:none;background:' + ICON[kind] + ' center / 26px 26px no-repeat'; }
      if (kind === 'stairways') href = (list.find((x) => x.kind === 'stairways' && x.href) || {}).href || '';
    }
    if (href) {
      const a = document.createElement('a'); // the page of the location, or of the area the stairway leads to
      a.className = 'gd-loc';
      a.href = href;
      c.append(a);
    }
  });
}

// The page of an item or of an area has a button to the same page in the community wiki (the page is named like the entry).
const WIKI = 'https://sigmastorm2.fandom.com/wiki/';
function wikiButton(main) {
  const q = new URLSearchParams(location.search);
  const h1 = main.querySelector('.guide-content > h1');
  if (!h1 || !['items', 'areas'].includes(q.get('section')) || !q.get('id') || h1.querySelector('.gd-wiki')) return;
  const name = h1.textContent.trim();
  if (!name) return;
  const a = document.createElement('a');
  a.className = 'gd-wiki';
  a.target = '_blank';
  a.rel = 'noopener';
  a.title = 'Open this page in the Wiki';
  a.href = WIKI + encodeURI(name.replace(/\s+/g, '_'));
  a.textContent = 'Wiki';
  h1.prepend(a);
}

// The tooltip of a map tile: at once (the browser's own waits), next to the pointer; the first line is the coordinates, the others the names.
function mapTip(main) {
  if (main.dataset.sshTip) return;
  main.dataset.sshTip = '1';
  let tip = null;
  const cell = (e) => (e.target.closest ? e.target.closest('.guide-map-cell[data-tip]') : null);
  main.addEventListener('mouseover', (e) => {
    const c = cell(e);
    if (!c) return;
    if (!tip) { tip = document.createElement('div'); tip.id = 'gd-tip'; document.body.append(tip); }
    const parts = c.dataset.tip.split(' · ');
    tip.textContent = '';
    parts.forEach((t, i) => {
      const d = document.createElement(i ? 'div' : 'b');
      d.textContent = t;
      tip.append(d);
    });
    tip.style.display = 'block';
  });
  main.addEventListener('mousemove', (e) => {
    if (!tip || tip.style.display === 'none') return;
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 6);
    const y = Math.min(e.clientY + 16, window.innerHeight - tip.offsetHeight - 6);
    tip.style.left = Math.max(0, x) + 'px';
    tip.style.top = Math.max(0, y) + 'px';
  });
  main.addEventListener('mouseout', (e) => { if (tip && cell(e)) tip.style.display = 'none'; });
}
