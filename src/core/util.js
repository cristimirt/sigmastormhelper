export const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The banner keeps its look; we only write the real values on its bars and add a gear durability bar.
export const txt = (x) => String(x || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();

export const num = (x) => parseInt(String(x).replace(/,/g, ''), 10) || 0;

export const fmt = (n) => Number(n).toLocaleString('en-US');
