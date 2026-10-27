import { S } from '../core/state.js';
import { addStyle } from './styles.js';

function mapEls() {
  const mapDiv = document.getElementById('mapDiv');
  if (!mapDiv) return null;
  const mapTd = mapDiv.parentElement;
  return { mapDiv, mapTd, layout: mapTd.closest('table') };
}

function buildViewer() {
  const v = document.createElement('div');
  v.id = 'ssh-map';
  v.innerHTML =
    '<canvas id="ssh-fill"></canvas>' +
    '<div id="ssh-world"></div>' +
    '<div id="ssh-loc"></div>' +
    '<a id="ssh-wiki" target="_blank" rel="noopener" title="Open map in Wiki">W</a>' +
    '<div id="ssh-zoom"><button type="button" data-z="-1" title="Zoom out">&minus;</button><span></span>' +
    '<button type="button" data-z="1" title="Zoom in">+</button></div>' +
    '<button type="button" id="ssh-fpbtn" title="Mark the tiles you walked on">Footprints</button>' +
    '<div id="ssh-pinfo"></div>' +
    '<div id="ssh-pad"></div>';
  return v;
}

export function attachViewer() {
  const els = mapEls();
  if (!els) return false;
  addStyle();
  if (!S.viewer) S.viewer = buildViewer();
  if (!S.viewer.isConnected || S.viewer.nextElementSibling !== els.layout) {
    els.layout.parentNode.insertBefore(S.viewer, els.layout);
  }
  // The game's own 5x5 map and arrows are replaced by the viewer.
  // The creature list moves into the floating action list.
  const ad = document.getElementById('actionDiv');
  if (ad) {
    ad.style.display = 'none';
    const t = ad.nextElementSibling;
    if (t && t.tagName === 'TABLE') t.style.display = 'none';
  }
  return true;
}
