// RYDZ Rider - Ride State v3
// Wait screen: pre-accept hides driver, post-accept shows car icon
// No route lines from driver, solid pickup-dropoff line, smooth performance

function updWait() {
  if (cur !== 'wait' || !arId) return;

  var ride = db.rides.find(function(r) { return r.id === arId; });
  if (!ride) return;

  // === STATUS TRANSITIONS ===
  if (ride.status === 'completed') {
    window._etaStarted = false;
    window._waitMapDrawn = false;
    go('complete');
    return;
  }

  if (ride.status === 'cancelled') {
    window._etaStarted = false;
    window._waitMapDrawn = false;
    arId = null;
    if (typeof showToast === 'function') {
      showToast('Your ride was declined by the driver. Please request a new ride.');
    }
    go('home');
    return;
  }

  // === UPDATE SCREEN CONTENT ===
  document.getElementById('w-pu').textContent = ride.pickup;
  document.getElementById('w-do').textContent = ride.dropoff;
  document.getElementById('w-p1').textContent = 'PICKUP';
  document.getElementById('w-p2').textContent = 'DROP-OFF';

  // Draw map ONCE - don't redraw on every poll (causes snap-back)
  if (!window._waitMapDrawn) {
    window._waitMapDrawn = true;
    drawMap(document.getElementById('w-map'), {
      pu: { x: ride.puX, y: ride.puY, lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) },
      d: { x: ride.doX, y: ride.doY, lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
    });
  }

  var t = document.getElementById('w-t');
  var st = document.getElementById('w-st');
  var it = document.getElementById('w-it');
  var mn = document.getElementById('w-mn');
  var dc = document.getElementById('w-dc');

  // === PRE-ACCEPT: Hide driver info ===
  if (ride.status === 'requested') {
    t.textContent = 'Ride Requested';
    it.textContent = 'Waiting for your driver to accept.';
    dc.classList.add('hidden');

    if (window._rideETA && mn) {
      mn.textContent = window._rideETA;
      var etaStr = new Date(Date.now() + window._rideETA * 60000).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit'
      });
      st.textContent = 'Estimated pickup: ' + etaStr;
    } else {
      st.textContent = 'Finding your driver...';
    }
    return; // Don't show driver anything pre-accept
  }

  // === POST-ACCEPT: Show driver info ===
  if (ride.driverId) {
    var drv = db.users.find(function(u) { return u.id === ride.driverId; });
    if (drv) {
      dc.classList.remove('hidden');
      document.getElementById('w-di').textContent = (drv.name || 'D')[0];
      document.getElementById('w-dn').textContent = drv.name || 'Driver';
      document.getElementById('w-dv').textContent = ((drv.vehicle || '') + ' ' + (drv.plate || '')).trim();
    }
  }

  if (ride.status === 'accepted' || ride.status === 'en_route') {
    t.textContent = 'Driver On The Way';
    it.textContent = 'Your driver is approaching.';
    // ETA = driver current location -> pickup address (updated every poll)
    _calcDriverToPickupETA(ride, mn, st);
  }

  else if (ride.status === 'arrived') {
    t.textContent = 'Driver Arrived';
    st.textContent = 'Your driver is at the pickup!';
    it.textContent = 'Meet your driver now.';
    if (mn) mn.textContent = '0';
  }

  else if (ride.status === 'picked_up') {
    t.textContent = 'Heading to Drop-off';
    it.textContent = 'Enjoy your ride!';
    // ETA = driver current location -> dropoff address
    _calcDriverToDestETA(ride, mn, st);
  }

  // Update driver marker on map (car icon, no route)
  if (typeof updateDriverOnMap === 'function') updateDriverOnMap();
}

// Google Maps ETA - combines instant haversine estimate with DistanceMatrix refinement
// Haversine updates every poll cycle; DistanceMatrix refines every 10s
var _lastETACall = 0;
var _lastETAStatus = null;
var _roadFactor = 3.2; // minutes per straight-line mile (calibrated by DistanceMatrix)

