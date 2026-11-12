import { https } from './util.js';
// The game's pictures of upgraded items (the forge level stars in a tooltip, ...) still point at https://sigmastorm.com/hellforge/... (or just hellforge/..., as in the
// tooltips), which does not exist any more: they are on the CDN now. Wherever such a picture shows up in the page (the game's own tooltips included), its
// address is changed.
// The damage type pictures of the ammo tooltips (damagetypes/0.jpg, 1, 2 ...) are on the CDN too.
const OLD = /^(?:https?:\/\/(?:www\.)?sigmastorm\.com)?\/?(hellforge|damagetypes)\//i; // also the relative address the tooltips use (hellforge/forgelevel.gif)
const NEW = 'https://cdn.sigmastorm.com/';

export function fixHellforge(html) {
  return fixSlashesIn(html).replace(/(src\s*=\s*[\"']?)(?:https?:\/\/(?:www\.)?sigmastorm\.com)?\/?(hellforge|damagetypes)\//gi, '$1' + NEW + '$2/').replace(/https?:\/\/(?:www\.)?sigmastorm\.com\/(hellforge|damagetypes)\//gi, NEW + '$1/');
}

// Some pages write a picture address with a double slash before the path (https://cdn.sigmastorm.com//updates_header.jpg): one slash. Only
// the slashes right after the host are changed (the // of https:// stays).
const DOUBLE = /^(https?:\/\/[^\/?#\s]+)\/{2,}(?=[^\/])/i;
export const fixSlashes = (u) => String(u).replace(DOUBLE, '$1/');

// The same in markup written as text (a tooltip): in src="...", background="..." and url(...).
const fixSlashesIn = (html) => html.replace(/((?:src|background)\s*=\s*["']?|url\(\s*["']?)(https?:\/\/[^\/?#\s"'()<>]+)\/{2,}(?=[^\/])/gi, '$1$2/');

// The map tiles are asked through /asset.php?path=tiles/41_49.gif (or /asset.php?tiles/41_49.gif), a script that takes ~700 ms per picture,
// while the CDN serves the same file in ~25 ms: the address is changed to the CDN's. Only the tiles: the other pictures (the items) are not
// the same on the CDN, so their asset.php addresses stay.
const ASSET = /^(?:https?:\/\/(?:www\.)?sigmastorm\.com)?\/?asset\.php\?(?:path=)?(tiles(?:\/|%2F)[^&#\s]*)/i;
const fromAsset = (s) => {
  let p = s.match(ASSET)[1];
  try { p = decodeURIComponent(p); } catch (e) { /* keep it as it is */ }
  return 'https://cdn.sigmastorm.com/' + p.replace(/^\/+/, '');
};

const ATTRS = ['src', 'background'];

function fix(el) {
  ATTRS.forEach((a) => {
    const s = el.getAttribute(a);
    if (!s) return;
    if (ASSET.test(s)) el.setAttribute(a, fromAsset(s));
    else if (a === 'src' && OLD.test(s)) el.setAttribute(a, s.replace(OLD, NEW + '$1/'));
    else if (DOUBLE.test(s)) el.setAttribute(a, fixSlashes(s));
  });
}

export function installImgFix() {
  if (window.__sshImgFix) return;
  window.__sshImgFix = true;
  const all = (n) => {
    if (n.nodeType !== 1) return;
    fix(n);
    if (n.querySelectorAll) n.querySelectorAll('[src], [background]').forEach(fix);
  };
  new MutationObserver((list) => list.forEach((m) => {
    if (m.type === 'attributes') fix(m.target);
    else m.addedNodes.forEach(all);
  })).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS });
  document.querySelectorAll('[src], [background]').forEach(fix);
}
