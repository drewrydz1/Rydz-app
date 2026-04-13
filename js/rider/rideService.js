// RYDZ Rider - Ride Service v2
// Handles ride request with pre-assigned driver from dispatch engine

// Request ride - creates ride in Supabase with driver pre-assigned
async function _reqRideOrig() {
  if (!db || !db.settings || !db.settings.serviceStatus) return;
  if (!puSel || !doSel || !curUser) return;

  var puLat = parseFloat(puSel.lat || puSel.x || 0);
  var puLng = parseFloat(puSel.lng || puSel.y || 0);
  var doLat = parseFloat(doSel.lat || doSel.x || 0);
  var doLng = parseFloat(doSel.lng || doSel.y || 0);

  // Get the pre-selected driver from dispatch engine
  var assignedDriver = (typeof getBestDriverId === 'function') ? getBestDriverId() : null;

  // Block ride creation if no driver is available
  if (!assignedDriver) {
    if (typeof showToast === 'function') showToast('No drivers available right now. Please try again later.');
    go('home');
    return;
  }

  var ride = {
    id: 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    riderId: curUser.id,
    pickup: puSel.n || puSel.a || 'Pickup',
    dropoff: doSel.n || doSel.a || 'Dropoff',
    puX: puLat,
    puY: puLng,
    doX: doLat,
    doY: doLng,
    passengers: pass || 1,
    status: 'requested',
    driverId: assignedDriver, // PRE-ASSIGNED from dispatch
    phone: curUser.phone || null,
    note: (document.getElementById('f-note') || {}).value || '',
    createdAt: Date.now(),
    completedAt: null
  };

  db.rides.push(ride);
  try { await sv(); } catch (e) {}

  // Save to Supabase with the assigned driver
  var body = {
    id: ride.id,
    rider_id: ride.riderId,
    driver_id: assignedDriver, // This driver will see it in their queue
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    pu_x: puLat,
    pu_y: puLng,
    do_x: doLat,
    do_y: doLng,
    passengers: ride.passengers,
    status: 'requested',
    phone: ride.phone || null,
    note: ride.note || '',
    created_at: new Date(ride.createdAt).toISOString()
  };

  try {
    var res = await fetch(SUPA_URL + '/rest/v1/rides', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var t = await res.text();
      logError('_reqRideOrig', 'Ride save failed: ' + res.status + ' ' + t);
      return;
    }
  } catch (err) {
    logError('_reqRideOrig', 'Network error: ' + err);
    return;
  }

  arId = ride.id;
  try { localStorage.setItem('rydz-active-ride', ride.id); } catch (e) {}
  go('wait');
}

// Cancel ride - rider cancels from wait screen
async function cancelRide() {
  if (!arId) return;
  var i = db.rides.findIndex(function(r) { return r.id === arId; });
  if (i >= 0) {
    db.rides[i].status = 'cancelled';
    await sv();
    supaUpdateRide(db.rides[i].id, { status: 'cancelled' });
  }
  if (typeof stopETAUpdates === 'function') stopETAUpdates();
  if (typeof clearMapOverlays === 'function') {
    clearMapOverlays('w-map');
    clearMapOverlays('ov-map');
  }
  window._waitMapDrawn = false;
  window._etaStarted = false;
  try { localStorage.removeItem('rydz-active-ride'); } catch (e) {}
  arId = null;
  go('home');
}

// Confirm screen - displays the pre-calculated ETA from dispatch
function updConf() {
  if (!puSel || !doSel) return;
  document.getElementById('c-pu').textContent = puSel.n || 'Pickup';
  document.getElementById('c-do').textContent = doSel.n || 'Drop-off';
  var minEl = document.getElementById('c-min');
  var etaEl = document.getElementById('c-eta');

  var eta = window._rideETA;

  if (eta === 0 || eta === null) {
    if (minEl) minEl.textContent = '--';
    if (etaEl) etaEl.textContent = 'No drivers available right now';
    document.getElementById('c-btn').disabled = true;
    return;
  }

  if (eta && eta > 0) {
    var now = new Date();
    var etaTime = new Date(now.getTime() + eta * 60000);
    var etaStr = etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (minEl) minEl.textContent = eta + ' min';
    if (etaEl) etaEl.textContent = 'Estimated pickup: ' + etaStr;
    document.getElementById('c-btn').disabled = false;
  } else {
    if (minEl) minEl.textContent = '--';
    if (etaEl) etaEl.textContent = 'Please try again later';
    document.getElementById('c-btn').disabled = true;
  }
}

// Original tryGo - validates selections before proceeding
function _tryGoOrig() {
  if (!puSel) {
    document.getElementById('pu-fd').classList.add('err');
    setTimeout(function() { document.getElementById('pu-fd').classList.remove('err'); }, 400);
    return;
  }
  if (!doSel) {
    document.getElementById('do-fd').classList.add('err');
    setTimeout(function() { document.getElementById('do-fd').classList.remove('err'); }, 400);
    return;
  }
  go('pass');
}

// Dead stub - finishRide is handled by feedback.js (enhancement)
function _finishRideOrig() {}
