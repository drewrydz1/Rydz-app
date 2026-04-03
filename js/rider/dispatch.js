// RYDZ Rider - Dispatch Engine v2
// Evaluates all online drivers, chains their ride timelines,
// picks the one with lowest total time to reach new rider's pickup.
// Uses Google Directions API for real drive times with traffic.

var _etaCache = {};
var _etaInterval = null;
var _bestDriverId = null; // Stores the pre-selected driver

// ============================================================
// CORE: Find best driver and return ETA + driver ID
// ============================================================
window.calcRealETA = function(puLat, puLng, callback) {
  if (typeof google === 'undefined' || !google.maps) { callback(0, null); return; }
  if (!db || !db.users || !db.rides) { callback(0, null); return; }

  // Get all drivers with role=driver
  var allDrivers = db.users.filter(function(u) { return u.role === 'driver'; });

  // Find which drivers are currently busy (have active rides)
  var activeRides = db.rides.filter(function(ri) {
    return ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(ri.status) >= 0 && ri.driverId;
  });
  var busyIds = activeRides.map(function(ri) { return ri.driverId; });

  // Find which drivers have queued rides (requested, assigned to them)
  var queuedRides = db.rides.filter(function(ri) {
    return ri.status === 'requested' && ri.driverId;
  });
  var queuedIds = queuedRides.map(function(ri) { return ri.driverId; });

  // Eligible = online (regardless of busy/idle)
  var eligible = allDrivers.filter(function(d) {
    return d.status === 'online';
  });

  // No online drivers at all
  if (!eligible.length) { callback(0, null); return; }

  var bestETA = null;
  var bestDriver = null;
  var pending = eligible.length;
  var done = false;

  // Safety timeout - if Google API is slow, return best so far after 8 seconds
  var timer = setTimeout(function() {
    if (!done) {
      done = true;
      _bestDriverId = bestDriver;
      callback(bestETA !== null ? bestETA : 0, bestDriver);
    }
  }, 8000);

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
        // Add 1 minute buffer for pickup preparation
        var finalETA = bestETA !== null ? Math.max(2, bestETA + 1) : 0;
        _bestDriverId = bestDriver;
        callback(finalETA, bestDriver);
      }
    });
  });
};

// ============================================================
// Calculate a single driver's total time to reach new pickup
// Chains: current ride → queued rides → new pickup
// ============================================================
function calcDriverETA(drv, newPuLat, newPuLng, callback) {
  var dlat = drv.lat ? parseFloat(drv.lat) : null;
  var dlng = drv.lng ? parseFloat(drv.lng) : null;

  // If driver has no GPS, use Naples service center as fallback
  if (!dlat || !dlng) { dlat = 26.1334; dlng = -81.7935; }

  // Get ALL rides assigned to this driver that aren't completed/cancelled
  // EXCLUDE the current rider's own ride (arId) to avoid double-counting
  var drvRides = db.rides.filter(function(ri) {
    if (typeof arId !== 'undefined' && ri.id === arId) return false;
    return ri.driverId === drv.id &&
      ['accepted', 'en_route', 'arrived', 'picked_up', 'requested'].indexOf(ri.status) >= 0;
  }).sort(function(a, b) {
    // Active rides first (accepted/en_route/arrived/picked_up), then queued (requested)
    var aActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(a.status) >= 0 ? 0 : 1;
    var bActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(b.status) >= 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  // IDLE DRIVER: no rides at all - direct drive to new pickup
  if (!drvRides.length) {
    driveETA(dlat, dlng, newPuLat, newPuLng).then(function(secs) {
      callback(Math.max(1, Math.ceil(secs / 60)));
    });
    return;
  }

  // BUSY DRIVER: chain through all current + queued rides
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
      // Currently carrying passenger - just need to drop off
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng, buf: 30 });
    } else if (ri.status === 'arrived') {
      // At pickup waiting for passenger - need pickup wait + full ride
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng, buf: 60 });
    } else if (ri.status === 'accepted' || ri.status === 'en_route') {
      // Driving to pickup - need to arrive, pickup, do full ride
      if (puLat && puLng) steps.push({ lat: puLat, lng: puLng, buf: 30 });
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng, buf: 30 });
    } else if (ri.status === 'requested') {
      // Queued ride - full cycle: drive to pickup, wait, drive to dropoff
      if (puLat && puLng) steps.push({ lat: puLat, lng: puLng, buf: 30 });
      if (doLat && doLng) steps.push({ lat: doLat, lng: doLng, buf: 30 });
    }
  });

  // Final step: from last dropoff to the NEW rider's pickup
  steps.push({ lat: parseFloat(newPuLat), lng: parseFloat(newPuLng), buf: 0 });

  // Chain through all steps sequentially using Google Directions
  var idx = 0;
  function next() {
    if (idx >= steps.length) {
      callback(Math.max(1, Math.ceil(totalSecs / 60)));
      return;
    }
    var s = steps[idx];
    driveETA(curLat, curLng, s.lat, s.lng).then(function(secs) {
      totalSecs += secs + s.buf;
      curLat = s.lat;
      curLng = s.lng;
      idx++;
      next();
    });
  }
  next();
}

