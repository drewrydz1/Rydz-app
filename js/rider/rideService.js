// RYDZ Rider - Ride Service v4
// Finding/confirm screen shows a PREVIEW ETA (no ride created).
// "Request Ride" button commits — that's when the driver is notified.

function _reqRideOrig() {
  if (!db || !db.settings || !db.settings.serviceStatus) return;
  if (typeof stopConfirmETAUpdates === 'function') stopConfirmETAUpdates();

  if (typeof getBestDriverId !== 'function' || !getBestDriverId()) {
    if (typeof showToast === 'function') showToast('No drivers available right now. Please try again later.');
    go('home');
    return;
  }

  var btn = document.getElementById('c-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting...'; }

  if (typeof commitDispatchRide !== 'function') {
    if (btn) { btn.disabled = false; btn.textContent = 'Request Ride'; }
    if (typeof showToast === 'function') showToast('Dispatch unavailable. Please try again.');
    return;
  }

  commitDispatchRide(function(ok) {
    if (!ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'Request Ride'; }
      if (typeof showToast === 'function') showToast('No drivers available right now. Please try again later.');
      return;
    }
    if (typeof ensureRealtimeForActiveRide === 'function') ensureRealtimeForActiveRide();
    go('wait');
  });
}

function cancelRide() {
  if (!arId) return;
  var i = db.rides.findIndex(function(r) { return r.id === arId; });
  if (i >= 0) {
    db.rides[i].status = 'cancelled';
    if (typeof sv === 'function') sv();
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

function _finishRideOrig() {}
