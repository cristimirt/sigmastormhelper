import { mel } from '../layout/dom.js';
import { tableToDivs } from '../layout/tablediv.js';
import { S } from '../core/state.js';
import { cssUrl, https } from '../core/util.js';

// The page you see when you are not signed in (https://www.sigmastorm.com/) for the Modern layout: the game's page is a table inside a table
// of pictures (four class pictures, the middle column of text on picture strips). Here it is made of divs: the same pictures and text, the class
// pictures light up and show the class description as before. The game's table stays in the page, hidden, so the Original layout is untouched.

const CSS = '#ssh-land{display:none}html.ssh-land-on .site-layout>[data-ssh-land]{display:none!important}html.ssh-land-on #ssh-land{display:flex;width:1000px;max-width:100%;margin:0 auto;align-items:flex-start;' +
  'background-repeat:no-repeat;overflow:hidden}' +
  '#ssh-land .ld-c{display:flex;flex-direction:column;flex:none}#ssh-land img{display:block;max-width:none}' +
  '#ssh-land .ld-m{width:371px}' +
  '#ssh-land .ld-i{display:flex;flex-direction:column;justify-content:center;height:250px;box-sizing:border-box;background-repeat:no-repeat}' +
  '#ssh-land .ld-t{width:280px;margin:0 auto;font-size:16px}#ssh-land .ld-b{text-align:center;margin-top:20px}' +
  '#ssh-land .ld-f{min-height:169px;box-sizing:border-box;background-repeat:no-repeat}' +
  '@media (max-width:1000px){html.ssh-land-on #ssh-land{overflow-x:auto}}';

export const isLanding = () => !!document.querySelector('.site-layout img[src*="front/middle1"]');

export function initLanding() {
  if (document.getElementById('ssh-land')) return;
  const pic = (k) => document.querySelector('.site-layout img[src*="front/' + k + '"]');
  const imgs = ['top_left', 'bottom_left', 'top_right', 'bottom_right'].map((k) => document.querySelector('.site-layout img[src*="front/' + k + '"]'));
  const m1 = pic('middle1');
  const m2 = document.querySelector('.site-layout td[background*="front/middle2"]');
  const m4 = document.querySelector('.site-layout td[background*="front/middle4"]');
  const m3 = pic('middle3');
  const m5 = pic('middle5');
  const outer = m1 && m1.closest('.site-layout > table');
  if (!outer || !m2 || !m4 || !m3 || !m5 || imgs.some((x) => !x)) return;
  const st = mel('style');
  st.textContent = CSS;
  document.head.append(st);
  outer.setAttribute('data-ssh-land', '1');
  const bgT = outer.querySelector('table[style*="front/background"]');
  const bg = bgT && ((bgT.getAttribute('style') || '').match(/url\(([^)]+)\)/) || [])[1];
  const root = mel('div');
  root.id = 'ssh-land';
  if (bg) root.style.backgroundImage = cssUrl(https(bg.replace(/["']/g, '')));
  const cs = getComputedStyle(m2);
  root.style.fontFamily = cs.fontFamily;
  root.style.color = cs.color;
  root.style.lineHeight = cs.lineHeight;
  const im = (src, i) => { const e = mel('img'); e.src = https(src); e.draggable = false; if (i !== undefined) e.dataset.cls = i; return e; };
  const col = (kids, cls) => { const c = mel('div', 'ld-c' + (cls ? ' ' + cls : '')); c.append(...kids); return c; };
  // the middle column: pictures and two strips with text on them
  const strip = (td, cls) => { const d = mel('div', cls); d.style.backgroundImage = cssUrl(https(td.getAttribute('background'))); return d; };
  const intro = strip(m2, 'ld-i');
  const txt = m2.querySelector('div');
  const btn = m2.querySelector('input[type="button"]');
  const go = btn && ((btn.getAttribute('onclick') || '').match(/location\s*=\s*'([^']+)'/) || [])[1];
  const t = mel('div', 'ld-t');
  t.innerHTML = txt ? txt.innerHTML : '';
  intro.append(t);
  if (btn && go) {
    const b = mel('div', 'ld-b');
    const nb = mel('input', 'custombutton');
    nb.type = 'button';
    nb.value = btn.value;
    nb.style.cssText = 'width:250px;height:40px;cursor:pointer';
    nb.addEventListener('click', () => { location.href = go; });
    b.append(nb);
    intro.append(b);
  }
  const feat = strip(m4, 'ld-f');
  const ft = m4.querySelector('table');
  if (ft) feat.append(tableToDivs(ft));
  const mid = col([im(m1.getAttribute('src')), intro, im(m3.getAttribute('src')), feat, im(m5.getAttribute('src'))], 'ld-m');
  root.append(
    col([im(imgs[0].getAttribute('src'), 0), im(imgs[1].getAttribute('src'), 1)]),
    mid,
    col([im(imgs[2].getAttribute('src'), 2), im(imgs[3].getAttribute('src'), 3)]));
  // a class picture lights up (the same picture with _on) and shows what the class is; the game's own script has the texts
  const w = window;
  root.addEventListener('mouseover', (e) => {
    const p = e.target.closest && e.target.closest('img[data-cls]');
    if (!p) return;
    const i = +p.dataset.cls;
    root.querySelectorAll('img[data-cls]').forEach((x) => { x.src = x.src.replace(/_on\.jpg/, '.jpg'); });
    p.src = p.src.replace(/\.jpg/, '_on.jpg');
    const names = w.className;
    const desc = w.classDesc;
    const sym = w.classSymbol;
    if (!names || !desc || !sym || typeof w.Tip !== 'function') return;
    if (typeof w.tt_setWidth === 'function') w.tt_setWidth(200);
    w.Tip('<table width=200><tr><td width=16><img src=\'https://cdn.sigmastorm.com/skin/classes/' + sym[i] + '.gif\'></td><td width=184><b>' + names[i] + '</b></td></tr><tr><td colspan=2>' + desc[i] + '</td></tr></table>');
  });
  outer.after(root);
  document.documentElement.classList.add('ssh-land-on');
}

export const landingWanted = () => S.layout === 'modern' && isLanding();
