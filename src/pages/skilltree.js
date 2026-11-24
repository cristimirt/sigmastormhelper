import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { tableToDivs } from '../layout/tablediv.js';
import { fetchText } from '../core/net.js';
import { S } from '../core/state.js';
import { cssUrl, esc, https, parseHtml } from '../core/util.js';
import { alertModal, gAlerts } from '../layout/modal.js';
import { loadSkill, scaleDesc, skillInfo } from '../tooltips/skills.js';

// The Skills page (cmd=skills) for the Modern layout, in the steel container (layout/steel.js). The game draws it with tables inside tables and spacer
// cells; here it is a few divs: .sk-guide, .sk-intro, .sk-points, .sk-tabs (the five trees), and .sk-tree: .sk-top (the tree's name), .sk-strip (the
// level labels, a picture), .sk-tiers (.sk-tier: a row of .sk-skill, each with its name, picture and points) and .sk-panel (the details of the
// skill that was clicked: add points, activate; the game's forms, made of divs). The game's own table stays in the page, hidden in the Modern
// layout, so the Original layout is untouched. Every skill has a tooltip with what it does, scaled to the points put into it.

const CSS = 'html.ssh-modern [data-ssh-st]{display:none!important}#ssh-st{display:none}html.ssh-modern #ssh-st{display:block}' +
  '#ssh-st .ssh-content-body{padding:0 0 20px}' + // the pieces of this page are 570 to 620 wide: they are centred in the 640
  '#ssh-st .sk-guide{padding:20px 0 14px;text-align:center}' +
  '#ssh-st .sk-intro{width:570px;margin:0 auto 14px;text-align:left}#ssh-st .sk-intro p{margin:0}' +
  '#ssh-st .sk-points{margin-bottom:14px;text-align:center}' +
  '#ssh-st .sk-tabs{display:flex;width:600px;margin:0 auto 12px}#ssh-st .sk-tabs a{flex:1 1 0;line-height:0;text-align:center}#ssh-st .sk-tabs img{width:108px;max-width:100%;height:auto}' + // the frame of the page leaves 613 px inside: five cells as wide as the tree, with the tab pictures (108 px, as the game shows them) in the middle of each: a space between them +
  '#ssh-st .sk-tree{width:600px;margin:0 auto}' +
  '#ssh-st .sk-top{height:30px;display:flex;align-items:center;justify-content:center;background-repeat:no-repeat;background-position:center}' +
  '#ssh-st .sk-main{display:flex}#ssh-st .sk-strip{flex:0 0 25px}' +
  '#ssh-st .sk-body{display:flex;gap:5px;align-items:flex-start;flex:1;padding-right:18px}' +
  '#ssh-st .sk-tiers{flex:0 0 412px;min-width:0;display:flex;flex-direction:column;align-items:center;gap:69px;padding:35px 0}' +
  '#ssh-st .sk-tier{display:flex;justify-content:center}' +
  '#ssh-st .sk-bottom{background-repeat:no-repeat;background-position:center top}' +
  '#ssh-st .sk-skill{width:70px;height:96px;display:flex;flex-direction:column;align-items:center;text-align:center}' +
  '#ssh-st .sk-name{height:30px;display:flex;align-items:center;justify-content:center}' +
  '#ssh-st .sk-skill a{display:block;line-height:0;height:49px}#ssh-st .sk-pts{height:14px}' +
  '#ssh-st .sk-panel{flex:0 0 138px;min-width:0}'; // as wide as the game's table makes them (412 + 5 + 138 + 18 next to the 25 of the level labels)

export const isSkillTree = () => !!document.querySelector('td[background*="header_skills"]');

const bgOf = (e) => (e ? cssUrl(e.getAttribute('background')) : 'none');
const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');

// The details panel: the game's cell with its tables, as divs (a one-cell table made around the content, converted, its content taken out).
function panelOf(td) {
  const holder = mel('div', 'sk-panel');
  if (!td) return holder;
  const tmp = document.createElement('table');
  tmp.setAttribute('cellpadding', '0');
  tmp.setAttribute('cellspacing', '0');
  tmp.insertRow().insertCell().append(...[...td.childNodes].map((n) => n.cloneNode(true)));
  tmp.setAttribute('data-tg-trim', '1');
  tmp.querySelectorAll('table').forEach((x) => x.setAttribute('data-tg-trim', '1'));
  holder.replaceChildren(...tableToDivs(tmp).firstElementChild.firstElementChild.childNodes);
  return holder;
}

