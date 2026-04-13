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
    // Use the app's go() helper so ALL other .scr elements (signup, etc.)
    // get their .on class removed and modals/tabbar are reset properly.
    if (typeof go === 'function') {
      go('onb' + n);
    } else {
      document.querySelectorAll('.scr').forEach(function(s) { s.classList.remove('on'); });
      var el = document.getElementById('s-onb' + n);
      if (el) el.classList.add('on');
    }
    // Reset animations on entry so they replay each visit
    var scr = document.getElementById('s-onb' + n);
    if (scr) {
      var animated = scr.querySelectorAll('[data-anim]');
      animated.forEach(function(a) {
        a.style.animation = 'none';
        void a.offsetWidth; // force reflow
        a.style.animation = '';
      });
    }
  }

  function _markOnboarded() {
    try { localStorage.setItem('rydz-onboarded', '1'); } catch (e) {}
  }

  // Entry point — called from auth.js after successful signup
  function onbStart() {
    _step(1);
  }

  // Skip = jump straight to the final confirmation screen
  function onbSkip() {
    _step(3);
  }

  // Screen 1 CTA — trigger iOS location prompt, then advance
  function onbEnableLocation() {
    var btn = document.getElementById('onb-btn-loc');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    var advance = function() {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
      _step(2);
    };

    if (!navigator.geolocation) { advance(); return; }
    // Single getCurrentPosition call triggers the iOS system prompt.
    // Whether user allows or denies, advance to screen 2.
    try {
      navigator.geolocation.getCurrentPosition(
        function() { advance(); },
        function() { advance(); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
      );
    } catch (e) { advance(); }
  }

  // Screen 2 CTA — trigger iOS push notification prompt, then advance
  function onbEnableNotifications() {
    var btn = document.getElementById('onb-btn-push');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }

    var advance = function() {
      if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
      _step(3);
    };

    var Push = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null;
    if (!Push) { advance(); return; }

    try {
      Push.checkPermissions().then(function(perm) {
        if (perm.receive === 'granted') {
          try { Push.register(); } catch (e) {}
          advance();
        } else {
          Push.requestPermissions().then(function(res) {
            if (res && res.receive === 'granted') {
              try { Push.register(); } catch (e) {}
            }
            advance();
          }).catch(advance);
        }
      }).catch(advance);
    } catch (e) { advance(); }
  }

  // Screen 3 CTA — finish and go home
  function onbFinish() {
    _markOnboarded();
    // Ensure push registration fires for granted users now that onboarding's done
    var Push = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null;
    if (Push) {
      try {
        Push.checkPermissions().then(function(perm) {
          if (perm.receive === 'granted') {
            try { Push.register(); } catch (e) {}
          }
        });
      } catch (e) {}
    }
    if (typeof go === 'function') go('home');
  }

  // Expose
  window.onbStart = onbStart;
  window.onbSkip = onbSkip;
  window.onbEnableLocation = onbEnableLocation;
  window.onbEnableNotifications = onbEnableNotifications;
  window.onbFinish = onbFinish;
})();
