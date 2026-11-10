// The game still writes some of its picture addresses with http://; the same files are served over https.
// (the local test server of the helper stays as it is)
export const https = (u) => String(u || '').replace(/^http:\/\/(?!127\.0\.0\.1|localhost)/i, 'https://');

export const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The banner keeps its look; we only write the real values on its bars and add a gear durability bar.
export const txt = (x) => String(x || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();

export const num = (x) => parseInt(String(x).replace(/,/g, ''), 10) || 0;

export const fmt = (n) => Number(n).toLocaleString('en-US');

// A number written with only its digits kept ("1,234 gold" -> 1234); `num` above reads the number at the start of the text.
export const digits = (x) => +String(x || '').replace(/[^\d]/g, '') || 0;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

// A picture address as a css value (a relative address is made absolute; the game's addresses may be http://).
export const cssUrl = (u) => (u ? 'url("' + https(new URL(u, location.href).href) + '")' : 'none');

// The game's messages (boxes with a head line like "ERROR ALERT"): one line of text from a box's text, as one line from a list of boxes,
// and whether any of them is an error or a warning.
export const alertLine = (s) => String(s).replace(/\s+/g, ' ').replace(/^\s*(INFORMATION|ERROR|WARNING|SUCCESS)?\s*ALERT\s*/i, '').trim();
export const alertText = (alerts) => alerts.map((t) => alertLine(t.textContent)).filter(Boolean).join(' ');
export const alertBad = (alerts) => alerts.some((t) => /ERROR|WARNING/i.test((t.querySelector('b') || {}).textContent || ''));
