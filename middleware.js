const MAIN_SITE = 'https://ravenclaw-website.vercel.app';   // situs utama, tempat api.js berada
const API_SRC = MAIN_SITE + '/api.js';
const LOGIN_PATH = '/login.html';
const COOKIE = 'rcl';
const RECHECK_MS = 5 * 60 * 1000;          // seberapa sering session dicek ulang ke server
const GRACE_MS = 60 * 60 * 1000;           // kalau server gak kejangkau, hasil cek terakhir tetap dipercaya segini lama
const API_CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 15000;
const DEFAULT_SESSION_MS = 24 * 3600 * 1000;

export const config = { matcher: '/(.*)' };

/* ---------- helper kecil: base64url, HMAC, cookie ---------- */
const enc = new TextEncoder();
function b64u(buf) {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64uText(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function seal(secret, obj) {
  const p = b64u(enc.encode(JSON.stringify(obj)));
  return p + '.' + (await hmac(secret, p));
}
async function unseal(secret, value) {
  if (!value || value.length > 1200) return null;
  const i = value.indexOf('.');
  if (i < 1) return null;
  const p = value.slice(0, i), sig = value.slice(i + 1);
  if (!safeEq(sig, await hmac(secret, p))) return null;
  try {
    const o = JSON.parse(fromB64uText(p));
    return o && typeof o === 'object' ? o : null;
  } catch (e) { return null; }
}
function readCookie(request, name) {
  const parts = (request.headers.get('cookie') || '').split(/;\s*/);
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i].indexOf('=');
    if (k > 0 && parts[i].slice(0, k) === name) return parts[i].slice(k + 1);
  }
  return '';
}
function setCookie(value, maxAgeSec) {
  return COOKIE + '=' + value + '; Path=/; Max-Age=' + Math.max(0, Math.floor(maxAgeSec)) + '; HttpOnly; Secure; SameSite=Lax';
}
function clearCookie() {
  return COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}
function env(name) {
  try { return (typeof process !== 'undefined' && process.env && process.env[name]) || ''; } catch (e) { return ''; }
}
function secret() {
  const s = env('GATE_SECRET');
  return s.length >= 32 ? s : '';
}
const TOKEN_RE = /^[0-9a-f]{64}$/;

/* ---------- server Apps Script ---------- */
function netErr(m) { const e = new Error(m); e.net = true; return e; }
let apiCache = { url: '', at: 0 };
async function apiUrl() {
  if (apiCache.url && Date.now() - apiCache.at < API_CACHE_MS) return apiCache.url;
  const ctl = new AbortController();
  const t = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    const r = await fetch(API_SRC, { cache: 'no-store', signal: ctl.signal });
    if (r.ok) {
      const m = (await r.text()).match(/\bAPI_URL\s*=\s*['"]([^'"]+)['"]/);
      if (m && /^https:\/\/script\.google\.com\//.test(m[1])) {
        apiCache = { url: m[1], at: Date.now() };
        return m[1];
      }
    }
  } catch (e) { /* gagal? lanjut ke cadangan di bawah */ } finally { clearTimeout(t); }
  if (apiCache.url) return apiCache.url;           // salinan lama masih mending daripada gak ada
  const fromEnv = env('RC_API');
  if (/^https:\/\/script\.google\.com\//.test(fromEnv)) return fromEnv;
  throw netErr('The server address could not be read from the main site.');
}
async function callApi(payload) {
  const url = await apiUrl();
  const ctl = new AbortController();
  const t = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
  let text;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store',
      signal: ctl.signal
    });
    text = await r.text();
  } catch (e) {
    throw netErr('Could not reach the server.');
  } finally { clearTimeout(t); }
  let j;
  try { j = JSON.parse(text); } catch (e) { throw netErr('The server replied in an unrecognized format.'); }
  if (!j || !j.ok) { const se = new Error((j && j.error) || 'Rejected by the server.'); se.server = true; throw se; }
  return j.data || {};
}

/* ---------- cek session di setiap request ---------- */
async function check(request, sec) {
  const raw = readCookie(request, COOKIE);
  if (!raw) return { ok: false };
  const p = await unseal(sec, raw);
  const now = Date.now();
  if (!p || !TOKEN_RE.test(String(p.t || '')) || !(p.e > now)) return { ok: false, clear: true };
  if (now - (Number(p.c) || 0) < RECHECK_MS) return { ok: true };
  try {
    await callApi({ action: 'libraryMe', token: p.t });
    return { ok: true, cookie: setCookie(await seal(sec, { t: p.t, e: p.e, c: now }), (p.e - now) / 1000) };
  } catch (e) {
    if (e && e.server) return { ok: false, clear: true };                 // server bilang session gak valid / udah dicabut
    if (now - (Number(p.c) || 0) < GRACE_MS) return { ok: true };          // server gak kejangkau: percaya hasil cek terakhir
    return { ok: false };
  }
}

