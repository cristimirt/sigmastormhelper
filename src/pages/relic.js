import { https } from '../core/util.js';
import { mel } from '../layout/dom.js';

// The artifact page (cmd=relic, relic_id=N) for the Modern layout, made of divs: .rl-title, .rl-img, .rl-back, .rl-text (what the game tells about
// artifacts), .rl-info (the status: .rl-row with a label and a value) and .rl-act (the Attempt Capture button and the game's note under it).
// The game's table stays in the page, hidden in the Modern layout, so the Original layout is untouched. The button clicks the button of the game's
// own form (which is disabled, like the original, when the player cannot attempt a capture).

const SKIN = 'https://cdn.sigmastorm.com/skin/'; // the frame of the content pages (like the faction log)
const CSS = '#ssh-rl{display:none;width:640px;margin:0 auto;color:#d8cfbf;font:11px tahoma,sans-serif;background:url(' + SKIN + 'large_content_bg.jpg) 0 0}' +
  '#ssh-rl .rl-head,#ssh-rl .rl-foot{height:54px;background-repeat:no-repeat;background-position:center top}' +
  '#ssh-rl .rl-head{background-image:url(' + SKIN + 'header_clear.jpg)}#ssh-rl .rl-foot{margin-top:14px;background-image:url(' + SKIN + 'large_content_footer.jpg)}' +
  'html.ssh-modern #ssh-rl{display:block}html.ssh-modern [data-ssh-rl]{display:none!important}' +
  'html.ssh-modern .cf-body{padding-top:14px}' + // (this style is only added on this page) the faction log has a line break there
  '#ssh-rl .rl-title{text-align:center;font-size:13px;font-weight:bold;color:#fff}' +
  '#ssh-rl .rl-img{padding-top:10px;text-align:center;line-height:0}#ssh-rl .rl-img img{border:1px solid #202122}' +
  '#ssh-rl .rl-back{padding:12px 0 4px;text-align:center}' +
  '#ssh-rl .rl-text{padding:10px 20px;line-height:1.45}' +
  '#ssh-rl .rl-info{width:400px;margin:10px auto 0;background:#000}' +
  '#ssh-rl .rl-row{display:flex;gap:8px;padding:3px 6px;border-top:1px solid #101414}' +
  '#ssh-rl .rl-row.hd{background:#0c262e;border-top:0;font-weight:bold;color:#fff}' +
  '#ssh-rl .rl-row>div:first-child{flex:0 0 110px}#ssh-rl .rl-row>div+div{flex:1 1 0;min-width:0;color:#fff}' +
  '#ssh-rl .rl-row.hd>div{flex:1 1 0!important}' +
  '#ssh-rl .rl-act{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:18px 20px 0}' +
  '#ssh-rl button.rl-btn{min-width:68px;height:24px;padding:0 14px;box-sizing:border-box;background:#2c3232;color:#d8d8d8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
  '#ssh-rl button.rl-btn:hover:not(:disabled){background:#3a4040;border-color:#8a9090;color:#fff}#ssh-rl button.rl-btn:disabled{opacity:.45;cursor:default}';

const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');

// A copy of a piece of the game's markup with its pictures on https (links kept).
function copyOf(n) {
  const c = n.cloneNode(true);
  c.querySelectorAll('img').forEach((i) => { i.src = https(i.getAttribute('src')); });
  return c;
}

function build(t) {
  const form = t.querySelector('form#relic-capture');
  const btn = form && form.querySelector('input[type=submit], button');
  const info = t.querySelector('table[width="400"]');
  const img = t.querySelector('img');
  const back = [...t.querySelectorAll('a')].find((a) => /back to/i.test(txt(a)));
  const body = [...t.rows].map((r) => r.cells[0]).find((td) => td && td.querySelector('br') && txt(td).length > 80 && !td.querySelector('table, form'));
  const title = [...t.rows].map((r) => r.cells[0]).find((td) => td && td.getAttribute('colspan') === '3' && txt(td));
  const root = mel('div');
  root.id = 'ssh-rl';
  root.append(mel('div', 'rl-head'));
  root.append(mel('div', 'rl-title', ''));
  root.lastChild.textContent = txt(title);
  if (img) {
    const w = mel('div', 'rl-img');
    w.append(copyOf(img));
    root.append(w);
  }
  if (back) {
    const b = mel('div', 'rl-back');
    b.append('[ ', copyOf(back), ' ]');
    root.append(b);
  }
  if (body) {
    const x = mel('div', 'rl-text');
    [...body.childNodes].forEach((n) => x.append(n.nodeType === 1 ? copyOf(n) : n.cloneNode(true)));
    root.append(x);
  }
  if (info) {
    const box = mel('div', 'rl-info');
    [...info.rows].forEach((r, i) => {
      const row = mel('div', 'rl-row' + (i === 0 ? ' hd' : ''));
      [...r.cells].forEach((c) => {
        const d = mel('div');
        [...c.childNodes].forEach((n) => d.append(n.nodeType === 1 ? copyOf(n) : n.cloneNode(true)));
        row.append(d);
      });
      box.append(row);
    });
    root.append(box);
  }
  if (btn) {
    const act = mel('div', 'rl-act');
    const b = mel('button', 'rl-btn');
    b.type = 'button';
    b.textContent = btn.value || btn.textContent;
    b.disabled = btn.disabled;
    b.addEventListener('click', () => btn.click());
    act.append(b);
    const note = txt(form.parentNode);
    if (note) act.append(mel('span', '', '')), act.lastChild.textContent = note;
    root.append(act);
  }
  root.append(mel('div', 'rl-foot'));
  return root;
}

export function initRelic() {
  const form = document.getElementById('relic-capture');
  const table = form && form.closest('table[width="600"]');
  if (!table || document.getElementById('ssh-rl')) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  table.setAttribute('data-ssh-rl', '1');
  table.after(build(table));
}
