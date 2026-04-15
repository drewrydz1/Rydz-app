// RYDZ Rider - Dispatch Engine v4 (MapKit-only)
//
// All routing goes through the native RydzMapKit Capacitor plugin. No
// Google Directions fallback — rider-native is iOS-only.
//
//   • POST-ACCEPT wait time reads `rides.driver_eta_secs` — the driver
//     iPhone publishes this on every GPS tick via MapKit (see
//     driver-native/www/js/driver/location.js::_publishMapKitETA).
//   • PRE-ACCEPT dispatch evaluates online drivers by calling MapKit
//     (MKDirections.calculateETA) via the plugin.
//   • No buffer / no Math.max floor on displayed ETAs. We report what the
//     routing engine says, rounded to the nearest minute.
//   • Wait-screen refresh tightened from 10s → 2s. MapKit is free, so
//     there's no reason to throttle.

var _etaCache = {};
var _etaInterval = null;
var _bestDriverId = null;

// Generation counter for ETA tick deduping. Every _runETA fire bumps this,
// and every async callback captures the value it started with. When the
// callback eventually lands, if the current seq has moved on, the result
// is stale and gets discarded — this prevents a slow pre-accept chain
// computation from painting over a newer post-accept number and creating
// the "doubled wait time that corrects itself" flicker.
var _etaSeq = 0;

// ---------------------------------------------------------------------------
// driveETA — "how many seconds from A→B" via native MapKit.
// Traffic-aware (MKDirections.Request.departureDate = now on the Swift side).
// Falls back to haversine only if the plugin is unavailable or errors out.
// ---------------------------------------------------------------------------
function _mkPlugin() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RydzMapKit) {
      return window.Capacitor.Plugins.RydzMapKit;
    }
  } catch (e) {}
  return null;
}

function driveETA(fLat, fLng, tLat, tLng) {
  return new Promise(function(resolve) {
    if (!fLat || !fLng || !tLat || !tLng) { resolve(600); return; }
    fLat = parseFloat(fLat); fLng = parseFloat(fLng);
    tLat = parseFloat(tLat); tLng = parseFloat(tLng);

    // Sub-100m shortcut — routing engines return garbage at this scale.
    var quickDist = _quickDistance(fLat, fLng, tLat, tLng);
    if (quickDist < 100) { resolve(30); return; }

    var mk = _mkPlugin();
    if (!mk) { resolve(_hvETA(fLat, fLng, tLat, tLng)); return; }

    mk.calculateETA({
      fromLat: fLat, fromLng: fLng, toLat: tLat, toLng: tLng
    }).then(function(res) {
      if (res && typeof res.seconds === 'number') resolve(res.seconds);
      else resolve(_hvETA(fLat, fLng, tLat, tLng));
    }).catch(function() {
      resolve(_hvETA(fLat, fLng, tLat, tLng));
    });
  });
}

function _quickDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Haversine last-resort: 25 km/h city streets × 1.4 road factor.
function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist / 6.9));
}

// ============================================================
// PRE-ACCEPT: Find best driver across all online drivers.
// Fan-out uses driveETA() which transparently uses MapKit on iOS.
// ============================================================
window.calcRealETA = function(puLat, puLng, callback) {
  if (!db || !db.users || !db.rides) { callback(0, null); return; }

  var allDrivers = db.users.filter(function(u) { return u.role === 'driver'; });
  var eligible = allDrivers.filter(function(d) { return d.status === 'online'; });
  if (!eligible.length) { callback(0, null); return; }

  var bestETA = null;
  var bestDriver = null;
  var pending = eligible.length;
  var done = false;

  // Safety timeout: don't wait forever on a slow network.
  var timer = setTimeout(function() {
    if (!done) {
      done = true;
      _bestDriverId = bestDriver;
      callback(bestETA !== null ? bestETA : 0, bestDriver);
    }
  }, 6000);

  eligible.forEach(function(drv) {
    if (done) return;
    calcDriverETA(drv, puLat, puLng, function(eta) {
      if (done) return;
      pending--;
      if (eta !== null && (bestETA === null || eta < bestETA)) {
        bestETA = eta;
        bestDriver = drv.id;
      }
      if (pending <= 0) {
        done = true;
        clearTimeout(timer);
        _bestDriverId = bestDriver;
        // No buffer, no floor — report what the routing engine said.
        callback(bestETA !== null ? bestETA : 0, bestDriver);
      }
    });
  });
};