// One skill tree of the game's page (the table with the skill_bg picture): -> the .sk-tree div. A skill's picture carries what the tooltip needs.
function treeOf(t) {
  const tree = mel('div', 'sk-tree');
  tree.id = 'ssh-sk-tree';
  tree.style.backgroundImage = bgOf(t);
  const topCell = t.querySelector('td[background*="skill_top"]');
  const top = mel('div', 'sk-top');
  top.style.backgroundImage = bgOf(topCell);
  if (topCell) top.append(...[...topCell.childNodes].map((n) => n.cloneNode(true)));
  const strip = mel('div', 'sk-strip');
  strip.style.backgroundImage = bgOf(t.querySelector('td[background*="level_strip"]'));
  const tiers = mel('div', 'sk-tiers');
  t.querySelectorAll('table[width="412"] > tbody > tr > td > table').forEach((tt) => {
    const tier = mel('div', 'sk-tier');
    tier.style.gap = (parseInt((tt.rows[0].cells[1] || {}).getAttribute && tt.rows[0].cells[1].getAttribute('width'), 10) || 15) + 'px'; // the game's spacer between the skills
    tt.querySelectorAll('table[width="70"]').forEach((cell) => {
      const link = cell.querySelector('a[href*="skill_id="]');
      const im = link && link.querySelector('img');
      if (!im) return;
      const rows = [...cell.rows];
      const sk = mel('div', 'sk-skill');
      sk.style.backgroundImage = bgOf(cell); // the frame behind the skill
      const name = mel('div', 'sk-name');
      const label = rows.find((r) => r.querySelector('b'));
      if (label) name.append(...[...label.cells[0].childNodes].map((n) => n.cloneNode(true)));
      const a = link.cloneNode(false);
      const pic = im.cloneNode(false);
      ['onmouseover', 'onmouseout'].forEach((o) => pic.removeAttribute(o)); // the game's "[ Click for Details ]" tip is replaced by the skill's own
      pic.src = https(im.getAttribute('src'));
      const id = (link.getAttribute('href').match(/skill_id=(\d+)/) || [])[1];
      const pts = rows.length ? parseInt(rows[rows.length - 1].textContent, 10) || 0 : 0;
      pic.dataset.sid = id;
      pic.dataset.name = txt(label);
      pic.dataset.pts = String(pts);
      if (id && !skillInfo(id)) loadSkill(id).catch(() => {}); // not in the built-in list: read once, kept for the next hover
      a.append(pic);
      const pe = mel('div', 'sk-pts');
      pe.textContent = String(pts);
      sk.append(name, a, pe);
      tier.append(sk);
    });
    tiers.append(tier);
  });
  const body = mel('div', 'sk-body');
  const area = t.querySelector('table[width="573"]');
  if (area && area.getAttribute('style')) body.style.cssText = area.getAttribute('style'); // the tree's own background picture (and how it repeats)
  body.append(tiers, panelOf(t.querySelector('table[width="573"] td[width="150"]')));
  const main = mel('div', 'sk-main');
  main.append(strip, body);
  tree.append(top, main);
  const bot = t.querySelector('td[background*="skill_bottom"]');
  if (bot) {
    const b = mel('div', 'sk-bottom');
    b.style.cssText = 'height:' + (parseInt(bot.getAttribute('height'), 10) || 20) + 'px;background-image:' + bgOf(bot);
    tree.append(b);
  }
  return tree;
}

const treeTable = (scope) => scope.querySelector('table[background*="skill_bg"]');

