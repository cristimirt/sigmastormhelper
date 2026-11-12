import { fetchText, navigate } from '../core/net.js';
import { alertBad, parseHtml } from '../core/util.js';
import { mel } from '../layout/dom.js';
import { gAlerts, mModal, richHtml } from '../layout/modal.js';
import { tableToDivs } from '../layout/tablediv.js';

// The faction's Artifact Shop: every item has its own small POST form with a Buy button, one purchase per click. A number box next to each
// Buy button says how many to buy: the form is sent that many times, one after the other. Every answer carries the form again with a
// fresh one-time quote and value, so the next request is made from the form in the answer. It stops at the first message of the game
// that is an error or a warning (not enough of what it costs, ...), and tells how many were bought.
// In the Modern layout the page is a copy made of divs (layout/tablediv.js); the game's table stays in the page, hidden, so the Original layout is untouched.
// The number box is added to the forms of both, and the copy's forms work like the originals.

const MAX = 100;

const css = () => {
  if (document.getElementById('ssh-shop-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-shop-css';
  s.textContent = 'form[id^="artifact-buy-"] .ssh-qty{width:46px;height:22px;box-sizing:border-box;margin-right:4px;padding:2px 4px;background:#0b0e0e;color:#d8cfbf;border:1px solid #5a5f5f;text-align:center;font:11px Arial,sans-serif;vertical-align:middle}' +
    'form[id^="artifact-buy-"] .ssh-qty:focus{outline:0;border-color:#9fe0ff}';
  document.head.append(s);
};

// One purchase: the form is sent, and the answer is read: the game's messages and the same form again (new quote).
async function buyOnce(form) {
  const body = new URLSearchParams(new FormData(form));
  const html = await fetchText(form.getAttribute('action') || 'index.php', { method: 'POST', body });
  const doc = parseHtml(html);
  const alerts = gAlerts(doc);
  return { alerts, next: doc.getElementById(form.id), bad: alertBad(alerts) };
}

function showResult(done, want, alerts) {
  const body = document.createElement('div');
  body.className = 'mm-al';
  const head = document.createElement('div');
  head.className = 'msg';
  head.innerHTML = '<b></b>';
  head.firstChild.textContent = done === want ? 'Bought ' + done + (done === 1 ? ' item.' : ' items.') : 'Bought ' + done + ' of ' + want + '.';
  body.append(head);
  alerts.slice(-1).forEach((t) => {
    const c = t.cloneNode(true);
    const b = c.querySelector('b');
    if (b) (b.closest('tr') && c.rows.length > 1 ? b.closest('tr') : b).remove();
    const m = document.createElement('div');
    m.className = 'msg';
    m.innerHTML = richHtml(c.textContent.trim() ? c.innerHTML.trim() : '');
    body.append(m);
  });
  const reload = () => navigate('index.php?cmd=guild&subcmd=artifactshop');
  mModal('Artifact Shop', body, [{ text: 'OK' }], { center: true, onClose: reload });
}

async function buy(form, want, inp, btn) {
  const old = btn.value;
  [inp, btn].forEach((e) => { e.disabled = true; });
  let f = form;
  let done = 0;
  let alerts = [];
  try {
    for (let i = 0; i < want; i++) {
      btn.value = (i + 1) + ' / ' + want + '...';
      const r = await buyOnce(f);
      alerts = r.alerts;
      if (r.bad) break;
      done++;
      if (!r.next) break; // the shop did not come back: nothing more to send
      f = r.next;
      if (i < want - 1) await new Promise((res) => setTimeout(res, 120));
    }
  } catch (e) {
    alerts = [];
  }
  btn.value = old;
  [inp, btn].forEach((e) => { e.disabled = false; });
  showResult(done, want, alerts);
}

function qtyBoxes(scope) {
  scope.querySelectorAll('form[id^="artifact-buy-"]').forEach((form) => {
    const btn = form.querySelector('input[type="submit"]');
    if (!btn || form.querySelector('.ssh-qty')) return;
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'ssh-qty';
    inp.min = '1';
    inp.max = String(MAX);
    inp.value = '1';
    inp.title = 'How many to buy';
    btn.before(inp);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.max(1, Math.min(MAX, parseInt(inp.value, 10) || 1));
      inp.value = String(n);
      buy(form, n, inp, btn);
    });
  });
}

export function initArtifactShop() {
  css();
  const first = document.querySelector('form[id^="artifact-buy-"]');
  const table = first && first.closest('table[width="640"]');
  if (table && !document.getElementById('ssh-as')) {
    const st = mel('style');
    st.textContent = 'html.ssh-modern [data-ssh-as]{display:none!important}#ssh-as{display:none}html.ssh-modern #ssh-as{display:block}';
    document.head.append(st);
    const root = mel('div');
    root.id = 'ssh-as';
    root.append(tableToDivs(table));
    table.setAttribute('data-ssh-as', '1');
    table.after(root);
    qtyBoxes(root);
  }
  qtyBoxes(document);
}
