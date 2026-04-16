// RYDZ Rider - Dispatch Engine v6 (Distributed MapKit via Supabase)
//
// Zero Google API calls on the ride's hot path. Everything routes through
// Supabase so this file stays platform-agnostic — Android riders will run
// the exact same code.
//
//   • PRE-ACCEPT dispatch: INSERT a dispatch_requests row. Every online
//     driver iPhone (see driver-native/www/js/driver/dispatch.js) listens
//     via Supabase Realtime, computes its own chain-walked ETA via Apple
//     MapKit (free, unlimited, traffic-aware) and UPSERTs a dispatch_
//     responses row. After ~2 seconds we take the minimum and return it.
//     If no driver answers in time we fall back to a haversine estimate
//     plus the single nearest-by-straight-line driver so the ride is
//     still assignable.
//
//   • POST-ACCEPT wait-screen countdown: read `rides.driver_eta_secs`
//     which the assigned driver is already publishing every ~1.5s via
//     MapKit. No per-tick network from the rider.
//
//   • No per-second polling, no buffer / no floor — whatever the routing
//     engine says, rounded to the nearest minute.
//
//   • Wait-screen refresh is event-driven from realtime with a 5s safety
//     interval (down from 1s — we no longer need tight polling because
//     there's nothing expensive to recompute on this side).

var _etaInterval = null;
var _bestDriverId = null;

// Generation counter for ETA tick deduping. Every _runETA fire bumps this,
// and every async callback captures the value it started with so a slow
// fallback computation can't paint over a newer realtime value.
var _etaSeq = 0;

// Rider-side MapKit ETA cache. See _runETA post-accept block for rationale.
// Keyed implicitly by rideId+status — when either changes we discard.
var _riderEtaCache = { t: 0, secs: null, rideId: null, status: null };

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

// Nearest online driver by straight-line distance. Used as a local
// fallback when no driver answers the dispatch handshake in time, so we
// can still assign the ride instead of showing "No drivers available".
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

// Fallback: find nearest driver by straight-line, then compute accurate
// ETA via rider's own MapKit plugin (fastest route). Falls back to
// haversine only if the plugin isn't available (web browser rider).
function _riderMapKitFallback(puLat, puLng, callback) {
  var nearest = _nearestOnlineDriverByHaversine(puLat, puLng);
  _bestDriverId = nearest.id;
  if (!nearest.id) { callback(0, null); return; }

  var plugin = window.Capacitor && window.Capacitor.Plugins &&
               window.Capacitor.Plugins.RydzMapKit;
  var drv = db && db.users ? db.users.find(function(u) {
    return u.id === nearest.id;
  }) : null;

  if (plugin && drv && drv.lat && drv.lng) {
    try {
      plugin.calculateETA({
        fromLat: parseFloat(drv.lat), fromLng: parseFloat(drv.lng),
        toLat: puLat, toLng: puLng
      }).then(function(res) {
        if (res && typeof res.seconds === 'number') {
          var mins = Math.max(1, Math.round(res.seconds / 60));
          try { console.log('[dispatch] pre-accept MapKit fallback: ' +
            Math.round(res.seconds) + 's (' + mins + ' min)'); } catch(e) {}
          callback(mins, nearest.id);
        } else {
          callback(nearest.etaSecs ? Math.max(1, Math.round(nearest.etaSecs / 60)) : 0, nearest.id);
        }
      }).catch(function() {
        callback(nearest.etaSecs ? Math.max(1, Math.round(nearest.etaSecs / 60)) : 0, nearest.id);
      });
      return;
    } catch (e) {}
  }
  callback(nearest.etaSecs ? Math.max(1, Math.round(nearest.etaSecs / 60)) : 0, nearest.id);
}

