// RYDZ Rider - Dispatch Engine v7 (Pure Supabase — zero native dependencies)
//
// The rider app is 100% platform-agnostic. Works identically on iOS and
// Android because it NEVER calls native MapKit. All accurate ETAs come
// from the DRIVER's native plugin via Supabase:
//
//   • PRE-ACCEPT dispatch: INSERT a dispatch_requests row. Every online
//     driver iPhone computes its own chain-walked ETA via Apple MapKit
//     and UPSERTs a dispatch_responses row. After ~2s the rider takes
//     the minimum. If nobody answers, haversine estimate + nearest driver.
//
//   • POST-ACCEPT wait-screen: read rides.driver_eta_secs which the
//     driver publishes every ~1.5s from native background MapKit.
//     If stale (driver backgrounded iOS throttled MapKit), the rider
//     uses haversine from the driver's live GPS as a rough estimate.
//
//   • PRE-ACCEPT wait-screen: show dispatch snapshot, recompute a
//     haversine chain estimate every tick as the driver moves.
//
//   • No native plugins, no MapKit, no Google calls on the rider side.

var _etaInterval = null;
var _bestDriverId = null;

var _etaSeq = 0;

// If driver's published ETA is older than this, use haversine estimate
// from the driver's live GPS instead. Driver GPS always flows from
// background (native CLLocationManager), but MapKit may be throttled.
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

// Haversine ETA estimate: 25 km/h city streets × 1.4 road winding factor.
// Returns seconds. Rough but updates in real-time with driver GPS.
function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist / 6.9));
}

function _nearestOnlineDriverByHaversine(puLat, puLng) {
  if (!db || !db.users) return { id: null, etaSecs: null };
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
  if (!best) return { id: null, etaSecs: null };
  return { id: best.id, etaSecs: _hvETA(parseFloat(best.lat), parseFloat(best.lng), puLat, puLng) };
}

// Chain-walked haversine ETA: walks driver → active ride waypoints →
// destination using haversine for each hop. No native dependencies.
// Returns total seconds or null if driver GPS unavailable.
function _haversineChainETA(driverId, destLat, destLng) {
  if (!driverId || !db || !db.users) return null;
  var drv = db.users.find(function(u) { return u.id === driverId; });
  var curLat = drv && drv.lat ? parseFloat(drv.lat) : null;
  var curLng = drv && drv.lng ? parseFloat(drv.lng) : null;
  if (!curLat || !curLng) return null;

  var steps = [];
  var activeRide = null;
  if (db.rides) {
    for (var i = 0; i < db.rides.length; i++) {
      var r = db.rides[i];
      if (r.driverId !== driverId) continue;
      var s = r.status;
      if (s === 'completed' || s === 'cancelled' || s === 'canceled') continue;
      if (s === 'requested') continue;
      activeRide = r;
      break;
    }
  }

  if (activeRide) {
    var puLat = parseFloat(activeRide.puX), puLng = parseFloat(activeRide.puY);
    var doLat = parseFloat(activeRide.doX), doLng = parseFloat(activeRide.doY);
    if (activeRide.status === 'accepted' || activeRide.status === 'en_route') {
      if (puLat && puLng) steps.push({ lat: puLat, lng: puLng });
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    } else if (activeRide.status === 'arrived' || activeRide.status === 'picked_up') {
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
    }
  }

  steps.push({ lat: parseFloat(destLat), lng: parseFloat(destLng) });

  var total = 0;
  for (var j = 0; j < steps.length; j++) {
    total += _hvETA(curLat, curLng, steps[j].lat, steps[j].lng);
    curLat = steps[j].lat;
    curLng = steps[j].lng;
  }
  return total;
}

// Fallback when no driver answers the dispatch handshake. Uses haversine
// chain estimate — no native plugins needed.
function _haversineFallback(puLat, puLng, callback) {
  var nearest = _nearestOnlineDriverByHaversine(puLat, puLng);
  _bestDriverId = nearest.id;
  if (!nearest.id) { callback(0, null); return; }

  var chainSecs = _haversineChainETA(nearest.id, puLat, puLng);
  if (typeof chainSecs === 'number' && chainSecs > 0) {
    var mins = Math.max(1, Math.round(chainSecs / 60));
    callback(mins, nearest.id);
  } else {
    callback(nearest.etaSecs ? Math.max(1, Math.round(nearest.etaSecs / 60)) : 0, nearest.id);
  }
}

// ===========================================================================
// PRE-ACCEPT: Supabase dispatch handshake.
//
// 1. POST dispatch_requests row.
// 2. Drivers compute chain ETAs via native MapKit, UPSERT dispatch_responses.
// 3. After 2-4s take the minimum. If nobody answers, haversine fallback.
// ===========================================================================
var DISPATCH_WINDOW_MS = 2000;
var DISPATCH_MAX_WINDOW_MS = 4000;
var _dspClient = null;

function _dspGetClient() {
  if (_dspClient) return _dspClient;
  if (!window.supabase || !window.supabase.createClient) return null;
  try {
    _dspClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } catch (e) { return null; }
  return _dspClient;
}

function _dspExpectedResponderCount() {
  if (!db || !db.users) return 0;
  var n = 0;
  for (var i = 0; i < db.users.length; i++) {
    var u = db.users[i];
    if (u.role === 'driver' && u.status === 'online' && u.lat && u.lng) n++;
  }
  return n;
}

