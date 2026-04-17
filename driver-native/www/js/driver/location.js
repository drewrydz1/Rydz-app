// RYDZ Driver - Location Services
// Native background GPS via RydzLocation Capacitor plugin.
// Falls back to web watchPosition when the plugin is unavailable.

var _watchId = null;
var _lastGPS = 0;
var _nativeLocActive = false;

function _distMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function(d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

var PICKUP_NEARBY_METERS = 152;

// ---------------------------------------------------------------------------
// MapKit ETA publisher — only used in web-GPS fallback mode.
// When the native RydzLocation plugin is active it publishes ETA from
// Swift (with requestsAlternateRoutes + fastest-route selection), so the
// JS path below never fires. Kept only for the non-native fallback.
// ---------------------------------------------------------------------------
var _lastETAPublish = 0;
var ETA_PUBLISH_MIN_MS = 1500;

function _publishMapKitETA(fromLat, fromLng) {
  try {
    if (_nativeLocActive) return;
    var now = Date.now();
    if (now - _lastETAPublish < ETA_PUBLISH_MIN_MS) return;

    if (typeof gMR !== 'function') return;
    var mr = gMR();
    if (!mr || !mr.id) return;

    var st = mr.status;
    if (!st || st === 'completed' || st === 'canceled' || st === 'cancelled') return;

    var toLat, toLng;
    if (st === 'picked_up' || st === 'in_progress') {
      toLat = parseFloat(mr.doX); toLng = parseFloat(mr.doY);
    } else if (st === 'arrived') {
      _lastETAPublish = now;
      try {
        supaFetch('PATCH', 'rides', '?id=eq.' + encodeURIComponent(mr.id), {
          driver_eta_secs: 0,
          driver_eta_updated_at: new Date().toISOString()
        });
      } catch (e) {}
      return;
    } else {
      toLat = parseFloat(mr.puX); toLng = parseFloat(mr.puY);
    }
    if (!toLat || !toLng) return;

    if (!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RydzMapKit)) return;

    _lastETAPublish = now;
    window.Capacitor.Plugins.RydzMapKit.calculateETA({
      fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng
    }).then(function(res) {
      if (!res || typeof res.seconds !== 'number') return;
      var secs = Math.max(0, Math.round(res.seconds));
      try {
        console.log('[MapKit] publish: from=(' + fromLat.toFixed(5) + ',' +
          fromLng.toFixed(5) + ') to=(' + toLat.toFixed(5) + ',' +
          toLng.toFixed(5) + ') = ' + secs + 's (' + Math.round(secs/60) +
          ' min), status=' + st);
      } catch (e) {}
      try {
        supaFetch('PATCH', 'rides', '?id=eq.' + encodeURIComponent(mr.id), {
          driver_eta_secs: secs,
          driver_eta_updated_at: new Date().toISOString()
        });
      } catch (e) {}
    }).catch(function(err) {
      console.log('[MapKit] ETA calc failed:', err && err.message);
    });
  } catch (e) { console.log('[publishETA] error:', e); }
}

function _checkPickupGeofence(lat, lng) {
  try {
    if (_nativeLocActive) return;
    if (typeof gMR !== 'function') return;
    var mr = gMR();
    if (!mr || mr.status !== 'accepted') return;
    var puLat = parseFloat(mr.puX), puLng = parseFloat(mr.puY);
    if (!puLat || !puLng) return;

    var already = localStorage.getItem('rydz-nearby-' + mr.id);
    if (already === '1') return;

    var d = _distMeters(lat, lng, puLat, puLng);
    if (d <= PICKUP_NEARBY_METERS) {
      localStorage.setItem('rydz-nearby-' + mr.id, '1');
      mr.status = 'arrived';
      if (typeof sv === 'function') { try { sv(); } catch (e) {} }
      if (typeof supaUpdateRide === 'function') {
        try { supaUpdateRide(mr.id, { status: 'arrived' }); } catch (e) {}
      }
      if (typeof ren === 'function') { try { ren(); } catch (e) {} }
    }
  } catch (e) { console.log('[geofence] error:', e); }
}

// ---------------------------------------------------------------------------
// Sync current ride state to the native plugin so it can publish the
// correct MapKit ETA from Swift even when the app is backgrounded.
// Called on every native GPS tick and on ride state transitions.
// ---------------------------------------------------------------------------
function _syncRideToPlugin() {
  var plugin = window.Capacitor && window.Capacitor.Plugins &&
               window.Capacitor.Plugins.RydzLocation;
  if (!plugin) return;
  try {
    var mr = (typeof gMR === 'function') ? gMR() : null;

    var pending = (typeof gIn === 'function') ? gIn() : [];
    if (!pending.length && db && db.rides) {
      var drafts = db.rides.filter(function(r) {
        return r.status === 'draft' && r.driverId === DID;
      });
      if (drafts.length) pending = drafts;
    }

    if (mr && mr.id) {
      plugin.setRide({
        rideId: mr.id,
        status: mr.status || 'accepted',
        puLat: parseFloat(mr.puX) || 0,
        puLng: parseFloat(mr.puY) || 0,
        doLat: parseFloat(mr.doX) || 0,
        doLng: parseFloat(mr.doY) || 0
      });
      if (pending.length > 0) {
        var p = pending[0];
        plugin.setPendingRide({
          rideId: p.id,
          puLat: parseFloat(p.puX) || 0,
          puLng: parseFloat(p.puY) || 0
        });
      } else {
        plugin.clearPendingRide();
      }
    } else if (pending.length > 0) {
      var p = pending[0];
      plugin.setRide({
        rideId: p.id,
        status: 'pending',
        puLat: parseFloat(p.puX) || 0,
        puLng: parseFloat(p.puY) || 0,
        doLat: parseFloat(p.doX) || 0,
        doLng: parseFloat(p.doY) || 0
      });
      plugin.clearPendingRide();
    } else {
      plugin.clearRide();
      plugin.clearPendingRide();
    }
  } catch (e) {}
}
window.syncRideToLocationPlugin = _syncRideToPlugin;

