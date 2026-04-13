// RYDZ Rider - Ride State v4
// Wait screen: pre-accept hides driver, post-accept shows car icon
// ETA handled by dispatch.js startETAUpdates() for all phases

function updWait() {
  if (cur !== 'wait' || !arId) return;

  var ride = db.rides.find(function(r) { return r.id === arId; });
  if (!ride) return;

  // === STATUS TRANSITIONS ===
  if (ride.status === 'completed') {
    if (typeof stopETAUpdates === 'function') stopETAUpdates();
    window._waitMapDrawn = false;
    window._etaStarted = false;
    go('complete');
    return;
  }

  if (ride.status === 'cancelled') {
    if (typeof stopETAUpdates === 'function') stopETAUpdates();
    if (typeof clearMapOverlays === 'function') {
      clearMapOverlays('w-map');
      clearMapOverlays('ov-map');
    }
    window._waitMapDrawn = false;
    window._etaStarted = false;
    try { localStorage.removeItem('rydz-active-ride'); } catch (e) {}
    arId = null;
    if (typeof showToast === 'function') {
      showToast('Your ride was declined by the driver. Please request a new ride.');
    }
    go('home');
    return;
  }

  // === START ETA UPDATES (once) ===
  if (!window._etaStarted && typeof startETAUpdates === 'function') {
    window._etaStarted = true;
    startETAUpdates();
  }

  // === UPDATE SCREEN CONTENT ===
  document.getElementById('w-pu').textContent = ride.pickup;
  document.getElementById('w-do').textContent = ride.dropoff;

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
    dc.classList.add('hidden');
    it.textContent = 'Drivers are currently finishing other rides.';
    // ETA is managed by startETAUpdates() in dispatch.js
    // It recalculates full driver timeline every 5 seconds
    return;
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
    // ETA managed by startETAUpdates() — uses live GPS
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
    // ETA managed by startETAUpdates() — uses live GPS to dropoff
  }

  // Update driver marker on map (car icon, no route)
  if (typeof updateDriverOnMap === 'function') updateDriverOnMap();
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
  document.getElementById('o-pl').textContent = pl;
  drawMap(document.getElementById('ov-map'), { pu: puSel, d: doSel });
}
