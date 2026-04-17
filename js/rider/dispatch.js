// RYDZ Rider - Dispatch Engine v9 (Server-Side Atomic Dispatch)
//
// One fetch to Edge Function `/functions/v1/dispatch`:
//   1. Queries all online drivers + queues from Postgres
//   2. Chain-walks haversine ETA per driver
//   3. Atomically assigns via assign_ride_to_driver RPC (row-lock)
//   4. Returns { ride_id, driver_id, eta_seconds }
//
// No draft rides, no client-side driver picking, no 500ms polling.
// If rider backs out from confirm, cancelDispatchRide cancels it.

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

function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist * 1.3 / 9.7));
}

// ===========================================================================
// Build the dispatch payload from current rider selections.
// ===========================================================================
function _buildDispatchPayload(puLat, puLng) {
  var riderId = (typeof curUser !== 'undefined' && curUser) ? curUser.id : null;
  if (!riderId) return null;

  var doLat = parseFloat((typeof doSel !== 'undefined' && doSel) ? (doSel.lat || doSel.x || 0) : 0);
  var doLng = parseFloat((typeof doSel !== 'undefined' && doSel) ? (doSel.lng || doSel.y || 0) : 0);

  return {
    riderId: riderId,
    pickup: (typeof puSel !== 'undefined' && puSel) ? (puSel.n || puSel.a || 'Pickup') : 'Pickup',
    dropoff: (typeof doSel !== 'undefined' && doSel) ? (doSel.n || doSel.a || 'Dropoff') : 'Dropoff',
    puLat: puLat,
    puLng: puLng,
    doLat: doLat,
    doLng: doLng,
    passengers: (typeof pass !== 'undefined') ? pass : 1,
    phone: (typeof curUser !== 'undefined' && curUser) ? (curUser.phone || null) : null,
    note: (document.getElementById('f-note') || {}).value || ''
  };
}

// ===========================================================================
// FINDING / CONFIRM SCREEN: preview-only dispatch call.
// Scores drivers and returns the best ETA WITHOUT creating a ride row.
// The driver is never notified until the rider taps "Request Ride".
// ===========================================================================
window.calcRealETA = function(puLat, puLng, callback) {
  puLat = parseFloat(puLat); puLng = parseFloat(puLng);
  if (!puLat || !puLng) { callback(0, null); return; }

  var payload = _buildDispatchPayload(puLat, puLng);
  if (!payload) { callback(0, null); return; }
  payload.preview = true;

  fetch(SUPA_URL + '/functions/v1/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY
    },
    body: JSON.stringify(payload)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (!data || !data.ok) {
      _bestDriverId = null;
      callback(-1, null);
      return;
    }
    _bestDriverId = data.driver_id;
    var etaMins = data.eta_mins || Math.max(1, Math.round((data.eta_seconds || 120) / 60));
    window._rideETA = etaMins;
    callback(etaMins, data.driver_id);
  })
  .catch(function(e) {
    if (typeof logError === 'function') logError('calcRealETA', e);
    _bestDriverId = null;
    callback(-1, null);
  });
};

// ===========================================================================
// REQUEST RIDE TAP: commit call. Creates the ride atomically as 'requested'
// so the driver gets notified. Only called from rideService._reqRideOrig().
// ===========================================================================
window.commitDispatchRide = function(callback) {
  var puLat = parseFloat((typeof puSel !== 'undefined' && puSel) ? (puSel.lat || puSel.x || 0) : 0);
  var puLng = parseFloat((typeof puSel !== 'undefined' && puSel) ? (puSel.lng || puSel.y || 0) : 0);
  if (!puLat || !puLng) { callback(false); return; }

  var payload = _buildDispatchPayload(puLat, puLng);
  if (!payload) { callback(false); return; }

  fetch(SUPA_URL + '/functions/v1/dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY
    },
    body: JSON.stringify(payload)
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (!data || !data.ok || !data.ride_id) {
      callback(false);
      return;
    }

    _bestDriverId = data.driver_id;
    arId = data.ride_id;
    try { localStorage.setItem('rydz-active-ride', data.ride_id); } catch (e) {}

    var etaMins = data.eta_mins || Math.max(1, Math.round((data.eta_seconds || 120) / 60));
    window._rideETA = etaMins;

    var localRide = {
      id: data.ride_id,
      riderId: payload.riderId,
      driverId: data.driver_id,
      pickup: payload.pickup,
      dropoff: payload.dropoff,
      puX: payload.puLat, puY: payload.puLng,
      doX: payload.doLat, doY: payload.doLng,
      passengers: payload.passengers,
      status: 'requested',
      phone: payload.phone,
      note: payload.note,
      driverEtaSecs: data.eta_seconds || null,
      driverEtaUpdatedAt: null,
      createdAt: Date.now(),
      completedAt: null
    };
    if (db && db.rides) db.rides.push(localRide);

    if (typeof ensureRealtimeForActiveRide === 'function') ensureRealtimeForActiveRide();
    callback(true);
  })
  .catch(function(e) {
    if (typeof logError === 'function') logError('commitDispatchRide', e);
    callback(false);
  });
};

// ===========================================================================
// Cancel ride (user went back from confirm or cancel from wait).
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
// CONFIRM SCREEN: live-read driver's MapKit ETA from the ride.
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

    // REQUESTED: driver hasn't accepted yet — no live Swift ETA exists.
    // Show the dispatch preview ETA only.
    if (ride.status === 'requested') {
      if (typeof window._rideETA === 'number' && window._rideETA > 0) {
        if (mn) mn.textContent = String(window._rideETA);
        var etaStr2 = new Date(Date.now() + window._rideETA * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'ETA ' + etaStr2;
      } else {
        if (mn) mn.textContent = '--';
        if (st) st.textContent = 'Waiting for driver...';
      }
      return;
    }

    // ARRIVED: driver is at the pickup — always show 0.
    if (ride.status === 'arrived') {
      if (mn) mn.textContent = '0';
      if (st) st.textContent = 'Your driver is here!';
      return;
    }

    // ACCEPTED / EN_ROUTE / PICKED_UP: use Swift's live MapKit ETA.
    if (ride.driverId) {
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
