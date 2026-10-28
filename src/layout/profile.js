import { decorateHeader, refreshDur, restoreHeader, updateHeader } from '../banner.js';
import { dropEarlyM } from '../core/constants.js';
import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { BP, bpUse, compDestroy, compLoad } from './backpack.js';
import { csOpen } from './combatsets.js';
import { mel, proxify } from './dom.js';
import { pfSection, pfSections } from './sections.js';
import { buildFrame, unbuildFrame } from './frame.js';
import { buildSidebars, unbuildSidebars } from './sidebars.js';
import { THEMES, mCss, onProfile } from './theme.js';

// Dim the whole profile content while it is being replaced (gear changed: the stats move too).
export function profBusy(on) {
  const r = document.getElementById('ssh-prof');
  if (r) r.classList.toggle('loading', on);
}

// The game writes `<form>` as an empty tag in front of its controls, and the browser ties the controls to it only while it
// parses the page. Nodes that were moved or copied into the page lose that, so tie them to the form again: every control
// after an empty form, inside the same table, belongs to it.
function fixForms(root) {
  [...root.querySelectorAll('form')].forEach((f, i) => {
    const tb = f.closest('table');
    if (f.elements.length || !tb) return;
    if (!f.id) f.id = 'ssh-form' + i;
    tb.querySelectorAll('input, select, textarea, button').forEach((el) => {
      if (!el.form && (f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) el.setAttribute('form', f.id);
    });
  });
}

// Replace the whole profile content (stats, equipment, bag, components, buffs...) with a fresh copy.
export async function refreshProfile() {
  const old = document.querySelector('table[data-ssh-orig]');
  const root = document.getElementById('ssh-prof');
  if (!old || !root) return false;
  const html = await (await fetch(BP.url || 'index.php?cmd=profile', { credentials: 'same-origin' })).text();
  const nt = new DOMParser().parseFromString(html, 'text/html').querySelector('table[background*="large_content_bg"]');
  if (!nt) return false;
  const fresh = document.adoptNode(nt);
  old.replaceWith(fresh);
  fixForms(fresh);
  root.remove();
  if (window.ajaxLoadItem && window.ajaxLoadItem.clear) window.ajaxLoadItem.clear();
  try { buildProfile(fresh); } catch (e) { console.warn('[Sigmastorm Helper] modern layout failed', e); }
  updateHeader(html);
  refreshDur(0);
  return true;
}

function onProfClick(e) {
  const t = e.target;
  if (!t || typeof t.closest !== 'function' || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const ua = t.closest('.inv .slot a[href]'); // clicking an equipped item takes it off
  if (ua && BP.box && /subcmd=unequipitem/.test(ua.getAttribute('href') || '')) { e.preventDefault(); bpUse(ua); return; }
  const ca = t.closest('.comp a[href]');
  if (!ca) return;
  const h = ca.getAttribute('href') || '';
  if (/subcmd=destroycomponent/.test(h)) { e.preventDefault(); compDestroy(h); } else if (/component_page=/.test(h)) { e.preventDefault(); compLoad(h); }
}

function buildProfile(table) {
  const T = THEMES[S.theme];
  const tabs = [...table.querySelectorAll('table')];
  const cols = tabs.filter((t) => /profile_sub_bg/.test(t.getAttribute('background') || ''));
  if (!cols.length) return null;
  const root = mel('div');
  root.id = 'ssh-prof';
  root.dataset.theme = S.theme;
  root.append(mel('div', 'pf-title'));
  const ib = tabs.find((t) => /general_info_bg/.test(t.getAttribute('background') || ''));
  const ic = ib && ib.querySelector('center');
  if (ic) {
    const w = mel('div', 'pf-info');
    const m = mel('div', 'm');
    m.append(proxify(ic));
    w.append(mel('div', 't'), m, mel('div', 'f'));
    root.append(w);
  }
  const grid = mel('div', 'pf-cols');
  let n = 0;
  cols.forEach((col) => {
    const c = mel('div', 'col');
    pfSections(col).forEach((s) => { c.append(pfSection(s, T)); n++; });
    grid.append(c);
  });
  if (n < 3) return null;
  // "Combat Sets" opens our own dialog (use / delete / save a set) instead of the game's hidden form
  const cl = [...grid.querySelectorAll('.s-inventory .hx a')].find((a) => /Combat Sets/i.test(a.textContent));
  if (cl) {
    cl.removeAttribute('onclick');
    cl.setAttribute('href', '#');
    cl.addEventListener('click', (e) => { e.preventDefault(); csOpen(); });
  }
  root.append(grid, mel('div', 'pf-foot'));
  root.addEventListener('click', onProfClick);
  table.setAttribute('data-ssh-orig', '1');
  table.parentNode.insertBefore(root, table.nextSibling);
  return root;
}

function applyLayout() {
  const modern = S.layout === 'modern';
  if (modern && onProfile) {
    let root = document.getElementById('ssh-prof');
    if (root && root.dataset.theme !== S.theme) { root.remove(); root = null; }
    if (!root) {
      const table = document.querySelector('table[background*="large_content_bg"]');
      try { root = table && buildProfile(table); } catch (e) { root = null; console.warn('[Sigmastorm Helper] modern layout failed', e); }
      if (!root && table) table.removeAttribute('data-ssh-orig');
    }
  }
  let st = document.getElementById('ssh-mstyle');
  if (!st) { st = document.createElement('style'); st.id = 'ssh-mstyle'; document.head.appendChild(st); }
  st.textContent = mCss();
  dropEarlyM();
  document.documentElement.classList.toggle('ssh-modern', modern);
  // the page around the content: divs (a banner, two columns of widgets you can rearrange, a footer) in the Modern layout, the game's own
  // table otherwise
  if (modern) { buildFrame(); decorateHeader(); buildSidebars(); } else { unbuildSidebars(); restoreHeader(); unbuildFrame(); decorateHeader(); }
  const sel = document.querySelector('#ssh-lay select');
  if (sel) { sel.style.display = modern ? '' : 'none'; sel.value = S.theme; }
  document.querySelectorAll('#ssh-lay button').forEach((b) => b.classList.toggle('on', b.dataset.l === S.layout));
}

function layoutToggle() {
  if (document.getElementById('ssh-lay') || !document.body) return;
  const d = mel('div');
  d.id = 'ssh-lay';
  d.innerHTML = '<button type="button" data-l="orig" title="The game\'s own layout">Original</button><button type="button" data-l="modern" title="Rebuilt with modern CSS">Modern</button>' +
    '<select title="Theme">' + Object.keys(THEMES).map((k) => '<option value="' + k + '">' + THEMES[k].name + '</option>').join('') + '</select>';
  d.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button[data-l]');
    if (!b) return;
    S.layout = b.dataset.l;
    store.set('layout', S.layout);
    applyLayout();
  });
  d.querySelector('select').addEventListener('change', (e) => {
    S.theme = e.target.value;
    store.set('theme', S.theme);
    applyLayout();
  });
  document.body.appendChild(d);
}

export function initLayout() {
  layoutToggle();
  applyLayout();
}
