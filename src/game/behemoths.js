import { fetchText } from '../core/net.js';
import { esc, fmt, https, parseHtml } from '../core/util.js';

// What the Doppler Array page says about the behemoths of the realms (their picture, name, health and the kills of the faction), by the number of
// the creature: the picture of a behemoth on the map is titans/185_2.gif, the Doppler Array's is creatures/185.jpg. Read when the map has a behemoth.

export const titanId = (u) => (String(u).match(/titans\/(\d+)/) || [])[1] || '';

export async function loadDoppler() {
  const doc = parseHtml(await fetchText('index.php?cmd=guild&subcmd=dopplerarray'));
  const out = [];
  doc.querySelectorAll('tr[data-doppler-creature]').forEach((tr) => {
    const c = tr.cells;
    const im = c[0] && c[0].querySelector('img');
    const id = im ? ((im.getAttribute('src') || '').match(/creatures\/(\d+)/) || [])[1] : '';
    if (!id) return;
    const hp = /([\d,]+)\s*\/\s*([\d,]+)/.exec(c[2] ? c[2].textContent : '');
    out.push({
      id, name: im.getAttribute('title') || '', pic: https(new URL(im.getAttribute('src'), location.href).href), realm: (c[1] ? c[1].textContent : '').trim(),
      now: hp ? parseInt(hp[1].replace(/,/g, ''), 10) : 0, max: hp ? parseInt(hp[2].replace(/,/g, ''), 10) : 0, kills: parseInt((c[3] ? c[3].textContent : '0').replace(/[^\d]/g, ''), 10) || 0,
    });
  });
  return out;
}

// The tooltip of a behemoth on the map: its picture, name, realm, health and the faction's kills ("" when the Doppler Array has not named it yet).
export function behemothTip(u, list, area) {
  const id = titanId(u);
  const mine = (list || []).filter((b) => b.id === id);
  const b = mine.find((x) => x.realm === area) || mine[0];
  if (!b) return '<b style="color:#ffff40">Behemoth</b>';
  const pc = b.max ? Math.round((b.now / b.max) * 1000) / 10 : 0;
  return '<img src="' + esc(b.pic) + '" alt="" style="height:90px;width:auto;margin:0 auto;border:1px solid #333">' +
    '<div style="text-align:center;margin-top:4px"><b style="color:#ffff40">' + esc(b.name) + '</b></div>' +
    (b.max ? '<div style="text-align:center">HP: <b>' + fmt(b.now) + ' / ' + fmt(b.max) + '</b> (' + pc + '%)</div>' : '') +
    '<div style="text-align:center">Your faction\'s kills: <b>' + fmt(b.kills) + '</b></div>';
}
