import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { doRepair, submitAction } from './actionlist.js';
import { closeLog, openLog } from './combat.js';
import { closeEntity, doAttack, entityAttack, openEntity } from './entity.js';
import { renderTrail } from './footprints.js';
import { go } from './loading.js';
import { applyZoom, moveFor, setZoom } from './map.js';
import { drawPath, findPath, stopWalk, tileUnderMouse, walkTo } from './pathfinding.js';

export function bind() {
  document.addEventListener('click', (e) => {
    if (e.__ssh) return; // already handled by another listener
    e.__ssh = true;
    const t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    const pb = t.closest('#ssh-pad button');
    if (pb) {
      e.preventDefault();
      const m = moveFor(+pb.getAttribute('data-dx'), +pb.getAttribute('data-dy'));
      if (m && m.enabled) go(m.href);
      return;
    }
    const atk = t.closest('#ssh-al a[data-atk]');
    if (atk) { e.preventDefault(); e.stopPropagation(); doAttack(atk); return; }
    const ev = t.closest('#ssh-al a[href*="subcmd=viewcreature"]');
    if (ev) { e.preventDefault(); e.stopPropagation(); openEntity(ev.getAttribute('href')); return; }
    if (t.closest('#ssh-ent [data-eclose]') || t.id === 'ssh-ent') { e.preventDefault(); closeEntity(); return; }
    const ea = t.closest('#ssh-ent [data-eatk]');
    if (ea) { e.preventDefault(); e.stopPropagation(); entityAttack(ea); return; }
    const elg = t.closest('#ssh-ent .clog');
    if (elg) { e.preventDefault(); const c = S.entRes[+elg.getAttribute('data-er')]; if (c) openLog({ log: c }); return; }
    const rp = t.closest('#ssh-al .ssh-repair');
    if (rp) { e.preventDefault(); e.stopPropagation(); doRepair(rp); return; }
    const lg = t.closest('#ssh-al .clog');
    if (lg) { e.preventDefault(); openLog(S.results[+lg.getAttribute('data-r')]); return; }
    if (t.closest('#ssh-pop [data-close]') || (t.id === 'ssh-pop')) { e.preventDefault(); closeLog(); return; }
    const ai = t.closest('#ssh-al input[type="image"], #ssh-al input[type="submit"], #ssh-al button');
    if (ai) {
      e.preventDefault();
      e.stopPropagation();
      submitAction(ai);
      return;
    }
    if (t.closest('#ssh-fpbtn')) {
      e.preventDefault();
      S.fp = !S.fp;
      store.set('fp', S.fp);
      renderTrail();
      return;
    }
    const z = t.closest('#ssh-zoom button');
    if (z) {
      e.preventDefault();
      setZoom(S.zoom * (z.getAttribute('data-z') === '1' ? 1.2 : 1 / 1.2));
    }
  }, true);

  document.addEventListener('wheel', (e) => {
    if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('#ssh-map')) return;
    if (e.target.closest('#ssh-al')) return;
    e.preventDefault();
    setZoom(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false, capture: true });

  window.addEventListener('resize', applyZoom);
  let pd = null;
  const tip = document.createElement('div');
  tip.id = 'ssh-tip';
  document.body.appendChild(tip);
  const hideTip = () => { tip.style.display = 'none'; };
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    if (pd || !t || typeof t.closest !== 'function') return;
    const el = t.closest('#ssh-world [data-tip]');
    const area = S.loc && S.areas.get(S.loc.area);
    if (!el || !area) { hideTip(); return; }
    const c = area.cells[+el.getAttribute('data-tip')];
    if (!c) return;
    tip.innerHTML = c.tip;
    tip.style.width = c.tipW + 'px';
    tip.style.display = 'block';
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.style.display === 'none') return;
    if (pd) { hideTip(); return; }
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, e.clientX + 14)) + 'px';
    tip.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, e.clientY + 14)) + 'px';
  });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hideTip(); });
  document.addEventListener('mouseover', (e) => {
    const el = e.target && typeof e.target.closest === 'function' ? e.target.closest('#ssh-al .itm, #ssh-ent .itm') : null;
    if (!el || pd) return;
    const a = (el.getAttribute('data-item') || '').split('|');
    if (a.length >= 4 && typeof window.ajaxLoadItem === 'function') window.ajaxLoadItem(+a[0], +a[1], +a[2], +a[3], a[4] || '');
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target && typeof e.target.closest === 'function' ? e.target.closest('#ssh-al .itm, #ssh-ent .itm') : null;
    if (el && typeof window.UnTip === 'function') window.UnTip();
  });
  // Pop-ups (creature details, combat log) are dragged by their title bar; the rest of the content stays selectable.
  let pdrag = null;
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (e.button !== 0 || !t || typeof t.closest !== 'function') return;
    let box = null;
    if (t.closest('#ssh-pop .ph') && !t.closest('[data-close]')) box = t.closest('#ssh-pop .box');
    else if (t.closest('#ssh-ent .ehandle')) box = t.closest('#ssh-ent .ebox');
    if (!box) return;
    const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(box.style.transform || '');
    pdrag = { box, x: e.clientX, y: e.clientY, tx: m ? +m[1] : 0, ty: m ? +m[2] : 0, id: e.pointerId };
    try { box.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!pdrag) return;
    pdrag.box.style.transform = 'translate(' + (pdrag.tx + e.clientX - pdrag.x) + 'px,' + (pdrag.ty + e.clientY - pdrag.y) + 'px)';
  });
  const endPd = () => { pdrag = null; };
  document.addEventListener('pointerup', endPd);
  document.addEventListener('pointercancel', endPd);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (document.getElementById('ssh-pop')) closeLog(); else closeEntity(); } });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (e.button !== 0 || !t || typeof t.closest !== 'function' || !t.closest('#ssh-map') || t.closest('button')) return;
    if (!S.viewer.classList.contains('ssh-pannable')) return;
    pd = { x: e.clientX, y: e.clientY, px: S.pan.x, py: S.pan.y };
    S.viewer.classList.add('ssh-dragging');
    e.preventDefault();
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!pd) return;
    S.pan.x = pd.px + e.clientX - pd.x;
    S.pan.y = pd.py + e.clientY - pd.y;
    applyZoom();
  }, true);
  const endPan = () => { if (!pd) return; pd = null; S.viewer.classList.remove('ssh-dragging'); };
  document.addEventListener('pointerup', endPan, true);
  document.addEventListener('pointercancel', endPan, true);

  // The game's move keys (Q W E / A D / Z X C) reload the page; do the same moves in the background.
  // Route preview (hover) and click-to-walk
  let hoverRaf = 0;
  document.addEventListener('mousemove', (e) => {
    if (!S.cfg.route || S.walking || S.busy || S.pending || pd || !S.viewer) return;
    const t = e.target;
    if (!t || typeof t.closest !== 'function' || !t.closest('#ssh-map') || t.closest('button') || t.closest('#ssh-al')) {
      if (S.hover) { S.hover = null; drawPath(null); }
      return;
    }
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const c = tileUnderMouse(e);
      const key = c ? c.join(',') : '';
      if (key === (S.hover ? S.hover.key : '')) return;
      const path = c ? findPath(S.loc.area, S.loc.x, S.loc.y, c[0], c[1]) : null;
      S.hover = path ? { key, path, x: c[0], y: c[1] } : null;
      drawPath(path);
    });
  }, true);
  document.addEventListener('mouseleave', () => { if (!S.walking && S.hover) { S.hover = null; drawPath(null); } });
  let down = null;
  document.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; }, true);
  document.addEventListener('pointermove', (e) => { if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) down.moved = true; }, true);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || typeof t.closest !== 'function' || !t.closest('#ssh-map') || t.closest('button')) return;
    if (!S.cfg.route) return;
    if (e.__sshWalk) return; // same click seen twice
    e.__sshWalk = true;
    if (S.walking) { if (Date.now() - (S.walkStart || 0) > 600) stopWalk('Stopped'); return; }
    if (down && down.moved) return; // that was a map drag
    if (S.hover && S.hover.path) {
      const h = S.hover;
      S.hover = null;
      walkTo(h.x, h.y);
    }
  }, true);
  document.addEventListener('keydown', (e) => { if (S.walking) stopWalk('Stopped'); }, true);
  const DIRS = { q: [-1, -1], w: [0, -1], e: [1, -1], a: [-1, 0], d: [1, 0], z: [-1, 1], x: [0, 1], c: [1, 1] };
  // The game may also listen for keydown/keyup: keep our hotkeys away from it.
  const ours = (e) => {
    if (!S.loc || e.ctrlKey || e.metaKey || e.altKey) return false;
    const tg = e.target;
    if (tg && (/^(input|textarea|select)$/i.test(tg.tagName) || tg.isContentEditable)) return false;
    const k = (e.key || '').toLowerCase();
    return /^[1-9]$/.test(k) || !!DIRS[k];
  };
  ['keydown', 'keyup'].forEach((t) => document.addEventListener(t, (e) => { if (ours(e)) e.stopImmediatePropagation(); }, true));
  document.addEventListener('keypress', (e) => {
    if (!S.loc || e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target;
    if (tg && (/^(input|textarea|select)$/i.test(tg.tagName) || tg.isContentEditable)) return;
    if (/^[1-9]$/.test(e.key || '')) {
      // Always swallow the key: if the list is being refreshed there is no link right now, and letting the game see the
      // key would open the old combat page.
      e.preventDefault();
      e.stopImmediatePropagation();
      const link = document.querySelector('#ssh-al a[data-atk="' + e.key + '"]');
      if (link) doAttack(link);
      return;
    }
    const d = DIRS[(e.key || '').toLowerCase()];
    if (!d) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const m = S.moves.find((q) => q.x === S.loc.x + d[0] && q.y === S.loc.y + d[1]);
    if (m && m.enabled) go(m.href);
  }, true);
}
