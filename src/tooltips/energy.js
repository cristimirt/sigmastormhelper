import { SSH } from '../core/constants.js';
import { S } from '../core/state.js';

// The banner's energy tooltip is plain text written when the page was made ("Next Gain : 21m 40s", +50 every hour).
// S.hdrT is the moment that text was current (page load, or the last time the banner was replaced from a response).
S.hdrT = Date.now();

export const energyOn = (html) => /<b>Energy<\/b>/.test(html) && /Next[\s ]+Gain/.test(html);

// The server's clock as shown in the page (its zone is not ours): the offset from UTC, rounded to a quarter of an hour.
export function serverOffset() {
  if (S.srvOff !== undefined) return S.srvOff;
  S.srvOff = null;
  const m = (document.body ? document.body.textContent : '').replace(/\s+/g, ' ').match(/Server Time:\s*(\d{1,2}):(\d{2})\s*(\d{1,2})\/([A-Za-z]{3})\/(\d{4})/);
  const mon = m ? 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[4].slice(0, 1).toUpperCase() + m[4].slice(1, 3).toLowerCase()) / 3 : -1;
  if (m && mon >= 0 && mon % 1 === 0) S.srvOff = Math.round((Date.UTC(+m[5], mon, +m[3], +m[1], +m[2]) - Date.now()) / 900000) * 900000;
  return S.srvOff;
}

function fmtLeft(ms, secs) {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return secs ? (h ? h + 'h ' : '') + m + 'm ' + (t % 60) + 's' : (h ? h + 'h ' : '') + m + 'm';
}

// Rewrites the tooltip text: energy now (the +50 steps since the banner was read are added), the countdown, and when it is full.
export function energyHtml(html) {
  const em = html.match(/Energy:[\s ]*<\/td><td[^>]*>([\d,]+)[\s ]*\/[\s ]*([\d,]+)/);
  const nm = html.match(/(Next[\s ]+Gain[\s ]*:[\s ]*<\/td><td[^>]*>)([^<]*)(<\/td><\/tr>)/);
  const gm = html.match(/Gain[\s ]+Per[\s ]+Hour:[\s ]*<\/td><td[^>]*>\+?(\d+)/);
  const bm = nm && nm[2].trim().match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/);
  if (!em || !nm || !gm || !bm || !nm[2].trim()) return html;
  const max = parseInt(em[2].replace(/,/g, ''), 10);
  const gain = parseInt(gm[1], 10);
  const now = Date.now();
  const first = S.hdrT + ((+bm[1] || 0) * 3600 + (+bm[2] || 0) * 60 + (+bm[3] || 0)) * 1000;
  const ticks = now < first ? 0 : 1 + Math.floor((now - first) / 3600000);
  const next = first + ticks * 3600000;
  const cur = Math.min(max, parseInt(em[1].replace(/,/g, ''), 10) + ticks * gain);
  let full;
  if (cur >= max || !gain) full = cur >= max ? 'Full' : '-';
  else {
    const at = next + (Math.ceil((max - cur) / gain) - 1) * 3600000;
    const hm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const d = new Date(at);
    const day = d.toDateString() === new Date(now).toDateString() ? '' : d.toDateString() === new Date(now + 86400000).toDateString() ? 'tomorrow ' : d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ';
    const off = serverOffset();
    const srv = off === null ? '' : ', server ' + String(new Date(at + off).getUTCHours()).padStart(2, '0') + ':' + String(new Date(at + off).getUTCMinutes()).padStart(2, '0');
    full = fmtLeft(at - now) + ' <font color=\'#999999\'>(' + day + hm(d) + srv + ')</font>';
  }
  return html
    .replace(em[0], em[0].replace(em[1], String(cur)))
    .replace(nm[0], nm[1] + fmtLeft(next - now, true) + nm[3] + '<tr><td><font color=\'#999999\'>Full&nbsp;in&nbsp;:&nbsp;</td><td width=\'90%\'>' + full + '</td></tr>');
}

SSH.energy = { energyHtml, energyOn, serverOffset };