function _googleETA(drvLat, drvLng, destLat, destLng, mnEl, stEl, label, rideStatus) {
  // Reset on status change
  if (rideStatus && rideStatus !== _lastETAStatus) {
    _lastETACall = 0;
    _lastETAStatus = rideStatus;
  }

  // Always calculate instant estimate from distance (updates every poll)
  var dist = _haversine(drvLat, drvLng, destLat, destLng);
  var mins = Math.max(1, Math.round(dist * _roadFactor));
  if (dist < 0.05) mins = 1; // very close

  // Update display immediately
  if (mnEl) mnEl.textContent = mins;
  var etaStr = new Date(Date.now() + mins * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (stEl) stEl.textContent = label + mins + ' min · ETA ' + etaStr;

  // Refine with Google DistanceMatrix every 10 seconds
  var now = Date.now();
  if (now - _lastETACall < 10000) return;
  _lastETACall = now;

  if (typeof google === 'undefined' || !google.maps) return;

  try {
    var svc = new google.maps.DistanceMatrixService();
    svc.getDistanceMatrix({
      origins: [{ lat: drvLat, lng: drvLng }],
      destinations: [{ lat: destLat, lng: destLng }],
      travelMode: 'DRIVING'
    }, function(res, status) {
      if (status !== 'OK' || !res.rows || !res.rows[0] || !res.rows[0].elements || !res.rows[0].elements[0]) return;
      var el = res.rows[0].elements[0];
      if (el.status !== 'OK' || !el.duration) return;

      var secs = el.duration.value;
      var gMins = Math.max(1, Math.ceil(secs / 60));

      // Calibrate road factor for future instant estimates
      if (dist > 0.1) {
        _roadFactor = gMins / dist;
      }

      // Apply the refined value
      if (mnEl) mnEl.textContent = gMins;
      var eta2 = new Date(Date.now() + gMins * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (stEl) stEl.textContent = label + gMins + ' min · ETA ' + eta2;
    });
  } catch (e) {}
}

// Haversine distance in miles
function _haversine(lat1, lng1, lat2, lng2) {
  var R = 3959;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Driver -> Pickup ETA
function _calcDriverToPickupETA(ride, mnEl, stEl) {
  var drv = db.users.find(function(u) { return u.id === ride.driverId; });
  if (!drv || !drv.lat || !drv.lng) {
    // No GPS yet — show estimate based on dispatch ETA if available
    if (window._rideETA && mnEl && mnEl.textContent === '') mnEl.textContent = window._rideETA;
    return;
  }
  var puLat = parseFloat(ride.puX), puLng = parseFloat(ride.puY);
  if (!puLat || !puLng) return;
  _googleETA(parseFloat(drv.lat), parseFloat(drv.lng), puLat, puLng, mnEl, stEl, 'Arriving in ', ride.status);
}

// Driver -> Dropoff ETA
function _calcDriverToDestETA(ride, mnEl, stEl) {
  var drv = db.users.find(function(u) { return u.id === ride.driverId; });
  if (!drv || !drv.lat || !drv.lng) return;
  var doLat = parseFloat(ride.doX), doLng = parseFloat(ride.doY);
  if (!doLat || !doLng) return;
  _googleETA(parseFloat(drv.lat), parseFloat(drv.lng), doLat, doLng, mnEl, stEl, '', ride.status);
}

// === HOME SCREEN ===
function updHome() {
  if (db) document.getElementById('h-area').textContent = db.settings.serviceArea;
  chkBtn();
  updAlerts();
}

function updAlerts() {
  var el = document.getElementById('alerts');
  if (!el || !db) return;
  var h = '';
  if (!db.settings.serviceStatus) {
    h += '<div class="alert alert-r"><svg width="14" height="14" fill="none" stroke="var(--rd)" stroke-width="2"><circle cx="7" cy="7" r="6"/><path d="M7 9V7M7 5h.01"/></svg>Service is currently unavailable</div>';
  }
  var a = (db.settings.announcements || [])[0];
  if (a && db.settings.serviceStatus) {
    h += '<div class="alert alert-b"><svg width="14" height="14" fill="none" stroke="var(--bl)" stroke-width="2"><path d="M11 5A4 4 0 003 5c0 4.5-2 6-2 6h12S11 9.5 11 5"/></svg>' + esc(a) + '</div>';
  }
  el.innerHTML = h;
  chkBtn();
}

// === PASSENGER SCREEN ===
function updPass() {
  document.getElementById('p-n').textContent = pass;
  document.getElementById('p-mx').textContent = db.settings.maxPassengers;
}

function chP(d) {
  pass = Math.max(1, Math.min(db.settings.maxPassengers, pass + d));
  document.getElementById('p-n').textContent = pass;
}

// === OVERVIEW SCREEN ===
function updOv() {
  if (!puSel || !doSel) return;
  var pl = pass + ' passenger' + (pass > 1 ? 's' : '');
  document.getElementById('o-pu').textContent = puSel.n;
  document.getElementById('o-do').textContent = doSel.n;
  document.getElementById('o-p1').textContent = 'PICKUP';
  document.getElementById('o-p2').textContent = 'DROP-OFF';
  document.getElementById('o-pl').textContent = pl;
  drawMap(document.getElementById('ov-map'), { pu: puSel, d: doSel });
}