/* ---------- response ---------- */
function pass(cookie) {
  const h = { 'x-middleware-next': '1' };
  if (cookie) h['Set-Cookie'] = cookie;
  return new Response(null, { headers: h });
}
function json(obj, status, cookie) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (cookie) h.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h });
}
function deny(request, url, r) {
  const h = new Headers({ 'Cache-Control': 'no-store' });
  if (r && r.clear) h.append('Set-Cookie', clearCookie());
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (wantsPage) {
    h.set('Location', LOGIN_PATH + '?next=' + encodeURIComponent(url.pathname + url.search));
    return new Response(null, { status: 302, headers: h });
  }
  h.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response('Please sign in first.', { status: 401, headers: h });
}
function sameOrigin(request, url) {
  const o = request.headers.get('origin');
  return !o || o === url.origin;
}

/* ---------- /_gate/session : tuker ticket atau username + password jadi session ---------- */
async function handleSession(request, url, sec) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
  if (!sameOrigin(request, url)) return json({ ok: false, error: 'Request rejected.' }, 403);
  if (!sec) return json({ ok: false, error: 'The library gate is not configured (GATE_SECRET is not set in Vercel).' }, 503);
  let b;
  try {
    const t = await request.text();
    if (t.length > 5000) throw new Error('big');
    b = JSON.parse(t);
  } catch (e) { return json({ ok: false, error: 'Invalid request.' }, 400); }
  let payload;
  if (b && typeof b.ticket === 'string') {
    if (!TOKEN_RE.test(b.ticket)) return json({ ok: false, error: 'Invalid ticket.' }, 400);
    payload = { action: 'verifyTicket', ticket: b.ticket };
  } else if (b && typeof b.username === 'string' && typeof b.password === 'string' &&
             b.username && b.password && b.username.length <= 64 && b.password.length <= 200) {
    payload = { action: 'libraryLogin', username: b.username, password: b.password };
  } else {
    return json({ ok: false, error: 'Enter your username and password.' }, 400);
  }
  let d;
  try { d = await callApi(payload); }
  catch (e) { return json({ ok: false, error: e.message }, e.server ? 401 : 502); }
  const token = String(d.token || '');
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: 'The server reply was incomplete.' }, 502);
  const now = Date.now();
  let exp = Date.parse(d.expires || '');
  if (!(exp > now)) exp = now + DEFAULT_SESSION_MS;
  const value = await seal(sec, { t: token, e: exp, c: now });
  return json({ ok: true, member: d.member || null }, 200, setCookie(value, (exp - now) / 1000));
}

/* ---------- /_gate/logout : cabut session di server, terus hapus cookie-nya ---------- */
async function handleLogout(request, url, sec) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
  if (!sameOrigin(request, url)) return json({ ok: false, error: 'Request rejected.' }, 403);
  const p = sec ? await unseal(sec, readCookie(request, COOKIE)) : null;
  if (p && TOKEN_RE.test(String(p.t || ''))) {
    try { await callApi({ action: 'logout', token: p.t }); } catch (e) { /* gagal pun, cookie tetap dihapus */ }
  }
  return json({ ok: true }, 200, clearCookie());
}

/* ---------- /_gate/me : data member buat halaman (dipakai rc-gate.js) ---------- */
async function handleMe(request, sec) {
  if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed.' }, 405);
  if (!sec) return json({ ok: false, error: 'The library gate is not configured.' }, 503);
  const p = await unseal(sec, readCookie(request, COOKIE));
  const now = Date.now();
  if (!p || !TOKEN_RE.test(String(p.t || '')) || !(p.e > now)) {
    return json({ ok: false, error: 'Not signed in.' }, 401, readCookie(request, COOKIE) ? clearCookie() : '');
  }
  try {
    const d = await callApi({ action: 'libraryMe', token: p.t });
    const value = await seal(sec, { t: p.t, e: p.e, c: now });
    return json({ ok: true, member: d.member || null }, 200, setCookie(value, (p.e - now) / 1000));
  } catch (e) {
    return e.server ? json({ ok: false, error: e.message }, 401, clearCookie()) : json({ ok: false, error: e.message }, 502);
  }
}

/* ---------- pintu masuk utama ---------- */
export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const sec = secret();
    if (path === '/_gate/session') return await handleSession(request, url, sec);
    if (path === '/_gate/logout') return await handleLogout(request, url, sec);
    if (path === '/_gate/me') return await handleMe(request, sec);
    if (path === LOGIN_PATH || path === '/login') return pass();     // satu-satunya halaman yang public
    if (!sec) {
      return new Response('The library gate is not configured: GATE_SECRET is not set in Vercel.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }
    const r = await check(request, sec);
    return r.ok ? pass(r.cookie) : deny(request, url, r);
  } catch (e) {
    return new Response('Library gate error. Please try again in a moment.', {
      status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}
