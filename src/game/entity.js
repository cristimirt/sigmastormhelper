import { refreshDur, updateHeader } from '../banner.js';
import { S } from '../core/state.js';
import { esc, txt } from '../core/util.js';
import { renderActions } from './actionlist.js';
import { attackAlert, isSep, logBody, parseCombat, refreshWorld, resultHtml } from './combat.js';
import { fillEvaluation } from './evaluation.js';

// Creature details in a pop-up (the game's "View Entity" page), with the same background fight.
S.entRes = [];

export function closeEntity() { const p = document.getElementById('ssh-ent'); if (p) p.remove(); }

// The game's creature page is a stack of tables; this rebuilds it with divs (same graphics, same data).
function buildEntity(frame, atkHref) {
  const pic = frame.querySelector('img[src*="creatures/"]');
  const st = [...frame.querySelectorAll('table')].find((t) => t.querySelector('td[style*="_head_bg"]'));
  if (!pic || !st) return null;
  const name = txt((pic.closest('td') || pic.parentElement).textContent);
  const bgOf = (sel) => { const e = frame.querySelector(sel); return e ? (e.getAttribute('background') || '') : ''; };
  const head = bgOf('td[background*="header_"]');
  const foot = bgOf('td[background*="large_content_footer"]');
  const secs = [];
  let cur = null;
  [...st.rows].forEach((tr) => {
    const h = [...tr.cells].find((c) => /_head_bg/.test(c.getAttribute('style') || ''));
    if (h) { cur = { head: ((h.getAttribute('style') || '').match(/url\(([^)]+)\)/) || [])[1] || '', rows: [] }; secs.push(cur); return; }
    if (!cur || tr.querySelector('input')) return;
    const cs = [...tr.cells];
    if (cs.length === 1 && !cs[0].textContent.trim() && !cs[0].querySelector('img')) return;
    cur.rows.push(cs);
  });
  const rowHtml = (cs) => {
    if (cs.length === 1) return '<div class="rt">' + cs[0].innerHTML + '</div>';
    const span = cs.reduce((n, c) => n + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);
    if (span === 4) return '<div class="r4">' + cs.map((c) => '<span style="grid-column:span ' + (parseInt(c.getAttribute('colspan'), 10) || 1) + '">' + c.innerHTML + '</span>').join('') + '</div>';
    return '<div class="rl">' + cs.map((c) => '<span>' + c.innerHTML + '</span>').join('') + '</div>';
  };
  let right = '';
  secs.forEach((sc) => {
    const act = /actions_head/.test(sc.head);
    if (act) right += '<div class="eeval" id="ssh-eval"><span class="ssh-spin"></span></div>';
    right += '<div class="esh" style="background:url(' + sc.head + ') no-repeat"></div>' + sc.rows.map(rowHtml).join('');
    if (act) right += '<div class="ebtns"><input type="button" value="Attack Creature" class="custombutton" data-eatk="' + esc(atkHref) + '"></div>';
  });
  if (!/actions_head/.test(right)) return null;
  return '<div class="ehead" style="background:url(' + head + ') no-repeat"></div>' +
    '<div class="ebody"><div class="eleft"><div class="epic">' + pic.outerHTML + '<div class="en">' + esc(name) + '</div></div><div class="eres" id="ssh-eres" style="display:none"></div></div>' +
    '<div class="eright">' + right + '</div></div>' + '<div class="efoot" style="background:url(' + foot + ') no-repeat"></div>';
}

export async function openEntity(href) {
  closeEntity();
  const pop = document.createElement('div');
  pop.id = 'ssh-ent';
  pop.innerHTML = '<div class="ebox"><div class="ehandle" title="Drag to move"></div><div class="eclose" data-eclose="1" title="Close">&#10006;</div><div class="eload" style="padding:60px;text-align:center"><span class="ssh-spin"></span></div></div>';
  document.body.appendChild(pop);
  try {
    const html = await (await fetch(new URL(href, location.href).href, { credentials: 'same-origin' })).text();
    if (!document.getElementById('ssh-ent')) return; // closed meanwhile
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const m = doc.getElementById('mainContentDiv');
    const frame = m && (m.querySelector('table[background*="large_content_bg"]') || (m.rows[1] && m.rows[1].cells[1] && m.rows[1].cells[1].querySelector(':scope > table')));
    const btn = frame && [...frame.querySelectorAll('input[type="button"]')].find((b) => /attack/i.test(b.value));
    if (!frame || !btn) { location.href = href; return; }
    const am = (btn.getAttribute('onclick') || '').match(/window\.location\s*=\s*'([^']+)'/);
    if (!am) { location.href = href; return; }
    const back = [...frame.querySelectorAll('input[type="button"]')].find((b) => /back to world/i.test(b.value));
    if (back) back.remove();
    btn.removeAttribute('onclick');
    btn.setAttribute('data-eatk', am[1].replace(/&amp;/g, '&'));
    const box = pop.querySelector('.ebox');
    box.querySelector('.eload').remove();
    const built = buildEntity(frame, am[1].replace(/&amp;/g, '&'));
    if (built) {
      box.style.background = 'url(' + (frame.getAttribute('background') || '') + ')';
      box.insertAdjacentHTML('beforeend', built);
      fillEvaluation(frame);
      return;
    }
    box.insertAdjacentHTML('beforeend', frame.outerHTML);
    const nb = box.querySelector('[data-eatk]');
    if (nb) {
      const row = nb.closest('tr');
      const pic = box.querySelector('img[src*="creatures/"]');
      const pt = pic && pic.closest('table');
      const res = document.createElement('div');
      res.className = 'eres';
      res.id = 'ssh-eres';
      res.style.display = 'none';
      if (pt) pt.style.marginBottom = '10px';
      if (pt && pt.parentElement) pt.parentElement.appendChild(res);
      else { const rr = document.createElement('tr'); rr.innerHTML = '<td colspan="4"></td>'; rr.firstChild.appendChild(res); row.parentNode.insertBefore(rr, row.nextSibling); }
      const ev = document.createElement('tr');
      ev.innerHTML = '<td colspan="4"><div class="eeval" id="ssh-eval"><span class="ssh-spin"></span></div></td>';
      row.parentNode.insertBefore(ev, row.previousElementSibling || row);
      fillEvaluation(frame);
    }
  } catch (e) {
    location.href = href;
  }
}