// ============================================================
// Google Directions API call - returns seconds
// Falls back to haversine estimate if API fails
// ============================================================
function driveETA(fLat, fLng, tLat, tLng) {
  return new Promise(function(resolve) {
    if (!fLat || !fLng || !tLat || !tLng) { resolve(600); return; }
    fLat = parseFloat(fLat);
    fLng = parseFloat(fLng);
    tLat = parseFloat(tLat);
    tLng = parseFloat(tLng);

    // Skip API call if origin and destination are very close (< 100m)
    var quickDist = _quickDistance(fLat, fLng, tLat, tLng);
    if (quickDist < 100) { resolve(30); return; }

    if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
      try {
        var ds = new google.maps.DirectionsService();
        ds.route({
          origin: { lat: fLat, lng: fLng },
          destination: { lat: tLat, lng: tLng },
          travelMode: 'DRIVING',
          drivingOptions: { departureTime: new Date() } // Use current traffic
        }, function(res, st) {
          if (st === 'OK' && res.routes[0] && res.routes[0].legs[0]) {
            // Use duration_in_traffic if available, otherwise regular duration
            var leg = res.routes[0].legs[0];
            var secs = (leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value);
            resolve(secs);
          } else {
            resolve(_hvETA(fLat, fLng, tLat, tLng));
          }
        });
      } catch (e) {
        resolve(_hvETA(fLat, fLng, tLat, tLng));
      }
    } else {
      resolve(_hvETA(fLat, fLng, tLat, tLng));
    }
  });
}

// Quick distance in meters (for short-circuit check)
function _quickDistance(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Haversine fallback - estimates drive time from straight-line distance
// Uses 25 km/h average (Naples shuttles, city streets) with 1.4x road factor
function _hvETA(fLat, fLng, tLat, tLng) {
  var dist = _quickDistance(fLat, fLng, tLat, tLng);
  return Math.max(60, Math.round(dist / 6.9)); // ~25km/h with road winding
}

// ============================================================
// LIVE ETA UPDATES on wait screen
// Pre-accept: runs full dispatch timeline recalculation
// Post-accept: direct Google Directions from driver GPS to destination
// ============================================================
window.startETAUpdates = function() {
  if (_etaInterval) clearInterval(_etaInterval);

  function _runETA() {
    if (typeof arId === 'undefined' || !arId || !db) return;
    var ride = db.rides.find(function(ri) { return ri.id === arId; });
    if (!ride || ride.status === 'completed' || ride.status === 'cancelled') return;

    var mn = document.getElementById('w-mn');
    var st = document.getElementById('w-st');

    // POST-ACCEPT: Driver assigned and accepted - direct GPS tracking
    if (ride.driverId && ride.status !== 'requested') {
      var drv = db.users.find(function(u) { return u.id === ride.driverId; });
      if (drv && drv.lat && drv.lng) {
        var dlat = parseFloat(drv.lat);
        var dlng = parseFloat(drv.lng);
        var dest;
        if (ride.status === 'picked_up') {
          dest = { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) };
        } else {
          dest = { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };
        }
        if (dest && dest.lat && dest.lng) {
          driveETA(dlat, dlng, dest.lat, dest.lng).then(function(secs) {
            var mins = Math.max(1, Math.ceil(secs / 60));
            var etaStr = new Date(Date.now() + mins * 60000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit'
            });
            if (mn) mn.textContent = mins;
            if (st) {
              if (ride.status === 'picked_up') {
                st.textContent = mins + ' min to drop-off · ETA ' + etaStr;
              } else if (ride.status === 'arrived') {
                st.textContent = 'Your driver is here!';
                if (mn) mn.textContent = '0';
              } else {
                st.textContent = 'Arriving in ' + mins + ' min · ETA ' + etaStr;
              }
            }
          });
        }
      }
    }
    // PRE-ACCEPT: Ride requested, waiting for driver
    // If pre-assigned to a driver, calculate THAT driver's timeline
    // (chains through their active/queued rides → to this pickup)
    else if (ride.status === 'requested') {
      var puLat = parseFloat(ride.puX);
      var puLng = parseFloat(ride.puY);
      if (!puLat || !puLng) return;

      // Use assigned driver if available, otherwise evaluate all
      if (ride.driverId) {
        var assignedDrv = db.users.find(function(u) { return u.id === ride.driverId; });
        if (assignedDrv && assignedDrv.status === 'online') {
          calcDriverETA(assignedDrv, puLat, puLng, function(eta) {
            if (!eta) { if (mn) mn.textContent = '--'; return; }
            var finalETA = Math.max(1, eta);
            if (mn) mn.textContent = finalETA;
            var etaStr = new Date(Date.now() + finalETA * 60000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit'
            });
            if (st) st.textContent = 'Estimated pickup · ETA ' + etaStr;
          });
          return;
        }
      }
      // Fallback: evaluate all online drivers
      calcRealETA(puLat, puLng, function(eta, drvId) {
        if (eta === 0 || eta === null) {
          if (mn) mn.textContent = '--';
          if (st) st.textContent = 'Waiting for available driver...';
          return;
        }
        if (mn) mn.textContent = eta;
        var etaStr = new Date(Date.now() + eta * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit'
        });
        if (st) st.textContent = 'Estimated pickup · ETA ' + etaStr;
      });
    }
  }

  // Run immediately, then every 10 seconds
  _runETA();
  _etaInterval = setInterval(_runETA, 10000);
};

// Stop ETA update loop (called on ride complete/cancel/finish)
window.stopETAUpdates = function() {
  if (_etaInterval) { clearInterval(_etaInterval); _etaInterval = null; }
  window._etaStarted = false;
};

// Get the pre-selected driver ID (used by rideService when creating ride)
window.getBestDriverId = function() {
  return _bestDriverId;
};