// ============================================================
// Chain a single driver's timeline: current ride → queued → new pickup.
// Returns total minutes to reach newPu.
// ============================================================
function calcDriverETA(drv, newPuLat, newPuLng, callback) {
  var dlat = drv.lat ? parseFloat(drv.lat) : null;
  var dlng = drv.lng ? parseFloat(drv.lng) : null;
  if (!dlat || !dlng) { dlat = 26.1334; dlng = -81.7935; }

  var drvRides = db.rides.filter(function(ri) {
    if (typeof arId !== 'undefined' && ri.id === arId) return false;
    return ri.driverId === drv.id &&
      ['accepted', 'en_route', 'arrived', 'picked_up', 'requested'].indexOf(ri.status) >= 0;
  }).sort(function(a, b) {
    var aActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(a.status) >= 0 ? 0 : 1;
    var bActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(b.status) >= 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  if (!drvRides.length) {
    driveETA(dlat, dlng, newPuLat, newPuLng).then(function(secs) {
      callback(Math.max(1, Math.round(secs / 60)));
    });
    return;
  }

  var totalSecs = 0;
  var curLat = dlat;
  var curLng = dlng;
  var steps = [];

  drvRides.forEach(function(ri) {
    var puLat = parseFloat(ri.puX);
    var puLng = parseFloat(ri.puY);
    var doLat = parseFloat(ri.doX);
    var doLng = parseFloat(ri.doY);

    if (ri.status === 'picked_up') {
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    } else if (ri.status === 'arrived') {
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    } else if (ri.status === 'accepted' || ri.status === 'en_route') {
      if (puLat && puLng) steps.push({ lat: puLat, lng: puLng });
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    } else if (ri.status === 'requested') {
      if (puLat && puLng) steps.push({ lat: puLat, lng: puLng });
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    }
  });

  steps.push({ lat: parseFloat(newPuLat), lng: parseFloat(newPuLng) });

  var idx = 0;
  function next() {
    if (idx >= steps.length) {
      callback(Math.max(1, Math.round(totalSecs / 60)));
      return;
    }
    var s = steps[idx];
    driveETA(curLat, curLng, s.lat, s.lng).then(function(secs) {
      totalSecs += secs;
      curLat = s.lat;
      curLng = s.lng;
      idx++;
      next();
    });
  }
  next();
}

// ============================================================
// LIVE ETA UPDATES on the wait screen.
//
// POST-ACCEPT path: zero network — we read ride.driverEtaSecs which the
// driver iPhone is pushing to Supabase on every GPS tick (~1.5s).
//
// PRE-ACCEPT path: full dispatch recomputation via MapKit fan-out.
//
// Architecture: this function is also exposed on `window._runETA` so
// rideState.js can call it synchronously from updWait() whenever a
// realtime UPDATE lands. That makes post-accept paints event-driven
// with ~100-500ms latency instead of polling-gated at 1s.
// ============================================================
window.startETAUpdates = function() {
  if (_etaInterval) clearInterval(_etaInterval);

  function _runETA() {
    if (typeof arId === 'undefined' || !arId || !db) return;
    var ride = db.rides.find(function(ri) { return ri.id === arId; });
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return;

    // Bump seq and snapshot the state this tick is computing against.
    // Any async callback started below MUST compare its captured seq and
    // status against the live values before touching the DOM, so that
    // older in-flight work can't overwrite newer results. See comment on
    // _etaSeq at the top of this file.
    var mySeq = ++_etaSeq;
    var myStatus = ride.status;
    var myRideId = ride.id;

    function _stale() {
      if (mySeq !== _etaSeq) return true;
      if (!arId || arId !== myRideId) return true;
      var cur = db && db.rides ? db.rides.find(function(ri) { return ri.id === myRideId; }) : null;
      if (!cur || cur.status !== myStatus) return true;
      return false;
    }

    var mn = document.getElementById('w-mn');
    var st = document.getElementById('w-st');

    // ---- POST-ACCEPT: read pre-computed ETA from the ride row. ----
    if (ride.driverId && ride.status !== 'requested') {
      if (ride.status === 'arrived') {
        if (mn) mn.textContent = '0';
        if (st) st.textContent = 'Your driver is here!';
        return;
      }

      // Driver publishes driver_eta_secs every ~1.5s via MapKit and
      // realtime delivers within ~100-500ms. Anything older than 4s
      // (~2.5 missed publishes) means the driver app is backgrounded,
      // offline, or the publish loop stalled — time to compute locally.
      var secs = ride.driverEtaSecs;
      var updatedAt = ride.driverEtaUpdatedAt ? new Date(ride.driverEtaUpdatedAt).getTime() : 0;
      var stale = !updatedAt || (Date.now() - updatedAt > 4000);

      if (typeof secs === 'number' && !stale) {
        var mins = Math.max(0, Math.round(secs / 60));
        if (mn) mn.textContent = String(mins);
        if (st) {
          if (mins <= 0) {
            st.textContent = ride.status === 'picked_up' ? 'Arriving at destination' : 'Arriving now';
          } else {
            var etaStr = new Date(Date.now() + secs * 1000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit'
            });
            st.textContent = 'ETA ' + etaStr;
          }
        }
        return;
      }

      // Stale or missing — compute locally as a fallback. This also covers
      // the first second or two before the driver's first publish lands.
      var drv = db.users.find(function(u) { return u.id === ride.driverId; });
      if (drv && drv.lat && drv.lng) {
        var dlat = parseFloat(drv.lat);
        var dlng = parseFloat(drv.lng);
        var dest = (ride.status === 'picked_up')
          ? { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
          : { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };
        if (dest.lat && dest.lng) {
          driveETA(dlat, dlng, dest.lat, dest.lng).then(function(s2) {
            if (_stale()) return;
            var m2 = Math.max(0, Math.round(s2 / 60));
            if (mn) mn.textContent = String(m2);
            if (st) {
              var etaStr2 = new Date(Date.now() + s2 * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit'
              });
              st.textContent = 'ETA ' + etaStr2;
            }
          });
        }
      }
      return;
    }

    // ---- PRE-ACCEPT: waiting for a driver to claim this ride. ----
    if (ride.status === 'requested') {
      var puLat = parseFloat(ride.puX);
      var puLng = parseFloat(ride.puY);
      if (!puLat || !puLng) return;

      if (ride.driverId) {
        var assignedDrv = db.users.find(function(u) { return u.id === ride.driverId; });
        if (assignedDrv && assignedDrv.status === 'online') {
          calcDriverETA(assignedDrv, puLat, puLng, function(eta) {
            if (_stale()) return;
            if (!eta) { if (mn) mn.textContent = '--'; return; }
            if (mn) mn.textContent = String(eta);
            var etaStr = new Date(Date.now() + eta * 60000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit'
            });
            if (st) st.textContent = 'ETA ' + etaStr;
          });
          return;
        }
      }

      calcRealETA(puLat, puLng, function(eta) {
        if (_stale()) return;
        if (eta === 0 || eta === null) {
          if (mn) mn.textContent = '--';
          if (st) st.textContent = 'Waiting for available driver...';
          return;
        }
        if (mn) mn.textContent = String(eta);
        var etaStr = new Date(Date.now() + eta * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'ETA ' + etaStr;
      });
    }
  }

  // Expose _runETA so updWait() can drive it event-style on every
  // realtime UPDATE. The interval below is only a 1s safety net in case
  // realtime drops — in normal operation every paint is triggered by a
  // fresh WebSocket event from Supabase.
  window._runETA = _runETA;
  _runETA();
  _etaInterval = setInterval(_runETA, 1000);
};

// Called by updWait() when the ride status transitions. Bumping the seq
// synchronously discards any in-flight callback from a previous tick so
// a stale pre-accept chain result can't land on a post-accept screen.
window.invalidateETATick = function() { _etaSeq++; };

window.stopETAUpdates = function() {
  if (_etaInterval) { clearInterval(_etaInterval); _etaInterval = null; }
  window._etaStarted = false;
};

window.getBestDriverId = function() {
  return _bestDriverId;
};
