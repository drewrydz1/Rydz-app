// RYDZ Rider - Push Notifications
// Registers device with APNs via Capacitor, saves token to Supabase user row,
// listens for incoming pushes and taps.

(function() {
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.PushNotifications) {
    // Plugin not available (running in web preview). Skip silently.
    return;
  }

  var Push = window.Capacitor.Plugins.PushNotifications;
  var _registered = false;

  // Save token to the logged-in user's row in Supabase
  function savePushToken(token) {
    if (!token) return;
    try { localStorage.setItem('rydz-push-token', token); } catch (e) {}

    if (!window.curUser || !window.curUser.id) {
      // Not logged in yet. Token is cached in localStorage; will sync after login.
      return;
    }
    if (typeof supaFetch !== 'function') return;

    supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(curUser.id), {
      push_token: token,
      push_platform: 'ios'
    });
  }

  // Register handlers once, then request permission + register
  function initPush() {
    if (_registered) return;
    _registered = true;

    Push.addListener('registration', function(tokenData) {
      var token = tokenData && tokenData.value;
      if (!token) return;
      savePushToken(token);
    });

    Push.addListener('registrationError', function(err) {
      if (typeof logError === 'function') {
        logError('pushRegistration', err && err.error ? err.error : String(err));
      }
    });

    // Foreground push received
    Push.addListener('pushNotificationReceived', function(notif) {
      // Re-poll ride state so wait screen updates instantly
      if (typeof poll === 'function') { try { poll(); } catch (e) {} }
    });

    // User tapped a notification (foreground or background)
    Push.addListener('pushNotificationActionPerformed', function(action) {
      var data = action && action.notification && action.notification.data ? action.notification.data : {};
      // If ride-related, jump to wait screen
      if (data.rideId && typeof go === 'function') {
        window.arId = data.rideId;
        go('wait');
      }
    });

    // Check existing permission, request if needed, then register.
    // NOTE: we do NOT auto-prompt pre-onboarding. The post-signup onboarding
    // flow (onboarding.js) owns the first-time permission request. After the
    // user finishes onboarding ('rydz-onboarded' === '1'), this path silently
    // registers on subsequent launches.
    var onboarded = false;
    try { onboarded = localStorage.getItem('rydz-onboarded') === '1'; } catch (e) {}

    Push.checkPermissions().then(function(perm) {
      if (perm.receive === 'granted') {
        Push.register();
      } else if (onboarded && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
        Push.requestPermissions().then(function(res) {
          if (res.receive === 'granted') Push.register();
        });
      }
    });
  }

  // Flush cached token to Supabase once the user logs in
  function syncCachedToken() {
    if (!window.curUser || !window.curUser.id) return;
    var cached = null;
    try { cached = localStorage.getItem('rydz-push-token'); } catch (e) {}
    if (cached) savePushToken(cached);
  }

  // Expose so auth.js can call after login/signup
  window.syncPushToken = syncCachedToken;

  // Kick off registration after splash settles
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initPush, 1200);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initPush, 1200);
    });
  }
})();
