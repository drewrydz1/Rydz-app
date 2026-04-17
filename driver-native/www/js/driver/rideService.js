// RYDZ Driver - Ride Service v2
// Ride queries, accept, decline, status updates

// Brief WebAudio chime for key ride events (no audio assets required).
// Must be triggered from a user gesture so iOS WebKit unlocks audio.
function _playChime(type) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = window._rydzAudio || (window._rydzAudio = new AC());
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    var notes;
    if (type === 'accept') {
      // Rising success arpeggio: C5 -> E5 -> G5
      notes = [[523.25, 0.00], [659.25, 0.10], [783.99, 0.20]];
    } else if (type === 'dropoff') {
      // Descending resolve: G5 -> E5 -> C5 (longer tail)
      notes = [[783.99, 0.00], [659.25, 0.14], [523.25, 0.28]];
    } else {
      return;
    }
    var now = ctx.currentTime;
    notes.forEach(function(n) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n[0];
      var t0 = now + n[1];
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });
  } catch (e) {}
}

// Send SMS via Supabase Edge Function
function _sendSMS(phone, status, driverName) {
  if (!phone) return;
  fetch(SUPA_URL + '/functions/v1/bright-responder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
    body: JSON.stringify({ phone: phone, status: status, driverName: driverName || '' })
  }).catch(function(e) { console.error('SMS error:', e); });
}

function _getRidePhone(r) {
  if (r.phone) return r.phone;
  if (r.riderId) {
    var rider = db.users.find(function(u) { return u.id === r.riderId; });
    if (rider && rider.phone) return rider.phone;
  }
  return null;
}

// Get current driver's user record
function gD() {
  return db ? db.users.find(function(u) { return u.id === DID; }) : null;
}

// Get current driver's active ride (accepted/en_route/arrived/picked_up)
function gMR() {
  return db ? db.rides.find(function(r) {
    return r.driverId === DID &&
      ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
  }) : null;
}

// Get incoming ride requests assigned to THIS driver
// Only shows rides with status 'requested' and driver_id matching this driver
function gIn() {
  if (!db) return [];
  var list = db.rides.filter(function(r) {
    return r.status === 'requested' && r.driverId === DID;
  });
  // FIFO: oldest request first (first come, first served)
  list.sort(function(a, b) {
    var ta = 0, tb = 0;
    if (a.createdAt) ta = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime() || 0;
    if (b.createdAt) tb = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime() || 0;
    return ta - tb; // ascending: oldest (smallest timestamp) first
  });
  return list;
}

// Accept a ride - driver taps Accept button
async function acc(rid) {
  var _q = gIn();
  if (_q.length > 0 && _q[0].id !== rid) {
    showToast('You must complete current requests in order.');
    return;
  }
  var _ab = document.querySelectorAll('.btn-s');
  _ab.forEach(function(b) { b.disabled = true; b.textContent = 'Accepting...'; });

  var r = db.rides.find(function(x) { return x.id === rid; });
  if (!r) return;
  r.status = 'accepted';
  r.driverId = DID;
  _markLocalRideWrite(r.id);
  _playChime('accept');
  await sv();
  supaUpdateRide(r.id, { status: 'accepted', driverId: DID });

  // Send current GPS with acceptance
  var _me = gD();
  if (_me && _me.lat) {
    supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: _me.lat, lng: _me.lng });
  }
  ren();
}

// Update ride status (en_route, arrived, picked_up, completed)
async function upSt(st) {
  var r = gMR();
  if (!r) return;
  r.status = st;
  if (st === 'picked_up') { r.pickedUpAt = Date.now(); }
  if (st === 'completed') { r.completedAt = Date.now(); _playChime('dropoff'); }
  _markLocalRideWrite(r.id);
  await sv();
  var upd = { status: st };
  if (st === 'picked_up') { upd.picked_up_at = new Date().toISOString(); }
  if (st === 'completed') { upd.completed_at = new Date().toISOString(); }
  // Invalidate the previous ETA as part of the same PATCH that flips the
  // status. Without this, the rider briefly sees the stale 'arrived' ETA
  // (0 seconds) on the Heading-to-Drop-off screen until Swift's MapKit
  // publishes a fresh value. Swift repopulates within ~1s.
  if (st === 'picked_up' || st === 'en_route' || st === 'accepted') {
    upd.driver_eta_secs = null;
    upd.driver_eta_updated_at = null;
  }
  supaUpdateRide(r.id, upd);

  // Send SMS for key status changes
  if (['en_route', 'arrived', 'completed'].indexOf(st) >= 0) {
    _sendSMS(_getRidePhone(r), st, gD() ? gD().name : '');
  }

  // Update GPS on status change
  var _me2 = gD();
  if (_me2 && _me2.lat && _me2.lng) {
    supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(DID), { lat: _me2.lat, lng: _me2.lng });
  }
  ren();
}

// Decline a ride - cancels it so rider gets notified
async function decRide(rid) {
  var r = db.rides.find(function(x) { return x.id === rid; });
  if (!r) return;
  r.status = 'cancelled';
  _markLocalRideWrite(r.id);
  await sv();
  supaUpdateRide(r.id, { status: 'cancelled' });
  showToast('Ride declined');
  ren();
}

// Driver confirms before declining an incoming request
function confirmDecline(rid) {
  if (confirm('Decline this ride request?\n\nThe rider will be notified and will need to request a new ride.')) {
    decRide(rid);
  }
}

// Driver cancels an active ride mid-trip (accepted / arrived / picked_up)
async function cancelActiveRide() {
  var r = gMR();
  if (!r) return;
  if (!confirm('Cancel this active ride?\n\nThe rider will be notified and the ride will end immediately.')) return;
  r.status = 'cancelled';
  _markLocalRideWrite(r.id);
  await sv();
  supaUpdateRide(r.id, { status: 'cancelled' });
  showToast('Ride cancelled');
  ren();
}
