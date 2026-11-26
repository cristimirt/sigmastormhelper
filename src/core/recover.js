// Reload (F5) and Back to a page of the game: the game takes the token (_csrf) off the address bar once a page has loaded, so the address in the
// history has none, and the game answers it with the bare text "Request verification failed". The token of the session is the same on every page,
// so the helper keeps the last one it saw (in this browser) and, when it finds that answer to an address without a token, asks for the same
// address again with the token. The failed page is replaced (not added to the history), so Back and Forward keep working.
import { isTravel } from './net.js';

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

// F5 and Ctrl+R (Cmd+R) on a page of the game: the same address is asked for with the token from the start, so the error is not seen at all.
// The browser's reload button and menu cannot be caught by a page: check() is for them. Ctrl+F5 and Ctrl+Shift+R (reload without the cache)
// are left to the browser.
function reloadKey(e) {
  const f5 = e.key === 'F5' && !e.ctrlKey && !e.metaKey;
  const r = (e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'r';
  if (!(f5 || r) || e.shiftKey || e.altKey || e.defaultPrevented) return;
  const meta = document.querySelector('meta[name="csrf-token"]');
  const u = new URL(location.href);
  // not a page of the game with a token; a move or the stairs (not a page to ask for again)
  if (!meta || !meta.content || !/\/index\.php$/.test(u.pathname) || !u.search || isTravel(u)) return;
  u.searchParams.set('_csrf', read() || meta.content); // the saved one is the newest (another tab may have logged in again)
  if (u.href === location.href) return; // it is there already: the browser's own reload does it
  e.preventDefault();
  location.replace(u.href);
}

export function recoverToken() {
  if (window.__sshRecover) return;
  window.__sshRecover = true;
  window.addEventListener('keydown', reloadKey);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
}
