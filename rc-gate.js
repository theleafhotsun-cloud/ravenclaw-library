/* ===================== rc-gate.js : penjaga pintu situs LIBRARY =====================
   Dipasang di ravenclaw-library.vercel.app (BUKAN di situs utama).

   Pasang SATU baris ini sebagai skrip PERTAMA di <head> setiap halaman library (tanpa async/defer/type=module):
       <script src="/rc-gate.js"></script>
   Skrip ini menyembunyikan halaman sampai akun anggota terbukti sah, lalu:
     - ada #ticket=... di alamat  -> tukar tiket sekali pakai ke server (verifyTicket), simpan sesi library 24 jam
     - tidak ada tiket            -> periksa sesi yang tersimpan ke server (libraryMe)
     - gagal / belum masuk        -> halaman tetap tersembunyi, tampil pesan, lalu diarahkan ke halaman akun
   Setelah lolos: window.RC_MEMBER berisi data anggota, event "rc-gate-ok" dikirim, dan window.rcLogout() tersedia.

   ALAMAT SERVER tidak ditulis di file ini. Gerbang memuat api.js dari situs utama (SITE di bawah) lalu membaca
   window.RC_API. Untuk mengganti alamat server, ubah HANYA api.js di situs utama. Halaman tetap tersembunyi selama
   api.js dimuat; kalau api.js gagal dimuat, gerbang menolak dengan pesan (tidak ada alamat cadangan).

   PENTING (kejujuran soal keamanan): ini penjagaan DI SISI BROWSER. Cukup untuk membuat library hanya terbuka lewat
   akun, tetapi orang yang paham teknis masih bisa membaca isi file statis lewat "view source". Kalau isi library
   rahasia sungguhan, data/halamannya harus dilayani server hanya setelah token diperiksa (token sesi library dikirim
   ke aksi libraryMe di backend, atau diperiksa di middleware Vercel). */
