import { S } from '../core/state.js';
import { https } from '../core/util.js';
import { mel } from '../layout/dom.js';

// A quest in the Mission Book: the game draws it with tables inside tables (a header picture, the "Back to Mission Book" link, the
// title, the steps with a thin line between them, a footer picture). Here it is the same page made of divs: .ssh-q > .q-head, .q-back,
// .q-title, .q-steps (.q-step and .q-sep) and .q-foot. The texts keep their own markup (colours, bold, line breaks).
const CSS = '.ssh-q{width:640px;margin:0 auto;background-position:0 0}' +
  '.ssh-q .q-head,.ssh-q .q-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '.ssh-q .q-back{text-align:center;padding:20px 20px 0}' +
  '.ssh-q .q-title{text-align:center;padding:20px}' +
  '.ssh-q .q-steps{width:500px;margin:0 auto;padding:0 20px 20px;box-sizing:content-box}' +
  '.ssh-q .q-step{padding:2px}' +
  '.ssh-q .q-sep{height:1px;background:#212323}';

const src = (td) => https(td.getAttribute('background') || '');
const url = (u) => (u ? 'url("' + u + '")' : 'none');

export function initQuest() {
  const head = [...document.querySelectorAll('td[background]')].find((td) => /\/skin\/header_/.test(td.getAttribute('background')));
  const table = head && head.closest('table');
  const foot = table && table.querySelector('td[background*="large_content_footer"]');
  const steps = table && table.querySelector('table[width="500"]');
  if (!table || !foot || !steps || document.querySelector('.ssh-q')) return;
  const rows = [...table.rows].filter((r) => r.closest('table') === table);
  const back = table.querySelector('a[href*="questbook"]');
  const title = rows.map((r) => r.cells[0]).find((c) => c && c !== head && c !== foot && !c.querySelector('table') && !c.contains(back) && c.textContent.trim());
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const q = mel('div', 'ssh-q');
  q.style.backgroundImage = url(src(table));
  const hd = mel('div', 'q-head');
  hd.style.backgroundImage = url(src(head));
  q.append(hd);
  if (back) {
    const b = mel('div', 'q-back');
    b.append(back);
    q.append(b);
  }
  if (title) {
    const t = mel('div', 'q-title');
    t.append(...title.childNodes);
    q.append(t);
  }
  const list = mel('div', 'q-steps');
  [...steps.rows].forEach((r) => {
    const c = r.cells[0];
    if (!c) return;
    const d = mel('div', c.getAttribute('height') === '1' ? 'q-sep' : 'q-step');
    if (d.className === 'q-step') d.append(...c.childNodes);
    list.append(d);
  });
  q.append(list);
  const ft = mel('div', 'q-foot');
  ft.style.backgroundImage = url(S.base ? S.base + 'media/large_content_footer.png' : src(foot));
  q.append(ft);
  table.replaceWith(q);
}
