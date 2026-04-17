// RYDZ Rider - Dispatch Engine v8 (Driver MapKit via Supabase)
//
// Zero Google API calls. All ETAs come from the DRIVER's native MapKit
// published to Supabase. Works on iOS + Android since MapKit runs on
// the driver's phone, not the rider's.
//
// FINDING SCREEN:
//   Creates a 'draft' ride in Supabase — driver's Swift plugin computes
//   real chain-walked MapKit ETA but the ride is invisible to the
//   driver's queue. Once driver publishes ETA, show it on confirm.
//
// CONFIRM SCREEN:
//   Live-reads driver's MapKit ETA from the draft ride every 3s.
//   Ride stays 'draft' until rider taps "Request Ride".
//
// WAIT SCREEN:
//   Ride is now 'requested'. Driver's MapKit ETA flows in real-time
//   via rides.driver_eta_secs (~1.5s updates).

var _etaInterval = null;
var _confirmETAInterval = null;
var _bestDriverId = null;
var _etaSeq = 0;

var DRIVER_ETA_STALE_MS = 12000;

function _quickDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Last-resort fallback only — used on wait screen if driver MapKit stale >12s.
function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist * 1.3 / 9.7));
}

function _nearestOnlineDriver(puLat, puLng) {
  if (!db || !db.users) return { id: null };
  var best = null;
  var bestDist = Infinity;
  for (var i = 0; i < db.users.length; i++) {
    var u = db.users[i];
    if (u.role !== 'driver' || u.status !== 'online') continue;
    var lat = parseFloat(u.lat), lng = parseFloat(u.lng);
    if (!lat || !lng) continue;
    var d = _quickDistance(lat, lng, puLat, puLng);
    if (d < bestDist) { bestDist = d; best = u; }
  }
  if (!best) return { id: null };
  return { id: best.id };
}

// ===========================================================================
// FINDING SCREEN: create draft ride, wait for driver's real MapKit ETA.
// ===========================================================================
window.calcRealETA = function(puLat, puLng, callback) {
  puLat = parseFloat(puLat); puLng = parseFloat(puLng);
  if (!puLat || !puLng) { callback(0, null); return; }

  var nearest = _nearestOnlineDriver(puLat, puLng);
  if (!nearest.id) { _bestDriverId = null; callback(0, null); return; }
  _bestDriverId = nearest.id;

  var rideId = 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  var riderId = (typeof curUser !== 'undefined' && curUser) ? curUser.id : null;

  var localRide = {
    id: rideId, riderId: riderId, driverId: nearest.id,
    pickup: (typeof puSel !== 'undefined' && puSel) ? (puSel.n || puSel.a || 'Pickup') : 'Pickup',
    dropoff: (typeof doSel !== 'undefined' && doSel) ? (doSel.n || doSel.a || 'Dropoff') : 'Dropoff',
    puX: puLat, puY: puLng,
    doX: parseFloat((typeof doSel !== 'undefined' && doSel) ? (doSel.lat || doSel.x || 0) : 0),
    doY: parseFloat((typeof doSel !== 'undefined' && doSel) ? (doSel.lng || doSel.y || 0) : 0),
    passengers: (typeof pass !== 'undefined') ? pass : 1,
    status: 'draft',
    phone: (typeof curUser !== 'undefined' && curUser) ? (curUser.phone || null) : null,
    note: (document.getElementById('f-note') || {}).value || '',
    driverEtaSecs: null, driverEtaUpdatedAt: null,
    createdAt: Date.now(), completedAt: null
  };

  if (db && db.rides) db.rides.push(localRide);
  arId = rideId;
  try { localStorage.setItem('rydz-active-ride', rideId); } catch (e) {}

  fetch(SUPA_URL + '/rest/v1/rides', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      id: rideId, rider_id: riderId, driver_id: nearest.id,
      pickup: localRide.pickup, dropoff: localRide.dropoff,
      pu_x: puLat, pu_y: puLng,
      do_x: localRide.doX, do_y: localRide.doY,
      passengers: localRide.passengers, status: 'draft',
      phone: localRide.phone, note: localRide.note,
      created_at: new Date(localRide.createdAt).toISOString()
    })
  }).catch(function(e) { if (typeof logError === 'function') logError('calcRealETA', e); });

  if (typeof ensureRealtimeForActiveRide === 'function') ensureRealtimeForActiveRide();

  var attempts = 0;
  var maxAttempts = 16;
  var pollTimer = setInterval(function() {
    attempts++;
    var r = db && db.rides ? db.rides.find(function(x) { return x.id === rideId; }) : null;
    if (r && typeof r.driverEtaSecs === 'number' && r.driverEtaSecs > 0) {
      clearInterval(pollTimer);
      callback(Math.max(1, Math.round(r.driverEtaSecs / 60)), nearest.id);
      return;
    }
    if (attempts >= maxAttempts) {
      clearInterval(pollTimer);
      callback(-1, nearest.id);
    }
  }, 500);
};

