export const mel = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export const mq = (rows, sel) => rows.flatMap((r) => [...r.querySelectorAll(sel)]);

export const leaf = (rows) => mq(rows, 'td').filter((td) => !td.querySelector('td') && (td.textContent.trim() || td.querySelector('img')));

// Hover / click handlers of the game's markup (tooltips, confirmations) are inline attributes: copy them as they are.
export const copyOn = (from, to) => { [...from.attributes].forEach((a) => { if (/^on/i.test(a.name)) to.setAttribute(a.name, a.value); }); return to; };

// Form controls become proxies: what the player does is written to the original control, buttons click the original.
function proxyInput(o) {
  const t = (o.type || '').toLowerCase();
  if (t === 'hidden') return document.createDocumentFragment();
  const c = o.cloneNode(false);
  ['id', 'name', 'form'].forEach((a) => c.removeAttribute(a));
  if (t === 'checkbox' || t === 'radio') {
    c.checked = o.checked;
    c.addEventListener('click', () => { if (o.checked !== c.checked) o.click(); });
  } else if (t === 'submit' || t === 'button' || t === 'image' || t === 'reset') {
    c.type = 'button';
    c.removeAttribute('onclick');
    c.addEventListener('click', (e) => { e.preventDefault(); o.click(); });
  } else {
    c.value = o.value;
    c.addEventListener('input', () => { o.value = c.value; });
  }
  return c;
}

function proxySelect(o) {
  const c = o.cloneNode(true);
  ['id', 'name', 'onchange'].forEach((a) => c.removeAttribute(a));
  c.value = o.value;
  c.addEventListener('change', () => { o.value = c.value; o.dispatchEvent(new Event('change', { bubbles: true })); });
  return c;
}

// A copy of a piece of the original markup (links, images, tooltips kept) whose form controls are proxies.
export function proxify(n) {
  if (n.nodeType === 3) return document.createTextNode(n.textContent);
  if (n.nodeType !== 1 || n.tagName === 'SCRIPT') return document.createDocumentFragment();
  if (n.tagName === 'SELECT') return proxySelect(n);
  if (n.tagName === 'INPUT') return proxyInput(n);
  const c = n.cloneNode(false);
  c.removeAttribute('id');
  n.childNodes.forEach((k) => c.append(proxify(k)));
  return c;
}

export const proxyKids = (td, box) => { td.childNodes.forEach((k) => box.append(proxify(k))); return box; };
