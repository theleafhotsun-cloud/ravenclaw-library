(function () {
  'use strict';

  var HOME = 'https://ravenclaw-website.vercel.app/profile';   // halaman akun di situs utama
  var MKEY = 'rcl-member';                                      // salinan data member (sessionStorage, 5 menit)
  var MAX_AGE = 5 * 60 * 1000;

  window.RC_MEMBER = null;

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(MKEY) || 'null');
      if (c && c.at && Date.now() - c.at < MAX_AGE && c.member) return c.member;
    } catch (e) { /* cuekin aja */ }
    return null;
  }
  function writeCache(member) {
    try { sessionStorage.setItem(MKEY, JSON.stringify({ at: Date.now(), member: member })); } catch (e) { /* cuekin aja */ }
  }
  function clearCache() {
    try { sessionStorage.removeItem(MKEY); } catch (e) { /* cuekin aja */ }
  }
  function ready(member) {
    window.RC_MEMBER = member || null;
    function fire() {
      try { window.dispatchEvent(new CustomEvent('rc-gate-ok', { detail: { member: window.RC_MEMBER } })); } catch (e) { /* cuekin aja */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fire); else fire();
  }
  function toLogin() {
    clearCache();
    location.replace('/login.html?next=' + encodeURIComponent(location.pathname + location.search));
  }

  window.rcLogout = function () {
    clearCache();
    var done = function () { location.replace(HOME); };
    try {
      fetch('/_gate/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }).then(done, done);
    } catch (e) { done(); }
  };

  var cached = readCache();
  if (cached) { ready(cached); return; }

  fetch('/_gate/me', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
    .then(function (x) {
      if (x.j && x.j.ok) { writeCache(x.j.member || {}); ready(x.j.member || null); }
      else if (x.status === 401) toLogin();
      /* jaringan / server lagi bermasalah (502, 503): halaman ini udah dikirim server secara sah, biarin tetap kebuka */
    })
    .catch(function () { /* koneksi lagi error: biarin halaman tetap kebuka */ });
})();
