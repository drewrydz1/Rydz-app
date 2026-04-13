// RYDZ Driver - Notifications
// 1. Remote push registration (APNs token → Supabase users.push_token)
// 2. Local notification nag loop: fires every 10 sec while driver has
//    pending incoming rides. Stops when rides are accepted/declined/gone
//    or driver goes offline.

(function() {
  var hasCapacitor = !!(window.Capacitor && window.Capacitor.Plugins);
  var Push = hasCapacitor ? window.Capacitor.Plugins.PushNotifications : null;
  var Local = hasCapacitor ? window.Capacitor.Plugins.LocalNotifications : null;
  var Haptics = hasCapacitor ? window.Capacitor.Plugins.Haptics : null;

  var _pushRegistered = false;
  var _nagInterval = null;
  var _nagCount = 0;
  var _lastPendingIds = "";

  // ============================================================
  // PUSH TOKEN - register with APNs, save to Supabase
  // ============================================================
  function savePushToken(token) {
    if (!token) return;
    try { localStorage.setItem('rydz-push-token', token); } catch (e) {}

    var did = (typeof DID !== 'undefined' && DID) ? DID : null;
    if (!did) return;
    if (typeof supaFetch !== 'function') return;

    supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(did), {
      push_token: token,
      push_platform: 'ios'
    });
  }

  function initPush() {
    if (!Push || _pushRegistered) return;
    _pushRegistered = true;

    Push.addListener('registration', function(tokenData) {
      if (tokenData && tokenData.value) savePushToken(tokenData.value);
    });

    Push.addListener('registrationError', function(err) {
      if (typeof logError === 'function') {
        logError('driverPushRegistration', err && err.error ? err.error : String(err));
      }
    });

    Push.addListener('pushNotificationReceived', function() {
      // Force poll so UI updates immediately when push arrives
      if (typeof poll === 'function') { try { poll(); } catch (e) {} }
    });

    Push.addListener('pushNotificationActionPerformed', function(action) {
      var data = action && action.notification && action.notification.data ? action.notification.data : {};
      // Tapping the push should bring driver to main dashboard
      if (typeof go === 'function') go('main');
      if (typeof ren === 'function') { try { ren(); } catch (e) {} }
    });

    Push.checkPermissions().then(function(perm) {
      if (perm.receive === 'granted') {
        Push.register();
      } else if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        Push.requestPermissions().then(function(res) {
          if (res.receive === 'granted') Push.register();
        });
      }
    });

    // Also request Local Notifications permission (separate from push)
    if (Local) {
      Local.checkPermissions().then(function(p) {
        if (p.display !== 'granted') Local.requestPermissions();
      });
    }
  }

  function syncCachedToken() {
    var did = (typeof DID !== 'undefined' && DID) ? DID : null;
    if (!did) return;
    var cached = null;
    try { cached = localStorage.getItem('rydz-push-token'); } catch (e) {}
    if (cached) savePushToken(cached);
  }

  // ============================================================
  // NAG LOOP - local notifications every 10 sec while pending rides exist
  // ============================================================
  function _getPendingRides() {
    if (typeof gIn === 'function') {
      try { return gIn() || []; } catch (e) { return []; }
    }
    return [];
  }

  function _isOnline() {
    try { return localStorage.getItem('rydz-drv-online') === 'true'; } catch (e) { return false; }
  }

  // Fire a single local notification + haptic + vibrate
  function _fireNag(pending) {
    _nagCount++;
    var count = pending.length;
    var title = count === 1 ? 'New ride request' : count + ' ride requests waiting';
    var body = count === 1
      ? 'Tap to view and accept'
      : 'Tap to see pending requests';

    // Haptic buzz (works in foreground even without local notif)
    if (Haptics && Haptics.vibrate) {
      try { Haptics.vibrate({ duration: 400 }); } catch (e) {}
    }

    // Local notification - lockscreen, background, everywhere
    if (Local && Local.schedule) {
      var nid = 9000 + (_nagCount % 100);
      try {
        Local.schedule({
          notifications: [{
            id: nid,
            title: title,
            body: body,
            sound: 'default',
            schedule: { at: new Date(Date.now() + 100) },
            extra: { type: 'nag', rideId: pending[0] && pending[0].id }
          }]
        });
      } catch (e) {}
    }
  }

  function _checkAndNag() {
    // Stop if driver logged out or went offline
    var did = (typeof DID !== 'undefined' && DID) ? DID : null;
    if (!did || !_isOnline()) {
      stopNagLoop();
      return;
    }

    // Stop if driver has active ride (they're busy with it)
    if (typeof gMR === 'function') {
      try { if (gMR()) { stopNagLoop(); return; } } catch (e) {}
    }

    var pending = _getPendingRides();
    if (!pending.length) {
      stopNagLoop();
      return;
    }

    // Only nag for NEW pending rides (not ones already shown to driver)
    var ids = pending.map(function(r) { return r.id; }).sort().join(',');
    _lastPendingIds = ids;

    _fireNag(pending);
  }

  function startNagLoop() {
    if (_nagInterval) return;
    _checkAndNag(); // Fire once immediately
    _nagInterval = setInterval(_checkAndNag, 10000);
  }

  function stopNagLoop() {
    if (_nagInterval) { clearInterval(_nagInterval); _nagInterval = null; }
    _lastPendingIds = "";
    // Cancel any scheduled nag notifications
    if (Local && Local.cancel) {
      try {
        var toCancel = [];
        for (var i = 0; i < 100; i++) toCancel.push({ id: 9000 + i });
        Local.cancel({ notifications: toCancel });
      } catch (e) {}
    }
  }

  // Called by the main poll loop whenever data refreshes
  function checkPendingRides() {
    var did = (typeof DID !== 'undefined' && DID) ? DID : null;
    if (!did || !_isOnline()) { stopNagLoop(); return; }

    // Don't nag if driver is on an active ride
    if (typeof gMR === 'function') {
      try { if (gMR()) { stopNagLoop(); return; } } catch (e) {}
    }

    var pending = _getPendingRides();
    if (pending.length > 0) {
      startNagLoop();
    } else {
      stopNagLoop();
    }
  }

  // Expose API to the rest of the driver app
  window.syncPushToken = syncCachedToken;
  window.startNagLoop = startNagLoop;
  window.stopNagLoop = stopNagLoop;
  window.checkPendingRides = checkPendingRides;

  // Boot push registration after splash
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initPush, 1200);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initPush, 1200);
    });
  }
})();
