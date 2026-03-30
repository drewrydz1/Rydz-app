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
    go('complete');
    return;
  }

  if (ride.status === 'cancelled') {
    window._etaStarted = false;
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

  // Draw map with pickup and dropoff pins (no blinking dashed line)
  drawMap(document.getElementById('w-map'), {
    pu: { x: ride.puX, y: ride.puY, lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) },
    d: { x: ride.doX, y: ride.doY, lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
  });

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

// Haversine helper
function _haversineMin(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var km = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  // 25 km/h avg Naples speed, 1.4x road winding factor, +1 min buffer
  return Math.max(1, Math.ceil((km * 1.4 / 25) * 60)) + 1;
}

// Driver current location -> Pickup address ETA
function _calcDriverToPickupETA(ride, mnEl, stEl) {
  var drv = db.users.find(function(u) { return u.id === ride.driverId; });
  if (!drv || !drv.lat || !drv.lng) return;
  var puLat = parseFloat(ride.puX), puLng = parseFloat(ride.puY);
  if (!puLat || !puLng) return;
  var mins = _haversineMin(parseFloat(drv.lat), parseFloat(drv.lng), puLat, puLng);
  if (mnEl) mnEl.textContent = mins;
  var etaStr = new Date(Date.now() + mins * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (stEl) stEl.textContent = 'Arriving in ' + mins + ' min · ETA ' + etaStr;
}

// Driver current location -> Dropoff address ETA (during ride)
function _calcDriverToDestETA(ride, mnEl, stEl) {
  var drv = db.users.find(function(u) { return u.id === ride.driverId; });
  if (!drv || !drv.lat || !drv.lng) return;
  var doLat = parseFloat(ride.doX), doLng = parseFloat(ride.doY);
  if (!doLat || !doLng) return;
  var mins = _haversineMin(parseFloat(drv.lat), parseFloat(drv.lng), doLat, doLng);
  if (mnEl) mnEl.textContent = mins;
  var etaStr = new Date(Date.now() + mins * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (stEl) stEl.textContent = mins + ' min to drop-off · ETA ' + etaStr;
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