(function () {
  'use strict';

  var SITE = 'https://ravenclaw-website.vercel.app';   // alamat SITUS UTAMA (tempat api.js dan halaman akun berada)
  var API_SRC = SITE + '/api.js';                       // satu-satunya sumber alamat server
  var HOME = SITE + '/profile';                         // halaman akun di situs utama
  var API = '';                                         // diisi dari window.RC_API setelah api.js dimuat
  var KEY = 'rcl-session';    // sesi library (localStorage)
  var OKKEY = 'rcl-ok';       // waktu pemeriksaan server terakhir yang lolos (sessionStorage)
  var RECHECK_MS = 5 * 60 * 1000; // sesi yang sudah dicek server dipercaya sekian lama (tidak cek di tiap halaman)
  var TIMEOUT_MS = 20000;

  /* 1. Sembunyikan segalanya secepat mungkin. */
  var css = document.createElement('style');
  css.id = 'rc-gate-css';
  css.textContent = 'html{visibility:hidden!important}#rc-gate-box{visibility:visible!important}';
  (document.head || document.documentElement).appendChild(css);

  /* ---------- penyimpanan yang tidak error di mode privat ---------- */
  function sget(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, v); } catch (e) { /* abaikan */ } }
  function sdel(store, k) { try { window[store].removeItem(k); } catch (e) { /* abaikan */ } }
  function readSession() {
    try {
      var s = JSON.parse(sget('localStorage', KEY) || 'null');
      if (!s || typeof s !== 'object' || !/^[0-9a-f]{64}$/.test(String(s.token || ''))) return null;
      if (s.expires && Date.parse(s.expires) < Date.now()) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSession() { sdel('localStorage', KEY); sdel('sessionStorage', OKKEY); }

  /* ---------- 2. Ambil tiket dari alamat lalu hapus dari riwayat ---------- */
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
    if (changed) { try { history.replaceState(null, '', location.pathname + search + hash); } catch (e) { /* abaikan */ } }
    try { found = decodeURIComponent(found); } catch (e) { found = ''; }
    return /^[0-9a-f]{64}$/.test(found) ? found : '';
  }

  /* ---------- server ---------- */
  function call(payload) {
    if (!API) { var ae = new Error('Alamat server belum dimuat.'); ae.net = true; return Promise.reject(ae); }
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
      try { j = JSON.parse(t); } catch (e) { var pe = new Error('Server membalas dengan format yang tidak dikenal.'); pe.net = true; throw pe; }
      if (!j || !j.ok) { var se = new Error((j && j.error) || 'Ditolak oleh server.'); se.server = true; throw se; }
      return j.data || {};
    }, function (e) {
      clearTimeout(timer);
      var ne = new Error(e && e.name === 'AbortError' ? 'Server terlalu lama menjawab.' : 'Tidak bisa menghubungi server.');
      ne.net = true;
      throw ne;
    });
  }

  /* ---------- tampilan ---------- */
  function box(title, text, buttons) {
    function build() {
      var old = document.getElementById('rc-gate-box');
      if (old) old.remove();
      var d = document.createElement('div');
      d.id = 'rc-gate-box';
      d.setAttribute('role', 'alertdialog');
      d.setAttribute('aria-modal', 'true');
      d.setAttribute('aria-labelledby', 'rc-gate-t');
      d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#03050c;color:#F5F0E9;font:500 16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center';
      var c = document.createElement('div');
      c.style.cssText = 'max-width:420px;width:100%;padding:28px 24px;border:1px solid rgba(224,198,143,.45);border-radius:16px;background:#0c1038;box-shadow:0 0 40px rgba(224,198,143,.12)';
      var h = document.createElement('h1');
      h.id = 'rc-gate-t';
      h.style.cssText = 'margin:0 0 10px;font:700 22px/1.25 Georgia,serif;letter-spacing:.04em;color:#E0C68F';
      h.textContent = title;
      var p = document.createElement('p');
      p.style.cssText = 'margin:0 0 18px;color:rgba(245,240,233,.8)';
      p.textContent = text;
      c.appendChild(h); c.appendChild(p);
      (buttons || []).forEach(function (b) {
        var a = document.createElement(b.href ? 'a' : 'button');
        if (b.href) a.href = b.href; else { a.type = 'button'; a.addEventListener('click', b.onClick); }
        a.textContent = b.label;
        a.style.cssText = 'display:inline-block;margin:4px;padding:12px 26px;border-radius:999px;border:1px solid #E0C68F;background:#E0C68F;color:#112250;font:700 12px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-decoration:none;cursor:pointer';
        c.appendChild(a);
      });
      d.appendChild(c);
      document.documentElement.appendChild(d);
      var first = d.querySelector('a,button');
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
    try { window.dispatchEvent(new CustomEvent('rc-gate-ok', { detail: { member: member || null } })); } catch (e) { /* abaikan */ }
  }

  function deny(title, text, keepSession) {
    if (!keepSession) clearSession();
    var buttons = [];
    if (keepSession) buttons.push({ label: 'Coba lagi', onClick: function () { location.reload(); } });
    if (HOME) buttons.push({ label: 'Buka halaman akun', href: HOME });
    box(title, text, buttons);
    if (HOME && !keepSession) setTimeout(function () { location.replace(HOME); }, 2500);
  }

  var NEED = 'Library hanya untuk anggota. Buka lewat halaman akun di situs Ravenclaw dengan menekan tombol "Enter the Library".';

  window.rcLogout = function () {
    var s = readSession();
    clearSession();
    var done = function () { if (HOME) location.replace(HOME); else location.reload(); };
    if (s) call({ action: 'logout', token: s.token }).then(done, done); else done();
  };

  /* ---------- 3. Alur utama ---------- */
  var ticket = takeTicket();

  function viaSession(prevError) {
    var s = readSession();
    if (!s) return deny('Masuk dulu', prevError || NEED, false);
    var ok = parseInt(sget('sessionStorage', OKKEY) || '0', 10);
    if (ok && Date.now() - ok < RECHECK_MS && s.member) return reveal(s.member);
    call({ action: 'libraryMe', token: s.token }).then(function (d) {
      sset('sessionStorage', OKKEY, String(Date.now()));
      s.member = d.member || s.member;
      sset('localStorage', KEY, JSON.stringify(s));
      reveal(s.member);
    }).catch(function (e) {
      if (e && e.server) deny('Sesi berakhir', 'Sesi library-mu sudah berakhir. Buka lagi lewat halaman akun.', false);
      else deny('Tidak bisa memeriksa akun', 'Koneksi ke server bermasalah, jadi akunmu belum bisa diperiksa. Periksa koneksi lalu coba lagi.', true);
    });
  }

  function start() {
    if (ticket) {
      call({ action: 'verifyTicket', ticket: ticket }).then(function (d) {
        if (!d.token || !/^[0-9a-f]{64}$/.test(String(d.token))) throw Object.assign(new Error('Balasan server tidak lengkap.'), { net: true });
        sset('localStorage', KEY, JSON.stringify({ token: d.token, expires: d.expires || '', member: d.member || null }));
        sset('sessionStorage', OKKEY, String(Date.now()));
        reveal(d.member || null);
      }).catch(function (e) {
        if (e && e.server) viaSession(e.message);       // tiket sudah terpakai/kedaluwarsa: mungkin masih punya sesi
        else deny('Tidak bisa memeriksa akun', 'Koneksi ke server bermasalah, jadi tiket masukmu belum bisa diperiksa. Buka library lagi lewat halaman akun.', false);
      });
    } else {
      viaSession('');
    }
  }

  /* Muat api.js dari situs utama. Selama ini berjalan halaman tetap tersembunyi. */
  function loadApi(done) {
    if (window.RC_API) { API = String(window.RC_API); return done(true); }   // halaman sudah memuat api.js sendiri
    var finished = false, timer = 0;
    function end(ok) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (ok) API = String(window.RC_API || '');
      done(!!API);
    }
    timer = setTimeout(function () { end(false); }, TIMEOUT_MS);
    var sc = document.createElement('script');
    sc.src = API_SRC;
    sc.onload = function () { end(true); };
    sc.onerror = function () { end(false); };
    (document.head || document.documentElement).appendChild(sc);
  }

  loadApi(function (ok) {
    if (ok) return start();
    if (ticket) deny('Tidak bisa memeriksa akun', 'Pengaturan server tidak bisa dimuat dari situs utama, jadi tiket masukmu belum bisa diperiksa. Buka library lagi lewat halaman akun.', false);
    else deny('Tidak bisa memeriksa akun', 'Pengaturan server tidak bisa dimuat dari situs utama, jadi akunmu belum bisa diperiksa. Periksa koneksi lalu coba lagi.', true);
  });
})();
