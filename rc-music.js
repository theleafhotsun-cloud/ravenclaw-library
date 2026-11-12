(function () {
  'use strict';
  var SRC = '/Harry%20Potter%20Ambient%20Music%20_%20Hogwarts%20_%20Relaxing%20Studying%20Sleeping_128k%20(1).m4a';
  var VOL = 0.45, KP = 'rc:music', KT = 'rc:mpos';
  var a = new Audio(), btn = null, home = false, inited = false, want = false, waiting = false, armed = false, held = false;
  var timer = 0, last = 0, anchor = { t: 0, at: 0 };
  a.loop = true; a.preload = 'auto'; a.src = SRC; a.volume = 0;

  function pref() { try { return localStorage.getItem(KP) !== 'off'; } catch (e) { return true; } }
  function setPref(v) { try { localStorage.setItem(KP, v ? 'on' : 'off'); } catch (e) {} }
  function saved() { try { var s = JSON.parse(sessionStorage.getItem(KT)); return s && isFinite(s.t) && isFinite(s.at) ? s : null; } catch (e) { return null; } }
  function pos() { return waiting ? anchor.t + (Date.now() - anchor.at) / 1000 : a.currentTime; }
  function store() { try { sessionStorage.setItem(KT, JSON.stringify({ t: pos(), at: Date.now() })); } catch (e) {} }
  function save() { if (want) store(); }

  function paint(v) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', v);
    if (btn.firstElementChild) btn.firstElementChild.className = 'fa-solid ' + (v ? 'fa-volume-high' : 'fa-volume-xmark');
    btn.classList.remove('attn');
  }
  function fade(to, ms) {
    clearInterval(timer);
    var from = a.volume, t0 = performance.now();
    timer = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = from + (to - from) * k;
      if (k === 1) { clearInterval(timer); if (!to) a.pause(); }
    }, 50);
  }
  function g(e) {
    if (btn && e.target && btn.contains(e.target)) return;
    disarm();
    if (want && pref()) attempt(900);
  }
  function arm() { if (armed) return; armed = true; ['pointerdown', 'keydown', 'touchstart'].forEach(function (n) { addEventListener(n, g, true); }); }
  function disarm() { armed = false; ['pointerdown', 'keydown', 'touchstart'].forEach(function (n) { removeEventListener(n, g, true); }); }
  function block() { waiting = true; paint(false); if (btn) btn.classList.add('attn'); arm(); }

  function attempt(ms) {
    var go = function () {
      var d = a.duration, t = anchor.t + (Date.now() - anchor.at) / 1000;
      if (d > 0 && isFinite(d) && Math.abs(a.currentTime - t % d) > 1.5) a.currentTime = t % d;
      a.volume = 0;
      var p = a.play();
      if (p && p.then) p.then(function () { waiting = false; paint(true); fade(VOL, ms); }, block);
    };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  }
  function begin(ms) {
    var s = saved(), t = 0;
    if (s) { var gap = (Date.now() - s.at) / 1000; t = s.t + (gap >= 0 && gap < 20 ? gap : 0); }
    anchor = { t: t, at: Date.now() };
    want = true;
    attempt(s ? 900 : ms);
  }
  function toggle() {
    if (want && !a.paused) { store(); want = false; setPref(false); paint(false); fade(0, 600); return; }
    setPref(true); begin(1200);
  }
  function init() {
    if (inited) return; inited = true;
    btn = document.getElementById('snd'); home = !!btn;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'rc-snd'; btn.title = 'Music on / off';
      btn.setAttribute('aria-label', 'Music'); btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', toggle);
    if (!home) { if (pref()) begin(2500); else paint(false); }
  }

  a.addEventListener('timeupdate', function () { var n = Date.now(); if (n - last > 1000) { last = n; save(); } });
  addEventListener('pagehide', save);
  addEventListener('pageshow', function (e) { if (e.persisted && want) begin(900); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { save(); if (want && !a.paused) { held = true; a.pause(); } }
    else if (held) { held = false; if (want) a.play().catch(function () {}); }
  });

  window.RCMusic = { toggle: toggle, enter: function () { init(); if (want && !a.paused) return; if (pref()) begin(3500); else paint(false); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
