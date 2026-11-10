/* ===================== rc-gate.js : the doorkeeper of the LIBRARY site =====================
   Install it on ravenclaw-library.vercel.app (NOT on the main site).

   Add this ONE line as the FIRST script in the <head> of every library page (no async / defer / type=module):
       <script src="/rc-gate.js"></script>

   The script hides the page until the member account is proven valid:
     - the address has #ticket=...  -> the single-use ticket is exchanged on the server (verifyTicket) and a library
                                       session is stored for 24 hours. This is the "Enter the Library" button on the
                                       account page of the main site: no second login.
     - no ticket                    -> the stored session is checked on the server (libraryMe)
     - no valid session             -> a sign-in form (username + password) is shown right here (libraryLogin).
                                       One account works on both sites.
   Once it passes: window.RC_MEMBER holds the member data, the "rc-gate-ok" event is fired and window.rcLogout() exists.

   HONEST NOTE ABOUT SECURITY: this gate works in the BROWSER. It is enough to make the library open only through an
   account, but a technical person can still read the static files with "view source". If the library holds real secrets,
   the data/pages must be served by a server that checks the token first (send the library session token to the
   libraryMe action of the backend, or check it in Vercel middleware). */
(function () {
  'use strict';

  var API = 'https://script.google.com/macros/s/AKfycbwuYs1j6QxlGI1jW4R8Duaqjz5KBH2fhOnu94OOjDa0GKRe1wpsTd5VhgtpZRVybpT_xA/exec';
  var HOME = '';              // OPTIONAL: address of the account page on the main site, e.g. 'https://yoursite.example/profile' (used for the "Create an account" link)
  var KEY = 'rcl-session';    // library session (localStorage)
  var OKKEY = 'rcl-ok';       // time of the last successful server check (sessionStorage)
  var RECHECK_MS = 5 * 60 * 1000; // a session the server has checked is trusted this long (no check on every page)
  var TIMEOUT_MS = 20000;

  /* 1. Hide everything as early as possible. */
  var css = document.createElement('style');
  css.id = 'rc-gate-css';
  css.textContent = 'html{visibility:hidden!important}#rc-gate-box{visibility:visible!important}';
  (document.head || document.documentElement).appendChild(css);

  /* ---------- storage that does not throw in private mode ---------- */
  function sget(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, v); } catch (e) { /* ignore */ } }
  function sdel(store, k) { try { window[store].removeItem(k); } catch (e) { /* ignore */ } }
  function readSession() {
    try {
      var s = JSON.parse(sget('localStorage', KEY) || 'null');
      if (!s || typeof s !== 'object' || !/^[0-9a-f]{64}$/.test(String(s.token || ''))) return null;
      if (s.expires && Date.parse(s.expires) < Date.now()) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSession() { sdel('localStorage', KEY); sdel('sessionStorage', OKKEY); }
  function saveSession(d) {
    sset('localStorage', KEY, JSON.stringify({ token: d.token, expires: d.expires || '', member: d.member || null }));
    sset('sessionStorage', OKKEY, String(Date.now()));
  }
  function goodToken(d) { return !!d && /^[0-9a-f]{64}$/.test(String(d.token || '')); }

  /* ---------- 2. Take the ticket out of the address and remove it from the history ---------- */
  function takeTicket() {
    var found = '', changed = false, hash = location.hash, search = location.search;
    function strip(str, lead) {
      if (!str || str.charAt(0) !== lead) return str;
      var keep = [];
      str.slice(1).split('&').forEach(function (part) {
        if (part.split('=')[0] === 'ticket') { if (!found) found = part.slice(7); changed = true; }
        else if (part) keep.push(part);
      });
      return keep.length ? lead + keep.join('&') : '';
    }
    hash = strip(hash, '#');
    search = strip(search, '?');
    if (changed) { try { history.replaceState(null, '', location.pathname + search + hash); } catch (e) { /* ignore */ } }
    try { found = decodeURIComponent(found); } catch (e) { found = ''; }
    return /^[0-9a-f]{64}$/.test(found) ? found : '';
  }

  /* ---------- server ---------- */
  function call(payload) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : 0;
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit',
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) { return r.text(); }).then(function (t) {
      clearTimeout(timer);
      var j;
      try { j = JSON.parse(t); } catch (e) { var pe = new Error('The server replied in an unexpected format.'); pe.net = true; throw pe; }
      if (!j || !j.ok) { var se = new Error((j && j.error) || 'The server refused the request.'); se.server = true; throw se; }
      return j.data || {};
    }, function (e) {
      clearTimeout(timer);
      var ne = new Error(e && e.name === 'AbortError' ? 'The server took too long to answer.' : 'Could not reach the server.');
      ne.net = true;
      throw ne;
    });
  }

  /* ---------- screen ---------- */
  function h(tag, style, text, attrs) {
    var n = document.createElement(tag);
    if (style) n.style.cssText = style;
    if (text != null) n.textContent = text;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  var BTN = 'display:inline-block;margin:4px;padding:12px 26px;border-radius:999px;border:1px solid #E0C68F;background:#E0C68F;color:#112250;font:700 12px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;cursor:pointer';
  var INPUT = 'display:block;width:100%;box-sizing:border-box;margin:0 0 14px;padding:12px;border-radius:8px;border:1px solid rgba(224,198,143,.55);background:rgba(255,255,255,.08);color:#F5F0E9;font:500 16px system-ui,sans-serif';
  var LABEL = 'display:block;margin:0 0 5px;text-align:left;font:700 11px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.18em;text-transform:uppercase;color:#E0C68F';

  /* Builds the full-screen card, calls fill(card), and focuses the first control. */
  function screen(title, fill) {
    function build() {
      var old = document.getElementById('rc-gate-box');
      if (old) old.remove();
      var d = h('div', 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;background:#03050c;color:#F5F0E9;font:500 16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center', null,
        { id: 'rc-gate-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rc-gate-t' });
      var c = h('div', 'max-width:420px;width:100%;margin:auto;padding:28px 24px;border:1px solid rgba(224,198,143,.45);border-radius:16px;background:#0c1038;box-shadow:0 0 40px rgba(224,198,143,.12)');
      c.appendChild(h('h1', 'margin:0 0 10px;font:700 22px/1.25 Georgia,serif;letter-spacing:.04em;color:#E0C68F', title, { id: 'rc-gate-t' }));
      fill(c);
      d.appendChild(c);
      document.documentElement.appendChild(d);
      var first = d.querySelector('input,a,button');
      if (first) first.focus();
    }
    if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  }

  function reveal(member) {
    var c = document.getElementById('rc-gate-css');
    if (c) c.remove();
    var b = document.getElementById('rc-gate-box');
    if (b) b.remove();
    window.RC_MEMBER = member || null;
    try { window.dispatchEvent(new CustomEvent('rc-gate-ok', { detail: { member: member || null } })); } catch (e) { /* ignore */ }
  }

  /* The server could not be reached, so the account could not be checked. The session is kept. */
  function offline(text) {
    screen('Cannot check your account', function (c) {
      c.appendChild(h('p', 'margin:0 0 18px;color:rgba(245,240,233,.8)', text));
      var b = h('button', BTN, 'Try again', { type: 'button' });
      b.addEventListener('click', function () { location.reload(); });
      c.appendChild(b);
    });
  }

  /* Sign-in form for people who open the library directly. message = why they are seeing it (optional). */
  function signIn(message) {
    clearSession();
    screen('Members only', function (c) {
      c.appendChild(h('p', 'margin:0 0 16px;color:rgba(245,240,233,.8)', 'Sign in with your House of Ravenclaw account to enter the Library.'));
      if (message) c.appendChild(h('p', 'margin:0 0 16px;padding:10px 12px;border-radius:8px;background:rgba(224,198,143,.12);color:#E0C68F;font-size:14px', message, { id: 'rc-gate-msg', role: 'status' }));
      var f = h('form', 'margin:0;text-align:left', null, { id: 'rc-gate-form', novalidate: '' });
      f.appendChild(h('label', LABEL, 'Username', { for: 'rc-gate-user' }));
      var u = h('input', INPUT, null, { id: 'rc-gate-user', name: 'username', type: 'text', maxlength: '40', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
      f.appendChild(u);
      f.appendChild(h('label', LABEL, 'Password', { for: 'rc-gate-pass' }));
      var pw = h('input', INPUT, null, { id: 'rc-gate-pass', name: 'password', type: 'password', maxlength: '64', autocomplete: 'current-password' });
      f.appendChild(pw);
      var err = h('p', 'min-height:1.3em;margin:0 0 12px;color:#ff9c9c;font-size:14px;font-weight:600', '', { id: 'rc-gate-err', role: 'alert' });
      f.appendChild(err);
      var go = h('button', BTN + ';width:100%;margin:0', 'Sign in', { type: 'submit', id: 'rc-gate-go' });
      f.appendChild(go);
      var busy = false;
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy) return;
        var name = u.value.trim().replace(/^@+/, ''), pass = pw.value;
        if (!name || !pass) { err.textContent = 'Enter your username and password.'; (name ? pw : u).focus(); return; }
        busy = true; go.disabled = true; go.textContent = 'Signing in…'; err.textContent = '';
        call({ action: 'libraryLogin', username: name, password: pass }).then(function (d) {
          if (!goodToken(d)) { var bad = new Error('The server reply was incomplete.'); bad.net = true; throw bad; }
          saveSession(d);
          reveal(d.member || null);
        }).catch(function (e2) {
          busy = false; go.disabled = false; go.textContent = 'Sign in';
          err.textContent = (e2 && e2.message) || 'Something went wrong. Please try again.';
          pw.value = ''; pw.focus();
        });
      });
      c.appendChild(f);
      var tip = h('p', 'margin:18px 0 0;color:rgba(245,240,233,.6);font-size:13px;line-height:1.5');
      tip.appendChild(document.createTextNode('Coming from the House of Ravenclaw website? Press "Enter the Library" on your account page. '));
      if (HOME) {
        var a = h('a', 'color:#E0C68F;text-decoration:underline', 'Create an account', { href: HOME, id: 'rc-gate-create' });
        tip.appendChild(a);
        tip.appendChild(document.createTextNode(' if you do not have one yet.'));
      } else {
        tip.appendChild(document.createTextNode('No account yet? Create one on the House of Ravenclaw website first.'));
      }
      c.appendChild(tip);
    });
  }

  window.rcLogout = function () {
    var s = readSession();
    clearSession();
    var done = function () { location.reload(); };   // the gate runs again and shows the sign-in form
    if (s) call({ action: 'logout', token: s.token }).then(done, done); else done();
  };

  /* ---------- 3. Main flow ---------- */
  var ticket = takeTicket();

  function viaSession(prevError) {
    var s = readSession();
    if (!s) return signIn(prevError || '');
    var ok = parseInt(sget('sessionStorage', OKKEY) || '0', 10);
    if (ok && Date.now() - ok < RECHECK_MS && s.member) return reveal(s.member);
    call({ action: 'libraryMe', token: s.token }).then(function (d) {
      sset('sessionStorage', OKKEY, String(Date.now()));
      s.member = d.member || s.member;
      sset('localStorage', KEY, JSON.stringify(s));
      reveal(s.member);
    }).catch(function (e) {
      if (e && e.server) signIn('Your Library session has ended. Please sign in again.');
      else offline('The connection to the server failed, so your account could not be checked. Check your connection and try again.');
    });
  }

  if (ticket) {
    call({ action: 'verifyTicket', ticket: ticket }).then(function (d) {
      if (!goodToken(d)) throw Object.assign(new Error('The server reply was incomplete.'), { net: true });
      saveSession(d);
      reveal(d.member || null);
    }).catch(function (e) {
      if (e && e.server) viaSession(e.message);       // ticket already used or expired: maybe a session exists, otherwise the sign-in form shows the reason
      else if (readSession()) viaSession('');         // connection problem, but a session exists: check that instead
      else signIn('Your entry ticket could not be checked because the connection to the server failed. You can sign in below instead.');
    });
  } else {
    viaSession('');
  }
})();
