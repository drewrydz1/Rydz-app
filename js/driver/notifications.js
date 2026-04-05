// RYDZ Driver - Ride Notifications
// In-app banner + native notification for pending rides
// Re-notifies every 30 seconds until ride is accepted

var _notifInterval = null;
var _notifVisible = false;
var _lastNotifCount = 0;

// Create the notification banner element (once)
function _createNotifBanner() {
  if (document.getElementById('ride-notif')) return;
  var el = document.createElement('div');
  el.id = 'ride-notif';
  el.style.cssText = 'position:fixed;top:-120px;left:12px;right:12px;z-index:99999;' +
    'background:#fff;border-radius:16px;padding:14px 16px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08);' +
    'display:flex;align-items:center;gap:12px;' +
    'transition:top 0.35s cubic-bezier(0.22,0.68,0.36,1);' +
    'cursor:pointer;-webkit-tap-highlight-color:transparent';
  el.onclick = function() { _hideNotif(); };
  el.innerHTML =
    '<div style="width:42px;height:42px;border-radius:10px;background:#0a1628;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<img src="' + (typeof LOGO_SM !== 'undefined' ? LOGO_SM : '') + '" style="height:22px;object-fit:contain">' +
    '</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:13px;font-weight:800;color:#1d1d1f;font-family:Poppins,sans-serif">Rydz Driver</span>' +
        '<span style="font-size:11px;color:#8e9196;font-family:Nunito,sans-serif">now</span>' +
      '</div>' +
      '<p id="ride-notif-msg" style="font-size:13px;color:#48494d;margin-top:2px;font-family:Poppins,sans-serif;line-height:1.3">You have a pending ride request!</p>' +
    '</div>';
  document.body.appendChild(el);
}

// Show the banner
function _showNotif(msg) {
  _createNotifBanner();
  var el = document.getElementById('ride-notif');
  var msgEl = document.getElementById('ride-notif-msg');
  if (msgEl && msg) msgEl.textContent = msg;

  // Position below safe area
  var safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 50;
  el.style.top = (safeTop + 8) + 'px';
  _notifVisible = true;

  // Vibrate if supported
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  // Auto-hide after 5 seconds
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(_hideNotif, 5000);
}

// Hide the banner
function _hideNotif() {
  var el = document.getElementById('ride-notif');
  if (el) {
    el.style.top = '-120px';
    _notifVisible = false;
  }
}

// Check for pending rides and notify
function _checkPendingRides() {
  if (typeof gIn !== 'function') return;
  var pending = gIn();
  var count = pending.length;

  if (count > 0) {
    var msg = count === 1
      ? 'You have a pending ride request!'
      : 'You have ' + count + ' pending ride requests!';
    _showNotif(msg);
    _requestNativeNotif(msg);
  } else {
    // No pending rides — stop notifications
    _stopRideNotif();
    _hideNotif();
  }
}

// Start the 30-second notification loop
function _startRideNotif() {
  if (_notifInterval) return; // already running
  _checkPendingRides(); // fire immediately
  _notifInterval = setInterval(_checkPendingRides, 30000);
}

// Stop the notification loop
function _stopRideNotif() {
  if (_notifInterval) {
    clearInterval(_notifInterval);
    _notifInterval = null;
  }
  _lastNotifCount = 0;
}

// Native notification (works when app is in background on supported devices)
function _requestNativeNotif(msg) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification('Rydz Driver', { body: msg, icon: typeof LOGO_SM !== 'undefined' ? LOGO_SM : '', tag: 'rydz-pending', renotify: true });
    } catch (e) { /* Native notifications may not work in all WebViews */ }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// Hook into the existing render cycle to detect ride changes
var _origRen = typeof ren === 'function' ? ren : null;

function _patchRenForNotifs() {
  if (!_origRen || ren._notifPatched) return;
  var baseRen = ren;
  ren = function() {
    baseRen();
    // After render, check if we have pending rides
    var pending = (typeof gIn === 'function') ? gIn() : [];
    var active = (typeof gMR === 'function') ? gMR() : null;
    var isOnline = localStorage.getItem('rydz-drv-online') === 'true';

    if (isOnline && pending.length > 0 && !active) {
      // Has pending rides and no active ride — start notifying
      if (!_notifInterval) _startRideNotif();
    } else {
      // No pending rides or has active ride — stop
      if (_notifInterval) {
        _stopRideNotif();
        _hideNotif();
      }
    }
  };
  ren._notifPatched = true;
}

// Initialize on load
(function() {
  // Request notification permission early
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  // Patch ren() after a short delay to ensure it's defined
  setTimeout(_patchRenForNotifs, 1000);
})();
