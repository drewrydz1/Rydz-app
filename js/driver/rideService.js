// RYDZ Driver - Ride Service v2
// Ride queries, accept, decline, status updates

// Send SMS via Supabase Edge Function
function _sendSMS(phone, status, driverName) {
  if (!phone) return;
  fetch(SUPA_URL + '/functions/v1/bright-responder', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
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
  if (st === 'completed') { r.completedAt = Date.now(); }
  await sv();
  var upd = { status: st };
  if (st === 'picked_up') { upd.picked_up_at = new Date().toISOString(); }
  if (st === 'completed') { upd.completed_at = new Date().toISOString(); }
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
  await sv();
  supaUpdateRide(r.id, { status: 'cancelled' });
  showToast('Ride declined');
  ren();
}