// ===========================================================================
// Cancel draft ride (user went back from confirm screen).
// ===========================================================================
window.cancelDispatchRide = function() {
  if (!arId) return;
  var rideId = arId;
  var i = db && db.rides ? db.rides.findIndex(function(r) { return r.id === rideId; }) : -1;
  if (i >= 0) {
    db.rides[i].status = 'cancelled';
    if (typeof supaUpdateRide === 'function') supaUpdateRide(rideId, { status: 'cancelled' });
  }
  if (typeof stopETAUpdates === 'function') stopETAUpdates();
  _stopConfirmETA();
  if (typeof unsubscribeAll === 'function') unsubscribeAll();
  try { localStorage.removeItem('rydz-active-ride'); } catch (e) {}
  arId = null;
  window._rideETA = null;
  window._bestDriverId = null;
  window._waitMapDrawn = false;
  window._etaStarted = false;
};

// ===========================================================================
// CONFIRM SCREEN: live-read driver's MapKit ETA from the draft ride.
// ===========================================================================
window.startConfirmETAUpdates = function() {
  _stopConfirmETA();

  function _tick() {
    if (cur !== 'confirm' || !arId || !db) return;
    var ride = db.rides ? db.rides.find(function(r) { return r.id === arId; }) : null;
    if (!ride) return;

    if (typeof ride.driverEtaSecs === 'number' && ride.driverEtaSecs > 0) {
      var age = ride.driverEtaUpdatedAt
        ? Date.now() - new Date(ride.driverEtaUpdatedAt).getTime()
        : Infinity;
      if (age < DRIVER_ETA_STALE_MS) {
        var mins = Math.max(1, Math.round(ride.driverEtaSecs / 60));
        window._rideETA = mins;
        var mn = document.getElementById('c-min');
        var eta = document.getElementById('c-eta');
        if (mn) mn.textContent = mins + ' min';
        if (eta) {
          var t = new Date(Date.now() + ride.driverEtaSecs * 1000);
          eta.textContent = 'Estimated pickup: ' + t.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit'
          });
        }
        var btn = document.getElementById('c-btn');
        if (btn) btn.disabled = false;
      }
    }
  }

  _tick();
  _confirmETAInterval = setInterval(_tick, 3000);
};

function _stopConfirmETA() {
  if (_confirmETAInterval) { clearInterval(_confirmETAInterval); _confirmETAInterval = null; }
}
window.stopConfirmETAUpdates = _stopConfirmETA;

// ===========================================================================
// WAIT SCREEN: live ETA from driver's MapKit via rides.driver_eta_secs.
// ===========================================================================
window.startETAUpdates = function() {
  if (_etaInterval) clearInterval(_etaInterval);

  function _runETA() {
    if (typeof arId === 'undefined' || !arId || !db) return;
    var ride = db.rides.find(function(ri) { return ri.id === arId; });
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return;

    var mySeq = ++_etaSeq;
    var myRideId = ride.id;

    var mn = document.getElementById('w-mn');
    var st = document.getElementById('w-st');

    function _paintEta(secs) {
      if (mySeq !== _etaSeq) return;
      if (!arId || arId !== myRideId) return;
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
    }

    function _driverEtaFresh() {
      if (typeof ride.driverEtaSecs !== 'number') return false;
      var age = ride.driverEtaUpdatedAt
        ? Date.now() - new Date(ride.driverEtaUpdatedAt).getTime()
        : Infinity;
      return age < DRIVER_ETA_STALE_MS;
    }

    if (ride.driverId && ride.status !== 'requested') {
      if (ride.status === 'arrived') {
        if (mn) mn.textContent = '0';
        if (st) st.textContent = 'Your driver is here!';
        return;
      }
      // Only paint the driver's live MapKit ETA if it's fresh AND > 0. A
      // value of 0 is the stale reading carried over from the 'arrived'
      // state and is meaningless post-pickup. During the brief window
      // between a status change and Swift's next publish, fall back to a
      // haversine estimate if we have driver GPS, else show "Calculating...".
      if (_driverEtaFresh() && typeof ride.driverEtaSecs === 'number' && ride.driverEtaSecs > 0) {
        _paintEta(ride.driverEtaSecs);
        return;
      }
      var drv = db.users ? db.users.find(function(u) { return u.id === ride.driverId; }) : null;
      if (drv && drv.lat && drv.lng) {
        var dest = (ride.status === 'picked_up')
          ? { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
          : { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };
        if (dest.lat && dest.lng) {
          _paintEta(_hvETA(parseFloat(drv.lat), parseFloat(drv.lng), dest.lat, dest.lng));
          return;
        }
      }
      if (mn) mn.textContent = '--';
      if (st) {
        st.textContent = ride.status === 'picked_up'
          ? 'Calculating arrival time...'
          : 'Calculating pickup time...';
      }
      return;
    }

    if (ride.status === 'requested') {
      if (_driverEtaFresh()) {
        _paintEta(ride.driverEtaSecs);
        return;
      }
      if (typeof window._rideETA === 'number' && window._rideETA > 0) {
        if (mn) mn.textContent = String(window._rideETA);
        var etaStr2 = new Date(Date.now() + window._rideETA * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'ETA ' + etaStr2;
      } else {
        if (mn) mn.textContent = '--';
        if (st) st.textContent = 'Calculating arrival time...';
      }
    }
  }

  window._runETA = _runETA;
  _runETA();
  _etaInterval = setInterval(_runETA, 5000);
};

window.invalidateETATick = function() { _etaSeq++; };

window.stopETAUpdates = function() {
  if (_etaInterval) { clearInterval(_etaInterval); _etaInterval = null; }
  window._etaStarted = false;
};

window.getBestDriverId = function() {
  return _bestDriverId;
};