window.calcRealETA = function(puLat, puLng, callback) {
  puLat = parseFloat(puLat); puLng = parseFloat(puLng);
  if (!puLat || !puLng) { callback(0, null); return; }

  var expected = _dspExpectedResponderCount();
  if (!expected) {
    _bestDriverId = null;
    callback(0, null);
    return;
  }

  var client = _dspGetClient();
  if (!client) {
    _haversineFallback(puLat, puLng, callback);
    return;
  }

  var riderId = (typeof curUser !== 'undefined' && curUser) ? curUser.id : null;
  supaFetch('POST', 'dispatch_requests', '', {
    rider_id: riderId,
    pu_lat: puLat,
    pu_lng: puLng
  }).then(function(res) {
    var reqRow = Array.isArray(res) ? res[0] : res;
    if (!reqRow || !reqRow.id) {
      _haversineFallback(puLat, puLng, callback);
      return;
    }

    var requestId = reqRow.id;
    var best = null;
    var received = 0;
    var done = false;
    var ch = null;

    function finish() {
      if (done) return;
      done = true;
      try { if (ch) client.removeChannel(ch); } catch (e) {}
      clearTimeout(softTimer);
      clearTimeout(hardTimer);

      if (best && best.etaSecs !== null && best.etaSecs !== undefined) {
        _bestDriverId = best.driverId;
        callback(Math.max(1, Math.round(best.etaSecs / 60)), best.driverId);
      } else {
        _haversineFallback(puLat, puLng, callback);
      }
    }

    function onResponse(payload) {
      var row = payload && (payload.new || payload.record);
      if (!row || row.request_id !== requestId) return;
      received++;
      if (typeof row.eta_secs === 'number') {
        if (!best || row.eta_secs < best.etaSecs) {
          best = { etaSecs: row.eta_secs, driverId: row.driver_id };
        }
      }
      if (received >= expected) finish();
    }

    try {
      ch = client
        .channel('rider-dispatch-' + requestId)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'dispatch_responses',
              filter: 'request_id=eq.' + requestId },
            onResponse)
        .subscribe();
    } catch (e) {
      _haversineFallback(puLat, puLng, callback);
      return;
    }

    var softTimer = setTimeout(function() { if (best) finish(); }, DISPATCH_WINDOW_MS);
    var hardTimer = setTimeout(function() { finish(); }, DISPATCH_MAX_WINDOW_MS);
  });
};

// ===========================================================================
// LIVE ETA UPDATES on the wait screen.
//
// POST-ACCEPT: read ride.driverEtaSecs (driver publishes via native MapKit).
// If stale (>12s), estimate from driver's live GPS via haversine.
//
// PRE-ACCEPT: show dispatch snapshot, update with haversine chain estimate
// as driver moves.
//
// No native plugins needed — 100% cross-platform.
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

    function _paintEta(secs, label) {
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

    // ---- POST-ACCEPT: driver is working on this ride ----
    if (ride.driverId && ride.status !== 'requested') {
      if (ride.status === 'arrived') {
        if (mn) mn.textContent = '0';
        if (st) st.textContent = 'Your driver is here!';
        return;
      }

      // Primary: driver's MapKit ETA from Supabase — trust if fresh
      var etaAge = ride.driverEtaUpdatedAt
        ? Date.now() - new Date(ride.driverEtaUpdatedAt).getTime()
        : Infinity;

      if (typeof ride.driverEtaSecs === 'number' && etaAge < DRIVER_ETA_STALE_MS) {
        _paintEta(ride.driverEtaSecs);
        return;
      }

      // Stale or missing — estimate from driver's live GPS via haversine.
      // Driver GPS always flows from background native plugin → Supabase →
      // Realtime, even when MapKit is throttled by iOS.
      var drv = db.users ? db.users.find(function(u) { return u.id === ride.driverId; }) : null;
      if (drv && drv.lat && drv.lng) {
        var dest = (ride.status === 'picked_up')
          ? { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
          : { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };
        if (dest.lat && dest.lng) {
          var hvSecs = _hvETA(parseFloat(drv.lat), parseFloat(drv.lng), dest.lat, dest.lng);
          _paintEta(hvSecs);
          return;
        }
      }

      // Last resort: show stale driver ETA (better than nothing)
      if (typeof ride.driverEtaSecs === 'number') {
        _paintEta(ride.driverEtaSecs);
      }
      return;
    }

    // ---- PRE-ACCEPT ('requested'): driver assigned but hasn't accepted ----
    // Show dispatch snapshot immediately, then update with haversine
    // chain estimate as the driver moves.
    if (ride.status === 'requested') {
      var preEta = window._rideETA;

      // Recompute chain estimate from driver's current GPS
      if (ride.driverId) {
        var chainSecs = _haversineChainETA(ride.driverId,
          parseFloat(ride.puX), parseFloat(ride.puY));
        if (typeof chainSecs === 'number' && chainSecs > 0) {
          var chainMins = Math.max(1, Math.round(chainSecs / 60));
          window._rideETA = chainMins;
          preEta = chainMins;
        }
      }

      if (typeof preEta === 'number' && preEta > 0) {
        if (mn) mn.textContent = String(preEta);
        var etaStr3 = new Date(Date.now() + preEta * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'ETA ' + etaStr3;
      } else {
        if (mn) mn.textContent = '--';
        if (st) st.textContent = 'Finding your driver...';
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
