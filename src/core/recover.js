// Reload (F5) and Back to a page of the game: the game takes the token (_csrf) off the address bar once a page has loaded, so the address in the
// history has none, and the game answers it with the bare text "Request verification failed". The token of the session is the same on every page,
// so the helper keeps the last one it saw (in this browser) and, when it finds that answer to an address without a token, asks for the same
// address again with the token. The failed page is replaced (not added to the history), so Back and Forward keep working.
const KEY = 'SSH_csrf';
const FAIL = /^\s*Request verification failed\.?\s*$/i;

const read = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* no storage: nothing to remember */ } };

function check() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta && meta.content) { if (read() !== meta.content) write(meta.content); return; } // a normal page: remember its token
  const body = document.body;
  if (!body || !FAIL.test(body.textContent || '')) return;
  const u = new URL(location.href);
  const tok = read();
  if (!tok || u.searchParams.has('_csrf') || !/\/index\.php$/.test(u.pathname)) return; // nothing to add (or the token itself is no good any more)
  u.searchParams.set('_csrf', tok);
  location.replace(u.href);
}

export function recoverToken() {
  if (window.__sshRecover) return;
  window.__sshRecover = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
}