// ---------------------------------------------------------------------------
// Permission prompt UI
// ---------------------------------------------------------------------------
function requestLocationPermission() {
  if (!navigator.geolocation) {
    showLocationAlert('Your device does not support location services.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function() {
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

  box.innerHTML = '<div style="font-size:40px;margin-bottom:12px">\uD83D\uDCCD</div>' +
    '<div style="font-size:18px;font-weight:600;margin-bottom:8px">Location Required</div>' +
    '<div style="font-size:14px;color:#8A96A8;line-height:1.5;margin-bottom:20px">' + msg + '</div>' +
    '<button onclick="this.closest(\'#loc-alert-overlay\').remove();requestLocationPermission()" style="width:100%;padding:14px;background:#1E90FF;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;font-family:Poppins,sans-serif;margin-bottom:8px">Try Again</button>' +
    '<button onclick="this.closest(\'#loc-alert-overlay\').remove()" style="width:100%;padding:12px;background:transparent;color:#8A96A8;border:none;border-radius:12px;font-size:14px;cursor:pointer;font-family:Poppins,sans-serif">Dismiss</button>';

  ov.appendChild(box);
  document.body.appendChild(ov);
}

// ---------------------------------------------------------------------------
// Start GPS — prefer native plugin, fall back to web watchPosition
// ---------------------------------------------------------------------------
function startGPS() {
  var plugin = window.Capacitor && window.Capacitor.Plugins &&
               window.Capacitor.Plugins.RydzLocation;

  if (plugin && DID) {
    try {
      plugin.start({
        driverId: DID,
        supaUrl: SUPA_URL,
        supaKey: SUPA_KEY
      });
      _nativeLocActive = true;

      plugin.addListener('locationUpdate', function(data) {
        if (!data) return;
        var d = (typeof gD === 'function') ? gD() : null;
        if (d) { d.lat = data.lat; d.lng = data.lng; if (typeof sv === 'function') sv(); }
        _syncRideToPlugin();
      });

      plugin.addListener('geofenceTriggered', function(data) {
        if (!data || !data.rideId) return;
        var mr = (typeof gMR === 'function') ? gMR() : null;
        if (mr && mr.id === data.rideId) {
          mr.status = 'arrived';
          localStorage.setItem('rydz-nearby-' + mr.id, '1');
          if (typeof sv === 'function') sv();
          if (typeof ren === 'function') ren();
        }
      });

      plugin.addListener('permissionDenied', function() {
        showLocationAlert('Location permission denied. Please enable Location Services in Settings for the Rydz Driver app.');
      });

      console.log('[Location] Native background tracking started');
      _syncRideToPlugin();
      return;
    } catch (err) {
      console.log('[Location] Native plugin start failed:', err);
      _nativeLocActive = false;
    }
  }

  _startWebGPS();
}

// ---------------------------------------------------------------------------
// Web GPS fallback — foreground only, iOS will throttle in background
// ---------------------------------------------------------------------------
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
      supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: lat, lng: lng });
      _checkPickupGeofence(lat, lng);
      _publishMapKitETA(lat, lng);

      _watchId = navigator.geolocation.watchPosition(function(pos) {
        var now = Date.now();
        if (now - _lastGPS < 1500) return;
        _lastGPS = now;
        var la = pos.coords.latitude;
        var ln = pos.coords.longitude;
        var dd = gD(); if (dd) { dd.lat = la; dd.lng = ln; sv(); }
        supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: la, lng: ln });
        _checkPickupGeofence(la, ln);
        _publishMapKitETA(la, ln);
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

// ---------------------------------------------------------------------------
// Stop GPS — both native and web
// ---------------------------------------------------------------------------
function stopGPS() {
  if (_nativeLocActive) {
    var plugin = window.Capacitor && window.Capacitor.Plugins &&
                 window.Capacitor.Plugins.RydzLocation;
    if (plugin) {
      try { plugin.stop(); } catch (e) {}
      try { plugin.removeAllListeners(); } catch (e) {}
    }
    _nativeLocActive = false;
  }

  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }

  var d = (typeof gD === 'function') ? gD() : null;
  if (d) { d.lat = null; d.lng = null; }
  supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: null, lng: null });
}