export async function entityAttack(btn) {
  if (S.busy || btn.disabled) return;
  const href = btn.getAttribute('data-eatk');
  const res = document.getElementById('ssh-eres');
  btn.disabled = true;
  S.pending++;
  let leave = false;
  if (res && res.parentElement) { const td = res.parentElement; const w = td.getBoundingClientRect().width; if (w) { td.style.width = w + 'px'; td.style.maxWidth = w + 'px'; } } // keep the column as wide as it was
  if (res) { res.style.display = 'block'; res.innerHTML = '<span class="ssh-spin" title="Fighting..."></span> Fighting...'; }
  try {
    const html = await (await fetch(new URL(href, location.href).href, { credentials: 'same-origin' })).text();
    const c = parseCombat(html);
    if (!c || c.type !== 0) {
      if (attackAlert(html)) {
        btn.disabled = false;
        if (res) res.style.display = 'none';
        updateHeader(html);
        return;
      }
      leave = true; location.href = href; return;
    }
    S.entRes.push(c);
    // Same as a fight started from the Action List: the result takes the creature's place in the list.
    const cid = (href.match(/creature_id=(\d+)/) || [])[1];
    const link = cid && document.querySelector('#ssh-al a[href*="viewcreature"][href*="creature_id=' + cid + '"]');
    const row = link && link.closest('tr');
    if (row && !row.classList.contains('ssh-resrow')) {
      const pos = [...row.parentNode.children].filter((x) => !isSep(x)).indexOf(row);
      const la = row.querySelector('a[data-atk]');
      const rr = { pos, quick: !!la && la.getAttribute('data-atk') !== 'x', html: resultHtml(c), log: c };
      S.results.push(rr);
      row.className = 'ssh-resrow';
      row.innerHTML = '<td colspan="3">' + rr.html.replace('data-r="#"', 'data-r="' + (S.results.length - 1) + '"') + '</td>';
    }
    if (res && res.isConnected) {
      res.innerHTML = resultHtml(c).replace(/<a class="clog"[^>]*>[^<]*<\/a>/, '') + '<div class="elog">' + logBody(c) + '</div>';
      btn.style.display = 'none';
    }
    updateHeader(html);
  } catch (e) {
    leave = true;
    location.href = href;
  } finally {
    S.pending--;
    if (!S.pending && !leave) {
      let ok = false;
      try { ok = await refreshWorld(); } catch (e) { ok = false; }
      if (!ok && !S.pending) renderActions();
      refreshDur(0);
    }
  }
}

export async function doAttack(a) {
  if (S.busy) return;
  const tr = a.closest('tr');
  if (!tr || tr.classList.contains('ssh-fight')) return;
  const href = a.getAttribute('href');
  const img = a.querySelector('img');
  const saved = img ? img.outerHTML : '';
  const pos = [...tr.parentNode.children].filter((r) => !isSep(r)).indexOf(tr);
  const quick = a.getAttribute('data-atk') !== 'x'; // a numbered creature
  tr.classList.add('ssh-fight');
  S.pending++;
  if (img) img.outerHTML = '<span class="ssh-spin" title="Fighting..."></span>';
  let leave = false;
  try {
    const html = await (await fetch(new URL(href, location.href).href, { credentials: 'same-origin' })).text();
    const c = parseCombat(html);
    if (!c || c.type !== 0) {
      if (attackAlert(html)) {
        tr.classList.remove('ssh-fight');
        const sp = tr.querySelector('.ssh-spin');
        if (sp) sp.outerHTML = saved;
        updateHeader(html);
        return;
      }
      leave = true; location.href = href; return;
    }
    const r = { pos, quick, html: resultHtml(c), log: c };
    S.results.push(r);
    if (tr.isConnected) {
      tr.className = 'ssh-resrow';
      tr.innerHTML = '<td colspan="3">' + r.html.replace('data-r="#"', 'data-r="' + (S.results.length - 1) + '"') + '</td>';
    }
    updateHeader(html);
  } catch (e) {
    leave = true;
    const sp = tr.querySelector('.ssh-spin');
    if (sp) sp.outerHTML = saved;
    location.href = href;
  } finally {
    S.pending--;
    if (!S.pending && !leave) {
      let ok = false;
      try { ok = await refreshWorld(); } catch (e) { ok = false; }
      if (!ok && !S.pending) renderActions();
      refreshDur(0);
    }
  }
}