// ===========================================================================
// PRE-ACCEPT: Supabase handshake.
//
// 1. POST dispatch_requests → returns row with id + expires_at.
// 2. Open a Realtime channel on dispatch_responses filtered to request_id.
// 3. Resolve after DISPATCH_WINDOW_MS (or as soon as every known online
//    driver has answered, whichever is first) with the min(eta_secs).
// 4. Tear down the channel.
// 5. If the window closes with zero responses, fall back to rider's own
//    MapKit computation so the ride still has an assignee.
//
// Callback signature matches the old calcRealETA: (etaMinutes, driverId).
// ===========================================================================
var DISPATCH_WINDOW_MS = 2000;        // how long to wait for driver responses
var DISPATCH_MAX_WINDOW_MS = 4000;    // absolute ceiling if drivers are slow
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

  // Sanity: need at least one online driver to bother handshaking.
  var expected = _dspExpectedResponderCount();
  if (!expected) {
    _bestDriverId = null;
    callback(0, null);
    return;
  }

  var client = _dspGetClient();
  if (!client) {
    // Realtime unavailable — compute via rider's own MapKit.
    _riderMapKitFallback(puLat, puLng, callback);
    return;
  }

  // Step 1: INSERT the request. supaFetch returns the parsed representation.
  var riderId = (typeof curUser !== 'undefined' && curUser) ? curUser.id : null;
  supaFetch('POST', 'dispatch_requests', '', {
    rider_id: riderId,
    pu_lat: puLat,
    pu_lng: puLng
  }).then(function(res) {
    var reqRow = Array.isArray(res) ? res[0] : res;
    if (!reqRow || !reqRow.id) {
      // INSERT failed — compute via rider's own MapKit.
      _riderMapKitFallback(puLat, puLng, callback);
      return;
    }

    var requestId = reqRow.id;
    var best = null; // { etaSecs, driverId }
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
        // Nobody answered — compute via rider's own MapKit.
        _riderMapKitFallback(puLat, puLng, callback);
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
      // Early exit if we've heard from everyone we expected.
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
      // Channel failed — compute via rider's own MapKit.
      _riderMapKitFallback(puLat, puLng, callback);
      return;
    }

    // Soft window: if at least one response has arrived, resolve now.
    // Hard window: absolute ceiling regardless of response count.
    var softTimer = setTimeout(function() { if (best) finish(); }, DISPATCH_WINDOW_MS);
    var hardTimer = setTimeout(function() { finish(); }, DISPATCH_MAX_WINDOW_MS);
  });
};

