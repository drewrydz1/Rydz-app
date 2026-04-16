// RYDZ Driver - Distributed MapKit Dispatch Listener
//
// Subscribes to INSERTs on dispatch_requests. When a rider asks "who can
// pick me up at (lat,lng)?" every online driver iPhone computes its own
// chain-walked ETA via Apple MapKit (free, unlimited, traffic-aware) and
// writes a dispatch_responses row. The rider then picks min(eta_secs).
//
// This replaces the old flow where the rider called Google DistanceMatrix
// on a 1-second loop for every online driver. Google cost per ride dropped
// from ~$0.60-$1.00 on slow rides to ~$0.00. Works on Android rider apps
// too because the rider side is just Supabase reads/writes — no native
// plugin dependency at all on the rider.
//
// Gates:
//   1. Driver must be signed in (DID set).
//   2. Driver must be online (localStorage 'rydz-drv-online' === 'true').
//   3. MapKit plugin must be present (iOS only; simulator without the
//      plugin or Android drivers silently no-op here).
//   4. Request must not be expired.
//
// Chain-walk: if the driver already has an active ride, ETA = time to
// finish existing waypoints + time from last waypoint to the new pickup.
// Mirrors the logic that used to live in rider/dispatch.js calcDriverETA.

var _dspCh = null;
var _dspSubscribedDID = null;
var _dspAnswered = {}; // request_id -> true, to avoid double-answers

function _dspInit() {
  return (typeof getRealtimeClient === 'function') ? getRealtimeClient() : null;
}

function _dspIsOnline() {
  try { return localStorage.getItem('rydz-drv-online') === 'true'; }
  catch (e) { return false; }
}

function _dspHasMapKit() {
  return !!(window.Capacitor && window.Capacitor.Plugins &&
            window.Capacitor.Plugins.RydzMapKit);
}

// Haversine distance in meters — used for expired / same-point fast paths.
function _dspHaversine(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Single MapKit call wrapped in a Promise with a 4s timeout so a stuck
// native bridge can never block the dispatch response.
function _dspCallMapKit(fromLat, fromLng, toLat, toLng) {
  return new Promise(function(resolve) {
    if (!_dspHasMapKit()) { resolve(null); return; }
    var timedOut = false;
    var to = setTimeout(function() { timedOut = true; resolve(null); }, 4000);
    try {
      window.Capacitor.Plugins.RydzMapKit.calculateETA({
        fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng
      }).then(function(res) {
        if (timedOut) return;
        clearTimeout(to);
        if (!res || typeof res.seconds !== 'number') { resolve(null); return; }
        resolve(Math.max(0, Math.round(res.seconds)));
      }).catch(function() {
        if (timedOut) return;
        clearTimeout(to);
        resolve(null);
      });
    } catch (e) {
      clearTimeout(to);
      resolve(null);
    }
  });
}

// Walk the driver's current work chain and return total seconds to reach
// (newPuLat, newPuLng). Resolves with null if MapKit fails on any hop.
function _dspChainETA(newPuLat, newPuLng) {
  return new Promise(function(resolve) {
    // Start from driver's last known GPS. Falls back to their users row.
    var d = (typeof gD === 'function') ? gD() : null;
    var curLat = d && d.lat ? parseFloat(d.lat) : null;
    var curLng = d && d.lng ? parseFloat(d.lng) : null;
    if (!curLat || !curLng) { resolve(null); return; }

    // Build waypoint list from the active ride, same rules as the old
    // rider-side calcDriverETA.
    var steps = [];
    var mr = (typeof gMR === 'function') ? gMR() : null;
    if (mr) {
      var puLat = parseFloat(mr.puX), puLng = parseFloat(mr.puY);
      var doLat = parseFloat(mr.doX), doLng = parseFloat(mr.doY);
      if (mr.status === 'accepted' || mr.status === 'en_route') {
        if (puLat && puLng) steps.push({ lat: puLat, lng: puLng });
        if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
      } else if (mr.status === 'arrived' || mr.status === 'picked_up') {
        if (doLat && doLng) steps.push({ lat: doLat, lng: doLng });
      }
    }
    steps.push({ lat: parseFloat(newPuLat), lng: parseFloat(newPuLng) });

    var total = 0;
    var i = 0;
    function next() {
      if (i >= steps.length) { resolve(total); return; }
      var s = steps[i];
      _dspCallMapKit(curLat, curLng, s.lat, s.lng).then(function(secs) {
        if (secs === null) { resolve(null); return; }
        total += secs;
        curLat = s.lat;
        curLng = s.lng;
        i++;
        next();
      });
    }
    next();
  });
}

function _dspOnRequest(payload) {
  try {
    var row = payload && (payload.new || payload.record);
    if (!row || !row.id) return;
    if (_dspAnswered[row.id]) return;
    if (!_dspIsOnline()) return;
    if (typeof DID === 'undefined' || !DID) return;
    if (!_dspHasMapKit()) return;

    // Skip expired requests (clock skew safe: 35s grace).
    var expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if (expires && Date.now() > expires + 5000) return;

    var puLat = parseFloat(row.pu_lat);
    var puLng = parseFloat(row.pu_lng);
    if (!puLat || !puLng) return;

    // Need a driver GPS fix to compute anything.
    var d = (typeof gD === 'function') ? gD() : null;
    if (!d || !d.lat || !d.lng) return;

    _dspAnswered[row.id] = true;

    _dspChainETA(puLat, puLng).then(function(secs) {
      if (secs === null) return; // MapKit unavailable / all hops failed
      var dist = Math.round(
        _dspHaversine(parseFloat(d.lat), parseFloat(d.lng), puLat, puLng)
      );
      // POST with upsert semantics so a retry (rare) merges instead of
      // erroring on the composite primary key.
      var url = SUPA_URL + '/rest/v1/dispatch_responses?on_conflict=request_id,driver_id';
      var hdrs = Object.assign({}, SUPA_H, {
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      });
      fetch(url, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          request_id: row.id,
          driver_id: DID,
          eta_secs: secs,
          distance_m: dist
        })
      }).catch(function(e) {
        console.log('[dispatch] POST response failed', e && e.message);
      });
    });
  } catch (e) {
    console.log('[dispatch] onRequest error', e);
  }
}

function subscribeDispatchRealtime() {
  if (typeof DID === 'undefined' || !DID) return;
  if (_dspSubscribedDID === DID && _dspCh) return;
  var client = _dspInit();
  if (!client) return;
  unsubscribeDispatchRealtime();
  _dspSubscribedDID = DID;
  try {
    _dspCh = client
      .channel('driver-dispatch-' + DID)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dispatch_requests' },
          function (payload) { _dspOnRequest(payload); })
      .subscribe();
  } catch (e) {
    console.error('[dispatch] subscribe failed', e);
  }
}

function unsubscribeDispatchRealtime() {
  var client = _dspInit();
  if (_dspCh && client) {
    try { client.removeChannel(_dspCh); } catch (e) {}
  }
  _dspCh = null;
  _dspSubscribedDID = null;
}

function resubscribeDispatchRealtime() {
  unsubscribeDispatchRealtime();
  if (typeof reconnectRealtimeClient === 'function') reconnectRealtimeClient();
  subscribeDispatchRealtime();
}

window.subscribeDispatchRealtime = subscribeDispatchRealtime;
window.unsubscribeDispatchRealtime = unsubscribeDispatchRealtime;
window.resubscribeDispatchRealtime = resubscribeDispatchRealtime;