export function initSkillTree() {
  const head = document.querySelector('td[background*="header_skills"]');
  const table = head && head.closest('table[width="640"]');
  const t0 = table && treeTable(table);
  if (!table || !t0 || document.getElementById('ssh-st')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-st', '1');
  const root = steelContainer({ header: head.getAttribute('background') });
  root.id = 'ssh-st';
  const guide = table.querySelector('a[href*="subcmd=guide"]');
  if (guide) { const g = mel('div', 'sk-guide'); g.append('[ ', guide.cloneNode(true), ' ]'); root.body.append(g); }
  const intro = table.querySelector('table[width="570"] p');
  if (intro) { const i = mel('div', 'sk-intro'); i.append(intro.cloneNode(true)); root.body.append(i); }
  const points = [...table.querySelectorAll('td')].find((td) => !td.querySelector('td') && /Skill Points Available/i.test(td.textContent));
  if (points) { const p = mel('div', 'sk-points'); p.append(...[...points.childNodes].map((n) => n.cloneNode(true))); root.body.append(p); }
  const tabs = mel('div', 'sk-tabs');
  table.querySelectorAll('table[width="620"] a').forEach((a) => {
    const c = a.cloneNode(true);
    c.querySelectorAll('img').forEach((im) => { im.src = https(im.getAttribute('src')); im.removeAttribute('onmouseover'); });
    tabs.append(c);
  });
  root.body.append(tabs, treeOf(t0));
  root.addEventListener('mouseover', (e) => {
    const im = e.target && e.target.closest && e.target.closest('img[data-sid]');
    if (!im || typeof window.Tip !== 'function') return;
    const pts = +im.dataset.pts || 0;
    const s = skillInfo(im.dataset.sid);
    let h = '<center><b>' + esc(im.dataset.name) + '</b><br>' + (pts ? pts + (pts === 1 ? ' point' : ' points') : 'No points yet') + '</center>';
    if (s) h += '<div class="sk">' + (pts ? scaleDesc(s.d, pts) : esc(s.d)) + (s.x && s.x.length ? '<div class="sx">' + s.x.map(esc).join(' &middot; ') + '</div>' : '') + '</div>';
    else h += '<div class="sk"><span class="sx">Loading...</span></div>';
    h += '<div class="sx" style="margin-top:4px;text-align:center">[ Click for Details ]</div>';
    if (typeof window.tt_setWidth === 'function') window.tt_setWidth(260);
    window.Tip(h);
  });
  // A click on a skill reads the page in the background and only the details panel is replaced (the address follows, Back works).
  let seq = 0;
  async function openSkill(href, push) {
    const holder = root.querySelector('.sk-panel');
    if (!holder) { location.href = href; return; }
    const mine = ++seq;
    holder.style.opacity = '.45';
    try {
      const doc = parseHtml(await fetchText(href));
      const td = doc.querySelector('table[width="573"] td[width="150"]');
      if (!td) throw new Error('no panel');
      if (mine !== seq) return; // a newer click is on its way
      holder.replaceChildren(...panelOf(td).childNodes);
      if (push) {
        const u = new URL(href, location.href);
        history.pushState(null, '', 'index.php?cmd=skills&tree_id=' + (u.searchParams.get('tree_id') || '0') + '&skill_id=' + (u.searchParams.get('skill_id') || ''));
      }
    } catch (e) {
      if (mine === seq) location.href = href; // the page the old way
      return;
    } finally {
      if (mine === seq) holder.style.opacity = '';
    }
  }
  // A click on a tab (Core, Mutant ...) replaces the whole tree the same way.
  async function openTree(href, push) {
    const old = root.querySelector('#ssh-sk-tree');
    if (!old) { location.href = href; return; }
    const mine = ++seq;
    old.style.opacity = '.45';
    try {
      const doc = parseHtml(await fetchText(href));
      const t = treeTable(doc);
      if (!t) throw new Error('no tree');
      if (mine !== seq) return;
      old.replaceWith(treeOf(t));
      if (push) {
        const u = new URL(href, location.href);
        history.pushState(null, '', 'index.php?cmd=skills&tree_id=' + (u.searchParams.get('tree_id') || '0'));
      }
    } catch (e) {
      if (mine === seq) location.href = href;
      return;
    } finally {
      if (mine === seq) old.style.opacity = '';
    }
  }
  root.addEventListener('click', (e) => {
    const tab = e.target && e.target.closest && e.target.closest('a[href*="tree_id="]:not([href*="skill_id="])');
    if (tab && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.button) { e.preventDefault(); openTree(tab.href, true); return; }
    const a = e.target && e.target.closest && e.target.closest('a[href*="skill_id="]');
    if (!a || !a.querySelector('img[data-sid]') || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    openSkill(a.href, true);
  });
  window.addEventListener('popstate', () => { if (document.getElementById('ssh-st')) openTree(location.href, false); });
  table.after(root);
  // the game's answer to Add Points ("You do not have enough unallocated skill points", "This allocation exceeds the skill point limit") is a box in
  // its own table, which is hidden with it in the Modern layout: it is shown as a dialog
  const msgs = gAlerts(document);
  if (msgs.length && S.layout === 'modern') alertModal(msgs);
}
