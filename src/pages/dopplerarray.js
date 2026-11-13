import { DATA } from '../core/data.js';
import { withToken } from '../core/net.js';
import { cssUrl, fmt, https } from '../core/util.js';
import { S } from '../core/state.js';
import { mel } from '../layout/dom.js';
import { BM_CSS, behMenu } from './behmenu.js';

// The Doppler Array page (cmd=guild&subcmd=dopplerarray) for the Modern layout: a list of divs made from the game's table (the game's own table
// stays in the page, hidden in the Modern layout, so the Original layout is untouched). Each behemoth has its name under the picture (the
// picture's title), a link to its Guide page (the picture's number is the creature's), and its realm links to the Guide's page of the area (the
// number is in data/realms.json, else the Guide's search for the name). The faction's kills show as the share of the kills made so far, the share
// of the behemoth's whole health, and whether the drop is secured (half of the health or more) or cannot be any more.

const CSS = BM_CSS + 'html.ssh-modern [data-ssh-da]{display:none!important}#ssh-da{display:none}html.ssh-modern #ssh-da{display:block}' +
  '#ssh-da{padding:14px 20px 20px;box-sizing:border-box;width:640px;margin:0 auto;text-align:left;color:#fff}' +
  '#ssh-da .da-hd{height:54px;margin:-14px -20px 12px;background:center top no-repeat}' +
  '#ssh-da .da-ft{height:54px;margin:14px -20px -20px;background:center top no-repeat}' +
  '#ssh-da a{color:#a7ffff;text-decoration:none}#ssh-da a:hover{color:#fff}' +
  '#ssh-da .da-txt{margin:0 0 12px}' +
  '#ssh-da .da-t{display:grid;grid-template-columns:minmax(130px,1.2fr) minmax(0,1.2fr) minmax(0,.8fr) minmax(150px,1.3fr);width:540px;max-width:100%;margin:0 auto}' +
  '#ssh-da .da-h{background:#212323;font-size:10px;text-align:center;padding:3px}' +
  '#ssh-da .da-c{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6px 4px;border-bottom:1px solid #212323}' +
  '#ssh-da .da-c img{display:block;height:100px;width:auto;border:0}' +
  '#ssh-da .da-nm{margin-top:4px;font-size:10px}' +
  '#ssh-da .da-k b{font-size:12px}#ssh-da .da-k small{display:block;color:#c9d4d4;font-size:10px;margin-top:2px}#ssh-da .da-k small b{font-size:10px;color:#fff;font-weight:normal}' +
  '#ssh-da .da-ok{color:#4cdc4c;font-weight:bold;margin-top:3px}#ssh-da .da-no{color:#ff5a4a;font-weight:bold;margin-top:3px}';

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 + '%' : '-');
const link = (href, html) => { const a = mel('a', '', html); a.href = withToken(href); return a; };
const guide = (q) => 'index.php?cmd=guide&' + q;

function realmHref(name) {
  const id = DATA.realms && DATA.realms[name];
  return id ? guide('section=areas&id=' + id) : guide('section=areas&q=' + encodeURIComponent(name).replace(/%20/g, '+'));
}

// the numbers of a behemoth: HP "now/most", and the faction's kills
function killsBox(hp, mine) {
  const m = /([\d,]+)\s*\/\s*([\d,]+)/.exec(hp);
  const k = parseInt(String(mine).replace(/[^\d]/g, ''), 10) || 0;
  const box = mel('div', 'da-k');
  box.append(mel('b', '', fmt(k)));
  if (!m) return box;
  const now = parseInt(m[1].replace(/,/g, ''), 10);
  const max = parseInt(m[2].replace(/,/g, ''), 10);
  const made = Math.max(0, max - now); // the kills made on it so far, by every faction
  box.append(mel('small', '', pct(k, made) + ' of the kills so far'), mel('small', '', 'Total: <b>' + pct(k, max) + '</b> of its health'));
  if (k * 2 >= max) box.append(mel('div', 'da-ok', 'Secured'));
  else if (k + now < Math.floor(max / 2) + 1) box.append(mel('div', 'da-no', 'Cannot secure')); // not even every kill left would be enough
  return box;
}

export const isDoppler = () => !!document.querySelector('td[background*="header_dopplerarray"]');

export function initDoppler() {
  const head = document.querySelector('td[background*="header_dopplerarray"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-da')) return;
  const rows = [...table.querySelectorAll('tr[data-doppler-creature]')];
  if (!rows.length && !table.querySelector('table[width="500"]')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-da', '1');
  const root = mel('div');
  root.id = 'ssh-da';
  const bg = table.getAttribute('background'); // the content picture of the game's table (the same as on the other pages)
  if (bg) root.style.backgroundImage = cssUrl(bg);
  const hd = mel('div', 'da-hd'); // the title bar picture
  hd.style.backgroundImage = 'url("' + https(head.getAttribute('background')) + '")';
  root.append(hd);
  root.append(behMenu('doppler'));
  const intro = [...table.querySelectorAll('td')].find((td) => !td.querySelector('td') && /^The Doppler Array/.test(td.textContent.trim()));
  if (intro) root.append(mel('div', 'da-txt', '')), (root.lastChild.textContent = intro.textContent.trim());
  const grid = mel('div', 'da-t');
  ['Behemoth', 'Realm', 'Behemoth HP', 'Your Faction Kills'].forEach((h) => grid.append(mel('div', 'da-h', h)));
  rows.forEach((tr) => {
    const c = tr.cells;
    const im = c[0] && c[0].querySelector('img');
    const name = (im && im.getAttribute('title')) || '';
    const src = im ? im.getAttribute('src') || '' : '';
    const id = (src.match(/creatures\/(\d+)/) || [])[1];
    const first = mel('div', 'da-c');
    if (im) {
      const pic = mel('img');
      pic.src = https(new URL(src, location.href).href);
      pic.alt = name;
      pic.title = name;
      first.append(id ? link(guide('section=entities&id=' + id), '') : mel('span'));
      first.lastChild.append(pic);
    }
    if (name) first.append(Object.assign(mel('div', 'da-nm'), {}));
    if (name) first.lastChild.append(id ? link(guide('section=entities&id=' + id), name) : document.createTextNode(name));
    const realm = (c[1] ? c[1].textContent : '').trim();
    const rc = mel('div', 'da-c');
    if (realm) rc.append(link(realmHref(realm), '')), (rc.lastChild.textContent = realm);
    const hpc = mel('div', 'da-c', '');
    const hp = (c[2] ? c[2].textContent : '').trim();
    hpc.textContent = hp;
    const kc = mel('div', 'da-c');
    kc.append(killsBox(hp, c[3] ? c[3].textContent : '0'));
    grid.append(first, rc, hpc, kc);
  });
  root.append(grid);
  const ft = mel('div', 'da-ft'); // the footer picture (the helper's own HD one)
  const fd = table.querySelector('td[background*="large_content_footer"]');
  ft.style.backgroundImage = S.base ? cssUrl(S.base + 'media/large_content_footer.png') : cssUrl(fd ? fd.getAttribute('background') : '');
  root.append(ft);
  table.after(root);
}
