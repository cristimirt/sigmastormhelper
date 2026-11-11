import { S } from '../core/state.js';
import { cssUrl, https } from '../core/util.js';
import { mel } from '../layout/dom.js';

// The Blacksmith (mechanic) page (cmd=blacksmith) for the Modern layout, made of divs: .bs-head (picture), .bs-back, .bs-intro, .bs-items (.bs-item:
// the worn item, its durability and the price) and .bs-all (Repair All). The game's table stays in the page, hidden in the Modern layout, so the
// Original layout is untouched. Every button clicks the button of the game's own form, so the game's confirmation and the posting stay the game's.

const CSS = '#ssh-bs{display:none;width:640px;margin:0 auto;background-position:0 0;color:#d8cfbf;font:13px tahoma,sans-serif}' +
  'html.ssh-modern #ssh-bs{display:block}html.ssh-modern [data-ssh-bs]{display:none!important}' +
  '#ssh-bs .bs-head,#ssh-bs .bs-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-bs .bs-back{padding:6px 0 0;text-align:center;font-size:11px}' +
  '#ssh-bs .bs-intro{padding:12px 20px 4px;text-align:center;font-size:11px;line-height:1.4}' +
  '#ssh-bs .bs-items{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;padding:18px 20px 8px}' +
  '#ssh-bs .bs-item{display:flex;flex-direction:column;align-items:center;gap:4px;width:64px;text-align:center}' +
  '#ssh-bs .bs-slot{width:45px;height:45px;padding:0;background:#0d0905;border:1px solid #202122;line-height:0;cursor:pointer}' +
  '#ssh-bs .bs-slot:hover:not(:disabled){border-color:#8a9090}#ssh-bs .bs-slot:disabled{cursor:default}' +
  '#ssh-bs .bs-slot img{display:block;width:45px;height:45px}' +
  '#ssh-bs .bs-dur{font-size:10px;color:#a9a091}#ssh-bs .bs-dur.low{color:#ff8a80}' +
  '#ssh-bs .bs-cost{display:flex;align-items:center;gap:3px;height:14px;font-size:11px;color:#fff}' +
  '#ssh-bs .bs-cost img{height:12px;width:auto}' +
  '#ssh-bs .bs-none{padding:22px 0 8px;text-align:center;color:#a9a091}' +
  '#ssh-bs .bs-all{text-align:center;padding:12px 0 18px}' +
  '#ssh-bs button.bs-btn{min-width:68px;height:24px;padding:0 12px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-bs button.bs-btn:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-bs button.bs-btn:disabled{opacity:.5;cursor:default}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

// What the game's table says: the pictures, the text, the worn items (form, picture, durability, price) and the Repair All form.
function read(t) {
  const head = t.querySelector('td[background*="header_"]');
  const foot = t.querySelector('td[background*="large_content_footer"]');
  const back = [...t.querySelectorAll('a')].find((a) => /back to/i.test(txt(a)));
  const intro = [...t.querySelectorAll('td[align="center"]')].find((td) => !td.querySelector('table, form, a') && txt(td));
  const items = [...t.querySelectorAll('form[id^="mechanic-repair-"]')].map((form) => {
    const cell = form.closest('table').parentNode.closest('td');
    const small = cell && cell.querySelector('font');
    const money = cell ? [...cell.querySelectorAll('tr')].reverse().find((tr) => tr.cells.length === 2 && /^\d+$/.test(txt(tr.cells[0])) && tr.cells[1].querySelector('img')) : null; // the innermost row: the price and the credits icon
    return {
      form,
      img: form.querySelector('img'),
      dur: txt(small),
      cost: money ? txt(money.cells[0]) : '',
      coin: money && money.cells[1].querySelector('img'),
      btn: form.querySelector('button, input[type=submit]'),
    };
  });
  const allForm = t.querySelector('form#mechanic-all');
  return {
    bg: t.getAttribute('background'),
    head: head && head.getAttribute('background'),
    foot: foot && foot.getAttribute('background'),
    back,
    intro: txt(intro),
    items,
    allBtn: allForm && allForm.querySelector('input[type=submit], button'),
  };
}

function build(t) {
  const d = read(t);
  const root = mel('div');
  root.id = 'ssh-bs';
  root.style.backgroundImage = cssUrl(d.bg);
  const hd = mel('div', 'bs-head');
  hd.style.backgroundImage = cssUrl(d.head);
  root.append(hd);
  if (d.back) {
    const b = mel('div', 'bs-back');
    const a = d.back.cloneNode(true);
    b.append(a);
    root.append(b);
  }
  if (d.intro) root.append(mel('div', 'bs-intro', ''));
  if (d.intro) root.lastChild.textContent = d.intro;
  if (d.items.length) {
    const list = mel('div', 'bs-items');
    d.items.forEach((it) => {
      const box = mel('div', 'bs-item');
      const slot = mel('button', 'bs-slot');
      slot.type = 'button';
      slot.title = 'Repair this item';
      if (it.img) {
        const i = it.img.cloneNode(false); // the tooltip handler of the game stays on the copy
        i.src = https(it.img.getAttribute('src'));
        slot.append(i);
      }
      slot.addEventListener('click', () => { if (it.btn) it.btn.click(); });
      const m = /^(\d+)\s*\/\s*(\d+)/.exec(it.dur);
      const dur = mel('div', 'bs-dur' + (m && +m[1] < +m[2] ? ' low' : ''));
      dur.textContent = it.dur;
      const cost = mel('div', 'bs-cost');
      cost.append(it.cost);
      if (it.coin) {
        const c = it.coin.cloneNode(false);
        c.src = https(it.coin.getAttribute('src'));
        cost.append(c);
      }
      box.append(slot, dur, cost);
      list.append(box);
    });
    root.append(list);
  } else {
    root.append(mel('div', 'bs-none', 'Nothing to repair.'));
  }
  if (d.allBtn) {
    const wrap = mel('div', 'bs-all');
    const b = mel('button', 'bs-btn');
    b.type = 'button';
    b.textContent = d.allBtn.value || d.allBtn.textContent;
    b.addEventListener('click', () => d.allBtn.click());
    wrap.append(b);
    root.append(wrap);
  }
  const ft = mel('div', 'bs-foot');
  ft.style.backgroundImage = cssUrl(S.base ? S.base + 'media/large_content_footer.png' : d.foot);
  root.append(ft);
  return root;
}

export function initBlacksmith() {
  const form = document.querySelector('form[id^="mechanic-repair-"], form#mechanic-all');
  const table = form && form.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-bs')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-bs', '1');
  table.after(build(table));
}
