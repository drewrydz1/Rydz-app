// RYDZ Rider - Ride Service v2
// Handles ride request with pre-assigned driver from dispatch engine

// Request ride - confirms draft ride by flipping status to 'requested'
async function _reqRideOrig() {
  if (!db || !db.settings || !db.settings.serviceStatus) return;

  if (typeof stopConfirmETAUpdates === 'function') stopConfirmETAUpdates();

  // Draft ride already exists from dispatch (calcRealETA).
  // Flip to 'requested' so the driver sees it in their queue.
  if (arId) {
    var ride = db.rides.find(function(r) { return r.id === arId; });
    if (ride) {
      ride.status = 'requested';
      try { await sv(); } catch (e) {}
      if (typeof supaUpdateRide === 'function') supaUpdateRide(arId, { status: 'requested' });
    }
    if (typeof ensureRealtimeForActiveRide === 'function') ensureRealtimeForActiveRide();
    go('wait');
    return;
  }

  // Fallback: no draft exists (shouldn't happen in normal flow)
  if (!puSel || !doSel || !curUser) return;
  var assignedDriver = (typeof getBestDriverId === 'function') ? getBestDriverId() : null;
  if (!assignedDriver) {
    if (typeof showToast === 'function') showToast('No drivers available right now. Please try again later.');
    go('home');
    return;
  }

  var puLat = parseFloat(puSel.lat || puSel.x || 0);
  var puLng = parseFloat(puSel.lng || puSel.y || 0);
  var doLat = parseFloat(doSel.lat || doSel.x || 0);
  var doLng = parseFloat(doSel.lng || doSel.y || 0);

  var newRide = {
    id: 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    riderId: curUser.id,
    pickup: puSel.n || puSel.a || 'Pickup',
    dropoff: doSel.n || doSel.a || 'Dropoff',
    puX: puLat, puY: puLng, doX: doLat, doY: doLng,
    passengers: pass || 1, status: 'requested',
    driverId: assignedDriver,
    phone: curUser.phone || null,
    note: (document.getElementById('f-note') || {}).value || '',
    createdAt: Date.now(), completedAt: null
  };

  db.rides.push(newRide);
  try { await sv(); } catch (e) {}
  supaSaveRide(newRide);
  arId = newRide.id;
  try { localStorage.setItem('rydz-active-ride', newRide.id); } catch (e) {}
  if (typeof ensureRealtimeForActiveRide === 'function') ensureRealtimeForActiveRide();
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
  if (typeof unsubscribeAll === 'function') unsubscribeAll();
  go('home');
}

// Confirm screen - displays ETA from driver's MapKit via dispatch
function updConf() {
  if (!puSel || !doSel) return;
  document.getElementById('c-pu').textContent = puSel.n || 'Pickup';
  document.getElementById('c-do').textContent = doSel.n || 'Drop-off';
  var minEl = document.getElementById('c-min');
  var etaEl = document.getElementById('c-eta');
  var btn = document.getElementById('c-btn');

  var hasDriver = (typeof getBestDriverId === 'function') && getBestDriverId();
  var eta = window._rideETA;

  if (!hasDriver) {
    if (minEl) minEl.textContent = '--';
    if (etaEl) etaEl.textContent = 'No drivers available right now';
    if (btn) btn.disabled = true;
    return;
  }

  if (eta && eta > 0) {
    var etaTime = new Date(Date.now() + eta * 60000);
    var etaStr = etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (minEl) minEl.textContent = eta + ' min';
    if (etaEl) etaEl.textContent = 'Estimated pickup: ' + etaStr;
    if (btn) btn.disabled = false;
  } else {
    if (minEl) minEl.textContent = '--';
    if (etaEl) etaEl.textContent = 'Calculating arrival time...';
    if (btn) btn.disabled = false;
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
