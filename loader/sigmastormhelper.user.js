// ==UserScript==
// @name         Sigmastorm Helper
// @namespace    https://cristimirt.github.io/sigmastormhelper/
// @description  Quality of life for Sigmastorm: a bigger map you can walk on, a modern profile and backpack, better tooltips.
// @author       Aurik16
// @version      1.0.1
// @match        https://www.sigmastorm.com/*
// @match        https://sigmastorm.com/*
// @match        https://cristimirt.github.io/sigmastormhelper/*
// @downloadURL  https://cristimirt.github.io/sigmastormhelper/sigmastormhelper.user.js
// @updateURL    https://cristimirt.github.io/sigmastormhelper/sigmastormhelper.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

// This is only a loader. The helper itself is published at https://cristimirt.github.io/sigmastormhelper/ and is fetched on
// every page load (manifest.json names the current build), so it updates without touching this file.
// For development: localStorage.setItem('SSH_dev_base', 'http://127.0.0.1:8765/') makes the loader use `npm run dev`.
(function () {
  'use strict';
  const ROOT = 'https://cristimirt.github.io/sigmastormhelper/';
  const de = document.documentElement;

  // on the install page the loader only announces itself
  if (location.hostname === 'cristimirt.github.io') {
    de.setAttribute('data-ssh-loader', (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) || '1');
    return;
  }
  // `ssh=off` in the address (index.php?cmd=profile&ssh=off) keeps the helper out of that page: to see the game as it is, or to
  // work on the helper without this copy of it loading too
  if (/[?&]ssh=off(&|#|$)/.test(location.search)) return;
  if (de.hasAttribute('data-ssh') || window.__ssh) return; // once per page
  de.setAttribute('data-ssh', '1');

  // Keep the original map / profile from flashing while the helper loads (the helper removes these again).
  // HIDE_CSS must stay the same as in src/core/constants.js (the build checks it).
  const HIDE_CSS = '#mapDiv,#actionDiv,#actionDiv+table,#mapDiv+table>tbody>tr:nth-child(-n+3),td[background*="coord_bg"]{display:none!important}';
  const early = (id, css) => {
    const st = document.createElement('style');
    st.id = id;
    st.textContent = css;
    (document.head || de).appendChild(st);
  };
  try {
    if (/[?&]cmd=world/.test(location.search)) early('ssh-early', HIDE_CSS);
    if (/[?&]cmd=profile/.test(location.search) && localStorage.getItem('SSH_layout') === '"modern"') early('ssh-early-m', 'table[background*="large_content_bg"]{visibility:hidden}');
  } catch (e) { /* storage blocked */ }
  // never leave the page hidden if something goes wrong
  setTimeout(() => ['ssh-early', 'ssh-early-m'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); }), 15000);

  // Runs in the page itself (like the FallenSword Helper does): find the current build, load it, start it.
  async function boot(rootEnc, infoEnc) {
    const root = decodeURIComponent(rootEnc);
    let info = {};
    try { info = JSON.parse(decodeURIComponent(infoEnc)); } catch (e) { /* no info */ }
    let base = root;
    try { base = localStorage.getItem('SSH_dev_base') || root; } catch (e) { /* storage blocked */ }
    if (!/\/$/.test(base)) base += '/';
    const key = 'SSH_loader' + (base === root ? '' : '_dev');
    let manifest = null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(base + 'manifest.json', { cache: 'no-cache', signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) {
        manifest = await r.json();
        try { localStorage.setItem(key, JSON.stringify(manifest)); } catch (e) { /* storage full */ }
      }
    } catch (e) { /* offline or the site is down: use the last one that worked */ }
    if (!manifest) { try { manifest = JSON.parse(localStorage.getItem(key)); } catch (e) { manifest = null; } }
    try {
      if (!manifest || !manifest.main) throw new Error('no manifest');
      const mod = await import(base + manifest.main);
      await mod.default({ build: manifest.build, base, manifest, gmInfo: info });
    } catch (e) {
      console.error('[Sigmastorm Helper] could not start', e);
      ['ssh-early', 'ssh-early-m'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
    }
  }

  const arg = (v) => '"' + encodeURIComponent(v) + '"';
  const info = typeof GM_info !== 'undefined' ? JSON.stringify(GM_info) : '{}';
  const s = document.createElement('script');
  s.textContent = 'document.documentElement.setAttribute("data-ssh-boot","1");(' + boot.toString() + ')(' + arg(ROOT) + ',' + arg(info) + ');';
  de.appendChild(s);
  de.removeChild(s);
  if (!de.hasAttribute('data-ssh-boot')) boot(encodeURIComponent(ROOT), encodeURIComponent(info)); // the page refused inline scripts: run it from here
})();
