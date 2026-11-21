import { mel } from '../layout/dom.js';
import { tableToDivs } from '../layout/tablediv.js';
import { fetchText } from '../core/net.js';
import { esc, parseHtml } from '../core/util.js';
import { loadSkill, scaleDesc, skillInfo } from '../tooltips/skills.js';

// The Skills page (cmd=skills) for the Modern layout: a copy of the game's tables made of divs (layout/tablediv.js); the game's own table stays
// in the page, hidden in the Modern layout, so the Original layout is untouched. The forms of the details panel (add points, activate) are
// copies that work like the originals. Every skill of the tree has a tooltip with what it does, scaled to the points put into it.

const CSS = 'html.ssh-modern [data-ssh-st]{display:none!important}#ssh-st{display:none}html.ssh-modern #ssh-st{display:block}' +
  '#ssh-st .tg{min-width:min-content}'; // a table is never narrower than what is in it (a 412 wide table in a 300 wide one makes it 412)

export const isSkillTree = () => !!document.querySelector('td[background*="header_skills"]');

export function initSkillTree() {
  const head = document.querySelector('td[background*="header_skills"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-st')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-st', '1');
  const root = mel('div');
  root.id = 'ssh-st';
  const trim = (t) => { t.setAttribute('data-tg-trim', '1'); t.querySelectorAll('table').forEach((x) => x.setAttribute('data-tg-trim', '1')); }; // empty columns at the end of a table take no width, as in the game's tables
  // the skills of a tree table of the game's page, in page order: the number in the link, the name over the picture, the points under it;
  // they are put on the pictures of the converted copy (the same order)
  const decorate = (tree, copy) => {
    const orig = [...tree.querySelectorAll('a[href*="skill_id="] img')].map((im) => {
      const a = im.closest('a');
      const cell = a.closest('table');
      const rows = cell ? [...cell.rows] : [];
      return {
        id: (a.getAttribute('href').match(/skill_id=(\d+)/) || [])[1],
        name: cell && cell.querySelector('b') ? cell.querySelector('b').textContent.trim() : '',
        pts: rows.length ? parseInt(rows[rows.length - 1].textContent, 10) || 0 : 0,
      };
    });
    [...copy.querySelectorAll('a[href*="skill_id="] img')].forEach((im, i) => {
      const o = orig[i];
      if (!o || !o.id) return;
      im.removeAttribute('onmouseover'); // the game's "[ Click for Details ]" tip is replaced by the skill's own
      im.dataset.sid = o.id;
      im.dataset.name = o.name;
      im.dataset.pts = String(o.pts);
      if (!skillInfo(o.id)) loadSkill(o.id).catch(() => {}); // not in the built-in list: read once, kept for the next hover
    });
  };
  const treeOf = (scope) => scope.querySelector('table[background*="skill_bg"]');
  const tree0 = treeOf(table);
  if (tree0) tree0.id = 'ssh-sk-tree'; // the converted copy keeps the id: it is what a tab replaces
  const pcell = table.querySelector('table[width="573"] td[width="150"]'); // the details panel on the right
  if (pcell) pcell.dataset.tgClass = 'sk-panel';
  trim(table);
  const grid = tableToDivs(table);
  if (tree0) decorate(tree0, grid);
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
    const cell = root.querySelector('.sk-panel');
    const holder = cell && cell.firstElementChild;
    if (!holder) { location.href = href; return; }
    const mine = ++seq;
    cell.style.opacity = '.45';
    try {
      const doc = parseHtml(await fetchText(href));
      const td = doc.querySelector('table[width="573"] td[width="150"]');
      if (!td) throw new Error('no panel');
      if (mine !== seq) return; // a newer click is on its way
      const tmp = document.createElement('table'); // the panel's content in a one-cell table, converted like the rest
      tmp.setAttribute('cellpadding', '0');
      tmp.setAttribute('cellspacing', '0');
      tmp.insertRow().insertCell().append(...td.childNodes);
      tmp.setAttribute('data-tg-trim', '1');
      tmp.querySelectorAll('table').forEach((t) => t.setAttribute('data-tg-trim', '1'));
      holder.replaceChildren(...tableToDivs(tmp).firstElementChild.firstElementChild.childNodes);
      if (push) {
        const u = new URL(href, location.href);
        history.pushState(null, '', 'index.php?cmd=skills&tree_id=' + (u.searchParams.get('tree_id') || '0') + '&skill_id=' + (u.searchParams.get('skill_id') || ''));
      }
    } catch (e) {
      if (mine === seq) location.href = href; // the page the old way
      return;
    } finally {
      if (mine === seq) cell.style.opacity = '';
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
      const t = treeOf(doc);
      if (!t) throw new Error('no tree');
      if (mine !== seq) return;
      t.id = 'ssh-sk-tree';
      const pc = t.querySelector('table[width="573"] td[width="150"]');
      if (pc) pc.dataset.tgClass = 'sk-panel';
      trim(t);
      const copy = tableToDivs(t);
      decorate(t, copy);
      old.replaceWith(copy);
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
  root.append(grid);
  table.after(root);
}
