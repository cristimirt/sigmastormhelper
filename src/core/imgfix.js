import { https } from './util.js';
// The game's pictures of upgraded items (the forge level stars in a tooltip, ...) still point at https://sigmastorm.com/hellforge/... (or just hellforge/..., as in the
// tooltips), which does not exist any more: they are on the CDN now. Wherever such a picture shows up in the page (the game's own tooltips included), its
// address is changed.
const OLD = /^(?:https?:\/\/(?:www\.)?sigmastorm\.com)?\/?hellforge\//i; // also the relative address the tooltips use (hellforge/forgelevel.gif)
const NEW = 'https://cdn.sigmastorm.com/hellforge/';

export const fixHellforge = (html) => html.replace(/(src\s*=\s*[\"']?)(?:https?:\/\/(?:www\.)?sigmastorm\.com)?\/?hellforge\//gi, '$1' + NEW).replace(/https?:\/\/(?:www\.)?sigmastorm\.com\/hellforge\//gi, NEW);

function fix(img) {
  const s = img.getAttribute('src');
  if (s && OLD.test(s)) img.setAttribute('src', s.replace(OLD, NEW));
}

export function installImgFix() {
  if (window.__sshImgFix) return;
  window.__sshImgFix = true;
  const all = (n) => {
    if (n.nodeType !== 1) return;
    if (n.tagName === 'IMG') fix(n);
    else if (n.querySelectorAll) n.querySelectorAll('img').forEach(fix);
  };
  new MutationObserver((list) => list.forEach((m) => {
    if (m.type === 'attributes') fix(m.target);
    else m.addedNodes.forEach(all);
  })).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  document.querySelectorAll('img').forEach(fix);
}
