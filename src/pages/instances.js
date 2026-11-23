import { mel } from '../layout/dom.js';
import { steelContainer } from '../layout/steel.js';
import { unbreak } from '../layout/unbreak.js';

// The Slaughterfest page (cmd=instances) for the Modern layout: the steel container (layout/steel.js) with the page's parts in plain divs
// (the intro, the box with the game's details and the Join form, the rules and the rewards). The game's table stays in the page, hidden in the
// Modern layout, so the Original layout is untouched; the Join button is a copy of the game's own form.

const CSS = 'html.ssh-modern [data-ssh-in]{display:none!important}#ssh-in{display:none}html.ssh-modern #ssh-in{display:block}' +
  '#ssh-in .in-intro,#ssh-in .in-rules{margin:0 0 14px}' +
  '#ssh-in .in-box{width:400px;max-width:100%;margin:0 auto 14px;border:1px solid #fff}' +
  '#ssh-in .in-row{display:flex;padding:3px 4px}#ssh-in .in-row>*{flex:1}#ssh-in .in-row>img,#ssh-in .in-val img{vertical-align:middle}' +
  '#ssh-in .in-join{padding:12px 6px;text-align:center;border-top:1px solid #fff}#ssh-in .in-join form{margin:0}' +
  '#ssh-in .in-items{width:100%;margin:0 0 14px;border:1px solid #fff}#ssh-in .in-item{display:flex;align-items:center;text-align:center;border-top:1px solid #fff}#ssh-in .in-item:first-child{border-top:0}' +
  '#ssh-in .in-item>div{padding:5px}#ssh-in .in-item>:nth-child(1){flex:1}#ssh-in .in-item>:nth-child(2){flex:1}#ssh-in .in-item>:nth-child(3){flex:1.4}#ssh-in .in-item-h{font-weight:bold}' +
  '#ssh-in .in-item img,#ssh-in .in-have img{vertical-align:middle}#ssh-in .in-have{margin:0 0 14px}#ssh-in .in-item form{margin:0}#ssh-in .in-item form div{font-size:.9em}' +
  '#ssh-in .in-rew{width:200px;margin:8px auto}#ssh-in .in-rew>div{display:flex;gap:8px}#ssh-in .in-rew>div>:first-child{flex:1}';

export const isInstances = () => !!document.querySelector('.cf-body td[background*="instance_banner"]');

const kids = (from, into) => { from.childNodes.forEach((n) => into.append(n.cloneNode(true))); return into; };
const cellRow = (cells, cls) => {
  const r = mel('div', cls);
  [...cells].forEach((c, i) => r.append(kids(c.querySelector('table') && c.querySelector('table').rows[0] ? c.querySelector('table').rows[0].cells[0] : c, mel('span', i ? 'in-val' : ''))));
  return r;
};

export function initInstances() {
  const head = document.querySelector('.cf-body td[background*="instance_banner"]');
  const table = head && head.closest('table[width="640"]');
  if (!table || document.getElementById('ssh-in')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  const tabs = [...table.querySelectorAll(':scope > tbody > tr > td > table')];
  const [intro, info, , rules] = [tabs[0], tabs[1], null, tabs[2]];
  const page = steelContainer({ header: head.getAttribute('background') });
  page.id = 'ssh-in';
  const root = page.body;
  if (intro) {
    const div = kids(intro.rows[0].cells[0], mel('div', 'in-intro'));
    div.querySelectorAll('table').forEach((t) => {
      if (t.querySelector('tr[data-instance-reward]')) { // the Rewards page: the list of items to buy
        const list = mel('div', 'in-items');
        [...t.rows].forEach((tr) => {
          const row = mel('div', tr.hasAttribute('data-instance-reward') ? 'in-item' : 'in-item in-item-h');
          [...tr.cells].forEach((c) => row.append(kids(c, mel('div'))));
          list.append(row);
        });
        t.replaceWith(list);
      } else if (!t.querySelector('table')) { // "You currently have N [token]"
        const have = mel('div', 'in-have');
        [...t.rows[0].cells].forEach((c) => kids(c, have));
        t.replaceWith(have);
      }
    });
    root.append(div);
  }
  if (info) {
    const box = mel('div', 'in-box');
    [...info.rows].forEach((tr) => {
      if (tr.cells.length === 1 || tr.cells[0].colSpan > 1) box.append(kids(tr.cells[0], mel('div', 'in-join')));
      else {
        const row = mel('div', 'in-row');
        const lab = mel('span');
        lab.textContent = tr.cells[0].textContent.trim();
        const val = mel('span', 'in-val');
        const inner = tr.cells[1].querySelector('table');
        kids(inner ? inner.rows[0].cells[0] : tr.cells[1], val);
        if (inner && inner.rows[0].cells[1]) kids(inner.rows[0].cells[1], val);
        row.append(lab, val);
        box.append(row);
      }
    });
    root.append(box);
  }
  if (rules) {
    const div = kids(rules.rows[0].cells[0], mel('div', 'in-rules'));
    const rew = div.querySelector('table');
    if (rew) {
      const list = mel('div', 'in-rew');
      [...rew.rows].forEach((tr) => list.append(cellRow(tr.cells, '')));
      rew.replaceWith(list);
    }
    root.append(div);
  }
  unbreak(root); // no line breaks: spacing instead
  table.setAttribute('data-ssh-in', '1');
  table.after(page);
}
