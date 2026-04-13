// RYDZ Rider - Post-Signup Onboarding Flow
// 3 screens shown only after a new account is created:
//   1) Enable Location  2) Enable Notifications  3) All set
// Each CTA triggers the real native permission prompt, then advances.
// Skip buttons still mark the user as onboarded so they don't see the
// flow again on next launch.

(function() {
  var TOTAL = 3;
  var current = 1;

  function _step(n) {
    current = n;
    for (var i = 1; i <= TOTAL; i++) {
      var el = document.getElementById('s-onb' + i);
      if (!el) continue;
      if (i === n) el.classList.add('on');
      else el.classList.remove('on');
    }
    var scr = document.getElementById('s-onb' + n);
    if (scr) {
      var animated = scr.querySelectorAll('[data-anim]');
      animated.forEach(function(a) {
        a.style.animation = 'none';
        void a.offsetWidth;
        a.style.animation = '';
      });
    }
    if (typeof cur !== 'undefined') cur = 'onb' + n;
  }

  function _markOnboarded() {
    try { localStorage.setItem('rydz-onboarded', '1'); } catch (e) {}
  }

  function onbStart() { _step(1); }
  function onbSkip() { _step(3); }

  function onbEnableLocation() {
    var btn = document.getElementById('onb-btn-loc');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    var advance = function() {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
      _step(2);
    };
    if (!navigator.geolocation) { advance(); return; }
    try {
      navigator.geolocation.getCurrentPosition(
        function() { advance(); },
        function() { advance(); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    } catch (e) { advance(); }
  }

  function onbEnableNotifications() {
    var btn = document.getElementById('onb-btn-push');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    var advance = function() {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
      _step(3);
    };
    // Web browsers: use the Notification API; if unsupported, just advance
    if (typeof Notification === 'undefined' || !Notification.requestPermission) {
      advance();
      return;
    }
    try {
      var maybe = Notification.requestPermission(function() { advance(); });
      if (maybe && typeof maybe.then === 'function') {
        maybe.then(advance, advance);
      }
    } catch (e) { advance(); }
  }

  function onbFinish() {
    _markOnboarded();
    if (typeof go === 'function') go('home');
  }

  window.onbStart = onbStart;
  window.onbSkip = onbSkip;
  window.onbEnableLocation = onbEnableLocation;
  window.onbEnableNotifications = onbEnableNotifications;
  window.onbFinish = onbFinish;
})();
