import { fetchText, navigate } from '../core/net.js';
import { alertBad, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { alertModal, gAlerts, mModal, showBusy } from '../layout/modal.js';
import { steelFromTable } from '../layout/steel.js';
import { S } from '../core/state.js';
import { initPathfinderPage } from '../pathfinder/panel.js';

// The Transit Portal page (cmd=portal&portal_id=N) for the Modern layout: a copy of the game's tables made of divs (layout/tablediv.js); the game's
// table stays in the page, hidden in the Modern layout, so the Original layout is untouched. A Travel Here button asks first (a dialog of the
// helper's), then the same request is sent in the background; the game's message shows in a dialog, else the world page is shown.

const CSS = 'html.ssh-modern [data-ssh-pt]{display:none!important}#ssh-pt{display:none}html.ssh-modern #ssh-pt{display:block}' +
  '#ssh-pt form{margin:0}#ssh-pt input[type=submit]{cursor:pointer}#ssh-pt input[disabled]{opacity:.5;cursor:default}';

export const isPortal = () => !!document.querySelector('td[background*="header_transitportal"]');

async function travel(form, btn) {
  const old = btn.value;
  btn.disabled = true;
  btn.value = 'Travelling...';
  const done = showBusy();
  try {
    const html = await fetchText(form.getAttribute('action') || 'index.php', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
    const alerts = gAlerts(parseHtml(html));
    if (alerts.length && alertBad(alerts)) { done(); alertModal(alerts); btn.disabled = false; btn.value = old; return; }
    navigate('index.php?cmd=world'); // the overlay stays until the page is left
  } catch (e) {
    done();
    btn.disabled = false;
    btn.value = old;
    const m = mel('div');
    m.textContent = 'The travel could not be started.';
    mModal('Transit Portal', m, [{ text: 'OK' }]);
  }
}

export function initPortal() {
  const head = document.querySelector('td[background*="header_transitportal"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-pt')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const root = steelFromTable(table);
  root.id = 'ssh-pt';
  table.setAttribute('data-ssh-pt', '1');
  table.after(root);
  if (S.layout === 'modern') initPathfinderPage(root);
  root.querySelectorAll('form').forEach((f) => f.removeAttribute('onsubmit'));
  root.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    e.preventDefault();
    e.stopPropagation();
    const btn = form.querySelector('input[type="submit"]');
    if (!btn || btn.disabled) return;
    const body = mel('div');
    body.textContent = form.getAttribute('data-sigma-confirm') || 'Are you sure you wish to travel to this destination?';
    mModal('Transit Portal', body, [{ text: 'Cancel' }, { text: 'Travel', fn: () => travel(form, btn) }]);
  }, true);
}
