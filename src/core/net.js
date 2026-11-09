// The game's new request rules (its own scripts: /js/security.js and /js/world-controls.js):
//  - every request to index.php carries the page's CSRF token (<meta name="csrf-token">) as `_csrf`; a request without it gets
//    "Request verification failed" (403) for most pages. The game takes the token off the address bar once the page has loaded.
//  - a move and the stairs (cmd=world, subcmd=move / usestairs) are a POST now (a GET is answered with 405): the same fields as the old
//    address, plus `_operation`, a random one-time value (32 random bytes as 64 hex digits), plus `_csrf`.
//  - the quick buttons (assault, medipack, repair kit) are POST forms with the same two fields.
// So: every request to index.php that has no token gets the page's own (in the address for a GET, among the fields for a POST), every POST
// gets a fresh `_operation`, and the old move / stairs addresses are sent as the POST the game sends. Requests the game made itself (they
// have the fields) are left as they are. `navigate()` is the same for the places where the helper sends the browser to an address.
const TOKEN = '_csrf';
const OP = '_operation';

const token = () => {
  const m = document.querySelector('meta[name="csrf-token"]');
  return m ? m.content : '';
};

function operation() {
  if (window.sigmaSecurity && typeof window.sigmaSecurity.operation === 'function') return window.sigmaSecurity.operation();
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => ('0' + x.toString(16)).slice(-2)).join('');
}

// The game's items, components, ... are small POST forms now (a button with form="item-action-123"). The helper keeps working with
// addresses for them: this is the address of a form's fields (without the token and the one-time value, they are added when it is sent),
// marked so that fetch() sends it as the POST it stands for.
const MARK = 'ssh_post';
export function postHref(form) {
  const q = new URLSearchParams();
  [...form.elements].forEach((e) => { if (e.name && !/^(_csrf|_operation)$/.test(e.name) && e.type !== 'submit' && e.type !== 'button' && e.type !== 'image') q.append(e.name, e.value); });
  q.append(MARK, '1');
  return 'index.php?' + q.toString();
}

const isIndex = (u) => u.origin === location.origin && /\/index\.php$/.test(u.pathname);
const isTravel = (u) => u.searchParams.get('cmd') === 'world' && ['move', 'usestairs'].includes(u.searchParams.get('subcmd'));

function withFields(body, tok) {
  if (body instanceof URLSearchParams) {
    const c = new URLSearchParams(body);
    if (!c.has(OP)) c.set(OP, operation());
    if (!c.has(TOKEN)) c.set(TOKEN, tok);
    return c;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const c = new FormData();
    for (const [k, v] of body) c.append(k, v);
    if (!c.has(OP)) c.append(OP, operation());
    if (!c.has(TOKEN)) c.append(TOKEN, tok);
    return c;
  }
  if (typeof body === 'string') return withFields(new URLSearchParams(body), tok).toString();
  return body;
}

// An address with the token (a link the helper writes into the page; the game's own links have it).
export function withToken(href) {
  try {
    const u = new URL(String(href), location.href);
    const tok = token();
    if (tok && isIndex(u) && !u.searchParams.has(TOKEN) && !isTravel(u)) {
      u.searchParams.set(TOKEN, tok);
      return u.href;
    }
  } catch (e) { /* as it was */ }
  return href;
}

export function installCsrf() {
  if (window.__sshCsrf) return;
  window.__sshCsrf = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const tok = token();
      if (tok && !(typeof Request !== 'undefined' && input instanceof Request)) {
        const u = new URL(String(input), location.href);
        if (isIndex(u)) {
          const post = init && init.method && /^post$/i.test(init.method);
          if (post) {
            if (init.body) init = Object.assign({}, init, { body: withFields(init.body, tok) });
          } else if (u.searchParams.has(MARK)) {
            const body = new URLSearchParams(u.search);
            body.delete(MARK);
            body.delete(TOKEN);
            input = u.origin + u.pathname;
            init = Object.assign({}, init, { method: 'POST', body: withFields(body, tok) });
          } else if (isTravel(u)) {
            // the old address of a move or of the stairs: the game sends it as a POST now
            const body = new URLSearchParams(u.search);
            body.delete(TOKEN);
            input = u.origin + u.pathname;
            init = Object.assign({}, init, { method: 'POST', body: withFields(body, tok) });
          } else if (!u.searchParams.has(TOKEN)) {
            u.searchParams.set(TOKEN, tok);
            input = u.href;
          }
        }
      }
    } catch (e) { /* the request goes as it was */ }
    return orig(input, init);
  };
  // a link the helper wrote (it has no token) gets it when it is used: a click, a middle click, or the context menu (open in a new tab)
  const sign = (e) => {
    const a = e.target && typeof e.target.closest === 'function' ? e.target.closest('a[href]') : null;
    if (!a || a.getAttribute('href').startsWith('#') || /^javascript:/i.test(a.getAttribute('href'))) return;
    const h = withToken(a.getAttribute('href'));
    if (h !== a.getAttribute('href')) a.setAttribute('href', h);
  };
  ['click', 'auxclick', 'contextmenu', 'mousedown'].forEach((t) => document.addEventListener(t, sign, true));
}

// The browser goes to an address: a move or the stairs by a POST form (like the game's own links do), anything else by the address with
// the token.
export function navigate(href) {
  try {
    const u = new URL(String(href), location.href);
    const tok = token();
    if (tok && isIndex(u)) {
      if (isTravel(u) || u.searchParams.has(MARK)) {
        const f = document.createElement('form');
        f.method = 'post';
        f.action = u.origin + u.pathname;
        const fields = new URLSearchParams(u.search);
        fields.delete(TOKEN);
        fields.delete(MARK);
        fields.set(OP, operation());
        fields.set(TOKEN, tok);
        fields.forEach((v, k) => {
          const i = document.createElement('input');
          i.type = 'hidden';
          i.name = k;
          i.value = v;
          f.append(i);
        });
        document.body.append(f);
        f.submit();
        return;
      }
      if (!u.searchParams.has(TOKEN)) u.searchParams.set(TOKEN, tok);
      location.href = u.href;
      return;
    }
  } catch (e) { /* the plain way */ }
  location.href = href;
}
