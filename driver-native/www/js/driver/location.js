// RYDZ Driver - Location Services
// GPS tracking with native background support on iOS

var _watchId = null;
var _lastGPS = 0;
var _usingNativeLoc = false;

// Check if running in Capacitor native app with WKWebView bridge
function _hasNativeBridge() {
  return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.rydzLocation);
}

function requestLocationPermission() {
  if (!navigator.geolocation) {
    showLocationAlert('Your device does not support location services.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      console.log('Location permission granted');
      if (typeof showToast === 'function') showToast('Location enabled');
    },
    function(err) {
      if (err.code === 1) {
        showLocationAlert('Location access is required for the driver app to work. Please go to Settings > Privacy > Location Services and enable location for this app.');
      }
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
}

function showLocationAlert(msg) {
  var existing = document.getElementById('loc-alert-overlay');
  if (existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = 'loc-alert-overlay';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';

  var box = document.createElement('div');
  box.style.cssText = 'background:#132040;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;color:#fff;font-family:Poppins,sans-serif';

  box.innerHTML = '<div style="font-size:40px;margin-bottom:12px">📍</div>' +
    '<div style="font-size:18px;font-weight:600;margin-bottom:8px">Location Required</div>' +
    '<div style="font-size:14px;color:#8A96A8;line-height:1.5;margin-bottom:20px">' + msg + '</div>' +
    '<button onclick="this.closest(\'#loc-alert-overlay\').remove();requestLocationPermission()" style="width:100%;padding:14px;background:#1E90FF;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;font-family:Poppins,sans-serif;margin-bottom:8px">Try Again</button>' +
    '<button onclick="this.closest(\'#loc-alert-overlay\').remove()" style="width:100%;padding:12px;background:transparent;color:#8A96A8;border:none;border-radius:12px;font-size:14px;cursor:pointer;font-family:Poppins,sans-serif">Dismiss</button>';

  ov.appendChild(box);
  document.body.appendChild(ov);
}

function startGPS() {
  // Try native background location (iOS WKWebView bridge)
  if (_hasNativeBridge() && DID) {
    try {
      window.webkit.messageHandlers.rydzLocation.postMessage({ action: 'start', driverId: DID });
      _usingNativeLoc = true;
      console.log('[Location] Native background tracking started');
    } catch (err) {
      console.log('[Location] Native bridge failed:', err);
    }
  }

  // Always start web GPS too (for foreground UI updates)
  _startWebGPS();
}

function _startWebGPS() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast('Location services not available.');
    return;
  }
  if (_watchId !== null) return;

  navigator.geolocation.getCurrentPosition(
    function(firstPos) {
      var lat = firstPos.coords.latitude;
      var lng = firstPos.coords.longitude;
      var d = gD(); if (d) { d.lat = lat; d.lng = lng; sv(); }
      if (!_usingNativeLoc) {
        supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: lat, lng: lng });
      }

      _watchId = navigator.geolocation.watchPosition(function(pos) {
        var now = Date.now();
        if (now - _lastGPS < 10000) return;
        _lastGPS = now;
        var la = pos.coords.latitude;
        var ln = pos.coords.longitude;
        var dd = gD(); if (dd) { dd.lat = la; dd.lng = ln; sv(); }
        if (!_usingNativeLoc) {
          supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: la, lng: ln });
        }
      }, function(err) {
        console.log('Watch error:', err.message);
      }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    },
    function(err) {
      if (err.code === 1) {
        showLocationAlert('Location permission denied. Please enable Location Services in Settings for the Rydz Driver app.');
      } else {
        if (typeof showToast === 'function') showToast('Could not get your location. Please try again.');
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function stopGPS() {
  // Stop native background tracking
  if (_usingNativeLoc && _hasNativeBridge()) {
    try {
      window.webkit.messageHandlers.rydzLocation.postMessage({ action: 'stop' });
    } catch (e) { console.log('Stop native error:', e); }
    _usingNativeLoc = false;
  }

  // Stop web GPS
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }

  var d = gD();
  if (d) { d.lat = null; d.lng = null; }
  supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: null, lng: null });
}
