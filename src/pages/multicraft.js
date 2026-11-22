import { fetchText, navigate } from '../core/net.js';
import { alertBad, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { gAlerts, mModal, richHtml } from '../layout/modal.js';

// A blueprint's page (cmd=inventing&subcmd=viewrecipe): a number box next to the Invent button says how many times to craft the item. The game's
// form is sent that many times, one after the other (its one-time quote changes with every answer, so each request is made from the form of the
// answer before it, or of a fresh read of the blueprint's page when the answer has none). It stops at the first message of the game that is an
// error or a warning (not enough credits, items missing ...), and a dialog tells how many were made and what the game said last. With 1 the
// game's own form is sent as it is.

const MAX = 100;
const FORM = 'form#assembly-invent';

const css = () => {
  if (document.getElementById('ssh-mc-css')) return;
  const s = mel('style');
  s.id = 'ssh-mc-css';
  s.textContent = '.ssh-rc p[align="center"]{text-align:center!important}' + FORM + ' .ssh-qty{width:46px;height:22px;box-sizing:border-box;margin-right:6px;padding:2px 4px;background:#0b0e0e;color:#d8cfbf;border:1px solid #5a5f5f;text-align:center;font:11px Arial,sans-serif;vertical-align:middle}' +
    FORM + ' .ssh-qty:focus{outline:0;border-color:#9fe0ff}' +
    FORM + ' input[disabled]{opacity:.5;cursor:default}' +
    FORM + ' .ssh-mc-prog{text-align:center;padding:2px 0 6px;color:#a9a091;font:11px tahoma,sans-serif}';
  document.head.append(s);
};

export const isRecipePage = () => !!document.querySelector(FORM) && /[?&]subcmd=viewrecipe/.test(location.search);

async function craftOnce(form) {
  const html = await fetchText(form.getAttribute('action') || 'index.php', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
  const doc = parseHtml(html);
  const alerts = gAlerts(doc);
  return { alerts, next: doc.querySelector(FORM), bad: alertBad(alerts) };
}

async function freshForm() {
  const doc = parseHtml(await fetchText(location.pathname.replace(/^.*\//, '') + location.search));
  return doc.querySelector(FORM);
}

function showResult(done, want, alerts, stopped) {
  const body = mel('div', 'mm-al');
  const head = mel('div', 'msg');
  head.innerHTML = '<b></b>';
  head.firstChild.textContent = done === want ? 'Crafted ' + done + (done === 1 ? ' time.' : ' times.') : 'Crafted ' + done + ' of ' + want + '.';
  body.append(head);
  alerts.slice(-1).forEach((t) => {
    const c = t.cloneNode(true);
    const b = c.querySelector('b');
    if (b) (b.closest('tr') && c.rows && c.rows.length > 1 ? b.closest('tr') : b).remove();
    const m = mel('div', 'msg');
    m.innerHTML = richHtml(c.textContent.trim() ? c.innerHTML.trim() : '');
    body.append(m);
  });
  if (stopped && !alerts.length) body.append(mel('div', 'msg', 'The game did not give the blueprint again, so it stopped.'));
  mModal('Multi-craft', body, [{ text: 'OK' }], { center: true, onClose: () => navigate(location.pathname.replace(/^.*\//, '') + location.search) });
}

async function craft(form, want, inp, btn) {
  [inp, btn].forEach((e) => { e.disabled = true; });
  const line = mel('div', 'ssh-mc-prog'); // under the button: how far it is (the button keeps its text)
  (btn.closest('p') || btn).after(line);
  let f = form;
  let done = 0;
  let alerts = [];
  let stopped = false;
  try {
    for (let i = 0; i < want; i++) {
      line.textContent = 'Crafting ' + (i + 1) + '/' + want + ' items';
      const r = await craftOnce(f);
      alerts = r.alerts;
      done++;
      if (r.bad) { done--; break; }
      if (i === want - 1) break;
      f = r.next || (await freshForm());
      if (!f) { stopped = true; break; } // no Invent button any more: something is missing
      await new Promise((res) => setTimeout(res, 120));
    }
  } catch (e) {
    alerts = [];
  }
  line.remove();
  [inp, btn].forEach((e) => { e.disabled = false; });
  showResult(done, want, alerts, stopped);
}

export function initMultiCraft() {
  css();
  const form = document.querySelector(FORM);
  const btn = form && form.querySelector('input[type="submit"]');
  const cell = form && form.closest('td');
  if (cell) cell.classList.add('ssh-rc'); // the centred lines of the page (the theme makes the text justified, so they are centred again here)
  if (!btn || form.querySelector('.ssh-qty')) return;
  const inp = mel('input', 'ssh-qty');
  inp.type = 'number';
  inp.min = '1';
  inp.max = String(MAX);
  inp.value = '1';
  inp.title = 'How many times to craft it';
  btn.before(inp);
  form.addEventListener('submit', (e) => {
    const n = Math.max(1, Math.min(MAX, parseInt(inp.value, 10) || 1));
    inp.value = String(n);
    if (n === 1) return; // the game's own form
    e.preventDefault();
    craft(form, n, inp, btn);
  });
}
