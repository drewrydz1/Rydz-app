// RYDZ Driver - Realtime Subscriptions
// Listens for incoming ride requests and active-ride updates via Supabase
// Realtime (WebSocket) instead of waiting for the 5-second poll. Makes new
// requests pop instantly and rider-side cancellations propagate live. The
// existing poll() + supaSync() loops still run as a safety net, so a dropped
// socket never leaves the driver blind for more than 5 seconds.
//
// One channel per logged-in driver:
//   rides table, filtered to driver_id=eq.<DID>, event=*
//   → catches INSERT (new request pre-assigned to this driver),
//     UPDATE (status transitions, rider cancel), and DELETE.

var _drvRtClient = null;
var _drvRtRidesCh = null;
var _drvRtSubscribedDID = null;

function _drvRtInit() {
  if (_drvRtClient) return _drvRtClient;
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('[realtime] @supabase/supabase-js not loaded — falling back to polling');
    return null;
  }
  try {
    _drvRtClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } catch (e) {
    console.error('[realtime] init failed', e);
    return null;
  }
  return _drvRtClient;
}

// snake_case ride row → camelCase local shape. Must match the mapping in
// driver/supabase.js supaSync() so the in-memory db stays consistent whether
// a ride came in via poll or via realtime.
function _drvRtMapRide(row) {
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
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function _drvRtOnRideChange(payload) {
  if (!payload || !db || !db.rides) return;
  var evt = payload.eventType || payload.type;
  var row = payload.new || payload.old;
  if (!row) return;
  var id = row.id;
  var idx = db.rides.findIndex(function (r) { return r.id === id; });

  if (evt === 'DELETE') {
    if (idx >= 0) db.rides.splice(idx, 1);
  } else {
    var mapped = _drvRtMapRide(payload.new || row);
    // Drop finished rides from the in-memory queue to match init.js load-time
    // filtering — the driver's queue only holds live work.
    if (mapped.status === 'completed' || mapped.status === 'cancelled') {
      if (idx >= 0) db.rides.splice(idx, 1);
    } else if (idx >= 0) {
      db.rides[idx] = mapped;
    } else {
      db.rides.push(mapped);
    }
  }

  try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}

  // Re-render the main screen (queue card, active ride card) and kick the
  // notification nag loop so a new request starts chiming immediately.
  if (cur === 'main' && typeof ren === 'function') ren();
  if (typeof checkPendingRides === 'function') {
    try { checkPendingRides(); } catch (e) {}
  }
  // Push fresh ride state into the native location plugin so MapKit ETA
  // recomputes immediately on status transitions instead of waiting for
  // the next GPS tick.
  if (typeof _syncRideToPlugin === 'function') {
    try { _syncRideToPlugin(); } catch (e) {}
  }
}

// Idempotent — safe to call repeatedly. Re-subscribing with the same DID
// is a no-op.
function subscribeDriverRealtime() {
  if (typeof DID === 'undefined' || !DID) return;
  if (_drvRtSubscribedDID === DID && _drvRtRidesCh) return;
  if (!_drvRtInit()) return;
  unsubscribeDriverRealtime();
  _drvRtSubscribedDID = DID;
  try {
    _drvRtRidesCh = _drvRtClient
      .channel('driver-rides-' + DID)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'rides', filter: 'driver_id=eq.' + DID },
          function (payload) { _drvRtOnRideChange(payload); })
      .subscribe();
  } catch (e) {
    console.error('[realtime] subscribeDriverRealtime', e);
  }
}

function unsubscribeDriverRealtime() {
  if (_drvRtRidesCh && _drvRtClient) {
    try { _drvRtClient.removeChannel(_drvRtRidesCh); } catch (e) {}
  }
  _drvRtRidesCh = null;
  _drvRtSubscribedDID = null;
}

// Force tear-down and rebuild of the entire realtime connection. Call this
// when the app resumes from background or when a push arrives, because iOS
// often kills the underlying WebSocket during background and leaves us with
// a zombie subscription that never delivers events.
function resubscribeDriverRealtime() {
  unsubscribeDriverRealtime();
  if (_drvRtClient) {
    try {
      if (_drvRtClient.realtime && _drvRtClient.realtime.disconnect) {
        _drvRtClient.realtime.disconnect();
      }
    } catch (e) {}
    _drvRtClient = null;
  }
  subscribeDriverRealtime();
}