// ===========================================================================
// LIVE ETA UPDATES on the wait screen.
//
// POST-ACCEPT: zero network — we read ride.driverEtaSecs which the driver
// iPhone is pushing to Supabase on every GPS tick (~1.5s).
//
// PRE-ACCEPT ('requested'): we show the ETA captured at dispatch time.
// There's no expensive recomputation loop anymore — the dispatch handshake
// ran once, we keep that number until a driver accepts. That was the old
// ~$0.60-$1.00 per slow-ride Google leak and it's gone.
//
// Architecture: this function is also exposed on `window._runETA` so
// rideState.js can call it synchronously from updWait() whenever a
// realtime UPDATE lands. The setInterval below is a 5s safety net only.
// ===========================================================================
window.startETAUpdates = function() {
  if (_etaInterval) clearInterval(_etaInterval);

  function _runETA() {
    if (typeof arId === 'undefined' || !arId || !db) return;
    var ride = db.rides.find(function(ri) { return ri.id === arId; });
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return;

    var mySeq = ++_etaSeq;
    var myStatus = ride.status;
    var myRideId = ride.id;

    function _stale() {
      if (mySeq !== _etaSeq) return true;
      if (!arId || arId !== myRideId) return true;
      var c = db && db.rides ? db.rides.find(function(ri) { return ri.id === myRideId; }) : null;
      if (!c || c.status !== myStatus) return true;
      return false;
    }

    var mn = document.getElementById('w-mn');
    var st = document.getElementById('w-st');

    // ---- POST-ACCEPT: trust the driver's published ETA. ----
    //
    // The driver's native RydzLocation plugin publishes driver_eta_secs
    // from Swift every ~1.5s via CLLocationManager + MKDirections with
    // requestsAlternateRoutes + fastest-route selection + highway/toll
    // allow. This value is authoritative — it's computed from the
    // driver's ACTUAL current GPS (not a stale copy) using the same
    // routing engine as Apple Maps.
    //
    // We no longer run a SECOND independent MapKit call from the rider
    // because two calls to MKDirections with slightly different coords
    // or timing can return different routes (e.g. 11 min vs 18 min),
    // causing the rider to show a different number than the driver
    // actually computed. One source of truth = no discrepancy.
    //
    // Fallback: rider's own MapKit only fires on the FIRST tick when
    // driver_eta_secs hasn't arrived yet via realtime.
    if (ride.driverId && ride.status !== 'requested') {
      if (ride.status === 'arrived') {
        if (mn) mn.textContent = '0';
        if (st) st.textContent = 'Your driver is here!';
        return;
      }

      function _paintEta(secs) {
        if (_stale()) return;
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

      // Primary: driver's published MapKit ETA (fastest route, native background)
      if (typeof ride.driverEtaSecs === 'number') {
        try { console.log('[dispatch] post-accept paint: ' + ride.driverEtaSecs + 's (' +
          Math.round(ride.driverEtaSecs/60) + ' min) status=' + ride.status); } catch(e) {}
        _paintEta(ride.driverEtaSecs);
        return;
      }

      // Fallback: first tick before driver's native plugin has published.
      // Use rider's own MapKit (same fastest-route settings) to bridge
      // the gap. Once driverEtaSecs arrives via realtime, it takes over.
      var drv = db && db.users ? db.users.find(function(u) { return u.id === ride.driverId; }) : null;
      var dlat = drv && drv.lat ? parseFloat(drv.lat) : null;
      var dlng = drv && drv.lng ? parseFloat(drv.lng) : null;
      var dest = (ride.status === 'picked_up')
        ? { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
        : { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };

      if (_riderEtaCache.rideId !== ride.id || _riderEtaCache.status !== ride.status) {
        _riderEtaCache = { t: 0, secs: null, rideId: ride.id, status: ride.status };
      }

      if (typeof _riderEtaCache.secs === 'number') {
        _paintEta(_riderEtaCache.secs);
      }

      var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RydzMapKit;
      if (plugin && dlat && dlng && dest.lat && dest.lng) {
        var now = Date.now();
        if (now - _riderEtaCache.t >= 3000) {
          var capturedSeq = mySeq;
          try {
            plugin.calculateETA({
              fromLat: dlat, fromLng: dlng, toLat: dest.lat, toLng: dest.lng
            }).then(function(res) {
              if (!res || typeof res.seconds !== 'number') return;
              var secs = Math.max(0, Math.round(res.seconds));
              _riderEtaCache = { t: Date.now(), secs: secs, rideId: ride.id, status: ride.status };
              if (capturedSeq !== _etaSeq) return;
              _paintEta(secs);
            }).catch(function() {});
          } catch (e) {}
        }
      }
      return;
    }

    // ---- PRE-ACCEPT ('requested'): waiting for a driver to claim. ----
    // No per-tick recomputation. We show the number captured during
    // dispatch (window._rideETA from helpers.js go('finding') path).
    if (ride.status === 'requested') {
      var preEta = window._rideETA;
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

  // Expose _runETA so updWait() can drive it event-style on every
  // realtime UPDATE. The interval below is only a 5s safety net.
  window._runETA = _runETA;
  _runETA();
  _etaInterval = setInterval(_runETA, 5000);
};

// Called by updWait() on status transitions. Bumping the seq discards
// any in-flight fallback callback from a previous tick so stale work
// can't land on a newer screen state.
window.invalidateETATick = function() { _etaSeq++; };

window.stopETAUpdates = function() {
  if (_etaInterval) { clearInterval(_etaInterval); _etaInterval = null; }
  window._etaStarted = false;
};

window.getBestDriverId = function() {
  return _bestDriverId;
};
