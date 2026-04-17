// RYDZ Rider - Dispatch Engine v8 (Google Distance Matrix + Driver MapKit)
//
// CONFIRM SCREEN (pre-request):
//   Google Distance Matrix chain-walk: driver -> active ride waypoints ->
//   pickup. Uses real road routing. One-time call during "Finding" spinner.
//   Haversine fallback if Google unavailable.
//
// WAIT SCREEN (post-request):
//   Primary: driver's native MapKit ETA (rides.driver_eta_secs), published
//   every ~1.5s from the driver's background iOS plugin.
//   Fallback: haversine from driver's live GPS if MapKit stale (>12s).

var _etaInterval = null;
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

// Haversine ETA fallback: straight-line × 1.3 road factor / 9.7 m/s (35 km/h).
function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist * 1.3 / 9.7));
}

function _nearestOnlineDriver(puLat, puLng) {
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

// Build the chain of waypoints from driver's current position through any
// active ride stops to the final destination (new ride pickup).
function _buildChain(driverId, destLat, destLng) {
  if (!driverId || !db || !db.users) return null;
  var drv = db.users.find(function(u) { return u.id === driverId; });
  var lat = drv && drv.lat ? parseFloat(drv.lat) : null;
  var lng = drv && drv.lng ? parseFloat(drv.lng) : null;
  if (!lat || !lng) return null;

  var pts = [{ lat: lat, lng: lng }];

  if (db.rides) {
    for (var i = 0; i < db.rides.length; i++) {
      var r = db.rides[i];
      if (r.driverId !== driverId) continue;
      var s = r.status;
      if (s === 'completed' || s === 'cancelled' || s === 'canceled' || s === 'requested') continue;
      var pla = parseFloat(r.puX), pln = parseFloat(r.puY);
      var dla = parseFloat(r.doX), dln = parseFloat(r.doY);
      if (s === 'accepted' || s === 'en_route') {
        if (pla && pln) pts.push({ lat: pla, lng: pln });
        if (dla && dln) pts.push({ lat: dla, lng: dln });
      } else if (s === 'arrived' || s === 'picked_up') {
        if (dla && dln) pts.push({ lat: dla, lng: dln });
      }
      break;
    }
  }

  pts.push({ lat: parseFloat(destLat), lng: parseFloat(destLng) });
  return pts;
}

function _haversineChainETA(driverId, destLat, destLng) {
  var pts = _buildChain(driverId, destLat, destLng);
  if (!pts || pts.length < 2) return null;
  var total = 0;
  for (var i = 1; i < pts.length; i++) {
    total += _hvETA(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return total;
}

// Google Distance Matrix chain-walk: real road routing for each hop.
function _googleChainETA(driverId, destLat, destLng, callback) {
  var pts = _buildChain(driverId, destLat, destLng);
  if (!pts || pts.length < 2) { callback(null); return; }

  if (typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) {
    callback(null);
    return;
  }

  var svc = new google.maps.DistanceMatrixService();
  var totalSecs = 0;
  var idx = 0;

  function next() {
    if (idx >= pts.length - 1) { callback(totalSecs); return; }
    var from = pts[idx];
    var to = pts[idx + 1];
    svc.getDistanceMatrix({
      origins: [new google.maps.LatLng(from.lat, from.lng)],
      destinations: [new google.maps.LatLng(to.lat, to.lng)],
      travelMode: google.maps.TravelMode.DRIVING
    }, function(resp, status) {
      if (status === 'OK' && resp.rows[0] && resp.rows[0].elements[0] &&
          resp.rows[0].elements[0].status === 'OK') {
        var el = resp.rows[0].elements[0];
        totalSecs += el.duration_in_traffic ? el.duration_in_traffic.value : el.duration.value;
      } else {
        totalSecs += _hvETA(from.lat, from.lng, to.lat, to.lng);
      }
      idx++;
      next();
    });
  }

  next();
}

// ===========================================================================
// PRE-REQUEST: called during "Finding" spinner.
// Google Distance Matrix chain-walk -> haversine fallback.
// ===========================================================================
window.calcRealETA = function(puLat, puLng, callback) {
  puLat = parseFloat(puLat); puLng = parseFloat(puLng);
  if (!puLat || !puLng) { callback(0, null); return; }

  var nearest = _nearestOnlineDriver(puLat, puLng);
  if (!nearest.id) { _bestDriverId = null; callback(0, null); return; }
  _bestDriverId = nearest.id;

  _googleChainETA(nearest.id, puLat, puLng, function(secs) {
    if (typeof secs === 'number' && secs > 0) {
      callback(Math.max(1, Math.round(secs / 60)), nearest.id);
    } else {
      var hvSecs = _haversineChainETA(nearest.id, puLat, puLng);
      if (typeof hvSecs === 'number' && hvSecs > 0) {
        callback(Math.max(1, Math.round(hvSecs / 60)), nearest.id);
      } else {
        callback(nearest.etaSecs ? Math.max(1, Math.round(nearest.etaSecs / 60)) : 0, nearest.id);
      }
    }
  });
};

// ===========================================================================
// WAIT SCREEN: live ETA updates.
//
// POST-ACCEPT: driver's MapKit ETA from rides.driver_eta_secs (real-time).
// PRE-ACCEPT: driver publishes chain ETA for pending rides too.
// Haversine fallback if driver ETA stale (>12s).
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

    // Helper: check if driver's published ETA is fresh enough to trust
    function _driverEtaFresh() {
      if (typeof ride.driverEtaSecs !== 'number') return false;
      var age = ride.driverEtaUpdatedAt
        ? Date.now() - new Date(ride.driverEtaUpdatedAt).getTime()
        : Infinity;
      return age < DRIVER_ETA_STALE_MS;
    }

    // ---- POST-ACCEPT: driver is working on this ride ----
    if (ride.driverId && ride.status !== 'requested') {
      if (ride.status === 'arrived') {
        if (mn) mn.textContent = '0';
        if (st) st.textContent = 'Your driver is here!';
        return;
      }

      if (_driverEtaFresh()) {
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

      if (typeof ride.driverEtaSecs === 'number') {
        _paintEta(ride.driverEtaSecs);
      }
      return;
    }

    // ---- PRE-ACCEPT ('requested'): driver assigned but hasn't accepted ----
    if (ride.status === 'requested') {
      if (_driverEtaFresh()) {
        _paintEta(ride.driverEtaSecs);
        return;
      }

      var preEta = window._rideETA;
      if (ride.driverId) {
        var chainSecs = _haversineChainETA(ride.driverId,
          parseFloat(ride.puX), parseFloat(ride.puY));
        if (typeof chainSecs === 'number' && chainSecs > 0) {
          preEta = Math.max(1, Math.round(chainSecs / 60));
          window._rideETA = preEta;
        }
      }

      if (typeof preEta === 'number' && preEta > 0) {
        if (mn) mn.textContent = String(preEta);
        var etaStr2 = new Date(Date.now() + preEta * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'ETA ' + etaStr2;
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
