// RYDZ Rider - Realtime Subscriptions
// Replaces polling-based status detection with instant WebSocket updates from
// Supabase Realtime. The 5-second supaSync still runs as a safety net, so if
// the WebSocket drops, the app stays correct within 5s instead of silently
// falling behind forever.
//
// Two channels:
//   1. rides table, filtered to the active ride id → status transitions
//      (requested → accepted → en_route → arrived → picked_up → completed)
//   2. users table, filtered to the assigned driver id → lat/lng/status
//      updates so the driver marker on the map moves in real time.

var _rtRideCh = null;
var _rtDrvCh = null;
var _rtCurrentRideId = null;
var _rtCurrentDriverId = null;

function _rtInit() {
  return (typeof getRealtimeClient === 'function') ? getRealtimeClient() : null;
}

function subscribeToRide(rideId) {
  if (!rideId) return;
  if (_rtCurrentRideId === rideId && _rtRideCh) return;
  var client = _rtInit();
  if (!client) return;
  unsubscribeRide();
  _rtCurrentRideId = rideId;
  try {
    _rtRideCh = client
      .channel('rider-ride-' + rideId)
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rides', filter: 'id=eq.' + rideId },
          function (payload) { _rtOnRideUpdate(payload); })
      .subscribe();
  } catch (e) {
    console.error('[realtime] subscribeToRide', e);
  }
}

function subscribeToDriver(driverId) {
  if (!driverId) return;
  if (_rtCurrentDriverId === driverId && _rtDrvCh) return;
  var client = _rtInit();
  if (!client) return;
  unsubscribeDriver();
  _rtCurrentDriverId = driverId;
  try {
    _rtDrvCh = client
      .channel('rider-drv-' + driverId)
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: 'id=eq.' + driverId },
          function (payload) { _rtOnDriverUpdate(payload); })
      .subscribe();
  } catch (e) {
    console.error('[realtime] subscribeToDriver', e);
  }
}

function unsubscribeRide() {
  var _c = _rtInit();
  if (_rtRideCh && _c) {
    try { _c.removeChannel(_rtRideCh); } catch (e) {}
  }
  _rtRideCh = null;
  _rtCurrentRideId = null;
}

function unsubscribeDriver() {
  var _c2 = _rtInit();
  if (_rtDrvCh && _c2) {
    try { _c2.removeChannel(_rtDrvCh); } catch (e) {}
  }
  _rtDrvCh = null;
  _rtCurrentDriverId = null;
}

function unsubscribeAll() {
  unsubscribeRide();
  unsubscribeDriver();
}

// Maps a raw Supabase ride row (snake_case) into the local db shape (camelCase)
function _rtMapRide(row) {
  return {
    id: row.id,
    riderId: row.rider_id,
    driverId: row.driver_id,
    pickup: row.pickup,
    dropoff: row.dropoff,
    puX: row.pu_x,
    puY: row.pu_y,
    doX: row.do_x,
    doY: row.do_y,
    passengers: row.passengers,
    status: row.status,
    phone: row.phone,
    note: row.note,
    // MapKit ETA published by the driver iPhone. Post-accept this is the
    // source of truth for the wait-screen countdown.
    driverEtaSecs: row.driver_eta_secs,
    driverEtaUpdatedAt: row.driver_eta_updated_at,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function _rtOnRideUpdate(payload) {
  var row = payload && payload.new;
  if (!row || !db || !db.rides) return;
  var mapped = _rtMapRide(row);
  var idx = db.rides.findIndex(function (r) { return r.id === row.id; });
  if (idx >= 0) db.rides[idx] = mapped;
  else db.rides.push(mapped);
  try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}

  // First time a driver is assigned → start listening for that driver's updates
  if (mapped.driverId && _rtCurrentDriverId !== mapped.driverId) {
    subscribeToDriver(mapped.driverId);
  }

  // Trigger re-render of the wait screen
  if (cur === 'wait' && typeof updWait === 'function') updWait();
}

function _rtOnDriverUpdate(payload) {
  var row = payload && payload.new;
  if (!row || !db || !db.users) return;
  var idx = db.users.findIndex(function (u) { return u.id === row.id; });
  if (idx >= 0) {
    db.users[idx].lat = row.lat;
    db.users[idx].lng = row.lng;
    db.users[idx].status = row.status;
    db.users[idx].vehicle = row.vehicle;
    db.users[idx].plate = row.plate;
  }
  try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}
  if (typeof updateDriverOnMap === 'function') updateDriverOnMap();
  if (cur === 'wait' && typeof updWait === 'function') updWait();
}

// Called from anywhere that has an active arId. Idempotent — safe to call
// repeatedly; re-subscribing to the same ride is a no-op.
function ensureRealtimeForActiveRide() {
  if (!arId) { unsubscribeAll(); return; }
  subscribeToRide(arId);
  if (db && db.rides) {
    var r = db.rides.find(function (x) { return x.id === arId; });
    if (r && r.driverId) subscribeToDriver(r.driverId);
  }
}

// Force tear-down and rebuild all rider realtime subscriptions.
// Called on app resume from background — iOS kills WebSockets silently.
function resubscribeRiderRealtime() {
  unsubscribeAll();
  if (typeof reconnectRealtimeClient === 'function') reconnectRealtimeClient();
  _rtCurrentRideId = null;
  _rtCurrentDriverId = null;
  ensureRealtimeForActiveRide();
}
