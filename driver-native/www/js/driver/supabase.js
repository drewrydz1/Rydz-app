// RYDZ Driver - Supabase API Layer
// All database read/write operations

// --- Local write tracking (supaSync clobber race guard) ---
// When the driver taps Accept / Picked Up / Dropoff, we mutate db.rides
// locally and fire a PATCH. If a supaSync fetch was already in flight it
// would come back with the OLD row and clobber the local update, making the
// button look like it didn't register. We stamp each local write here so
// supaSync can skip overwriting rides that were touched after its fetch
// started.
var _localRideWrites = {};
function _markLocalRideWrite(rideId) {
  if (!rideId) return;
  _localRideWrites[rideId] = Date.now();
  // Clean up stale entries so the map doesn't grow unbounded.
  setTimeout(function () {
    var t = _localRideWrites[rideId];
    if (t && (Date.now() - t) >= 30000) delete _localRideWrites[rideId];
  }, 30000);
}
window._markLocalRideWrite = _markLocalRideWrite;

function supaSync() {
  var fetchStart = Date.now();
  Promise.all([
    supaFetch('GET', 'users', '?order=created_at.asc'),
    supaFetch('GET', 'rides', '?order=created_at.desc&limit=200'),
    supaFetch('GET', 'settings', '?id=eq.1'),
    supaFetch('GET', 'promotions', '?active=eq.true&order=id.asc')
  ]).then(function (res) {
    var u = res[0], r = res[1], s = res[2], p = res[3];
    if (!u || !r || !s) return;
    if (!p) p = [];
    var st = s[0] || {};
    var mappedRides = r.map(function (x) {
      return {
        id: x.id, riderId: x.rider_id, driverId: x.driver_id,
        pickup: x.pickup, dropoff: x.dropoff,
        puX: x.pu_x, puY: x.pu_y, doX: x.do_x, doY: x.do_y,
        passengers: x.passengers, status: x.status,
        phone: x.phone, note: x.note,
        createdAt: x.created_at, completedAt: x.completed_at
      };
    });
    // Preserve any rides that were locally written after this fetch started —
    // the fetched row is stale relative to the driver's tap.
    var prevRides = (db && db.rides) ? db.rides : [];
    var prevById = {};
    prevRides.forEach(function (pr) { prevById[pr.id] = pr; });
    var finalRides = mappedRides.map(function (row) {
      var writeTs = _localRideWrites[row.id];
      if (writeTs && writeTs >= fetchStart && prevById[row.id]) {
        return prevById[row.id];
      }
      return row;
    });
    // Also carry over any local rides that the server doesn't know about yet
    // (in-flight INSERT races) if they were just written.
    prevRides.forEach(function (pr) {
      if (!finalRides.find(function (fr) { return fr.id === pr.id; })) {
        var writeTs = _localRideWrites[pr.id];
        if (writeTs && writeTs >= fetchStart) finalRides.push(pr);
      }
    });
    db = {
      users: u.map(function (x) {
        return {
          id: x.id, role: x.role, name: x.name,
          firstName: x.first_name, lastName: x.last_name,
          email: x.email, phone: x.phone, password: x.password,
          vehicle: x.vehicle, plate: x.plate, status: x.status,
          lat: x.lat || null, lng: x.lng || null,
          createdAt: x.created_at
        };
      }),
      rides: finalRides,
      settings: {
        serviceStatus: st.service_status !== false,
        maxPassengers: st.max_passengers || 5,
        serviceArea: st.service_area || 'Naples, FL',
        announcements: st.announcements || [],
        hours: st.hours || {},
        promotions: p.map(function (x) {
          return { id: x.id, name: x.name, addr: x.addr, desc: x.description, color: x.color, img: x.img_url || '' };
        })
      },
      tickets: []
    };
    var _isOn = localStorage.getItem('rydz-drv-online') === 'true';
    var _dd = db.users.find(function (x) { return x.id === DID; });
    if (_dd) _dd.status = _isOn ? 'online' : 'offline';
    try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}
    if (cur === 'main') ren();
  }).catch(function () {});
}
function supaSaveUser(u){supaFetch('POST','users','',{id:u.id,role:u.role,name:u.name,first_name:u.firstName,last_name:u.lastName,email:u.email,phone:u.phone,password:u.password,created_at:u.createdAt})}
function supaUpdateUser(u){supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(u.id),{name:u.name,first_name:u.firstName,last_name:u.lastName,email:u.email,phone:u.phone,password:u.password,vehicle:u.vehicle,plate:u.plate,status:u.status,lat:u.lat||null,lng:u.lng||null})}
function supaSaveRide(r){supaFetch('POST','rides','',{id:r.id,rider_id:r.riderId,driver_id:r.driverId,pickup:r.pickup,dropoff:r.dropoff,pu_x:r.puX,pu_y:r.puY,do_x:r.doX,do_y:r.doY,passengers:r.passengers,status:r.status,phone:r.phone,note:r.note,created_at:r.createdAt})}
function supaUpdateRide(id,d){var o={};if(d.status!==undefined)o.status=d.status;if(d.driverId!==undefined)o.driver_id=d.driverId;if(d.picked_up_at!==undefined)o.picked_up_at=d.picked_up_at;if(d.completed_at!==undefined)o.completed_at=d.completed_at;supaFetch('PATCH','rides','?id=eq.'+encodeURIComponent(id),o)}
function supaSaveSettings(s){supaFetch('PATCH','settings','?id=eq.1',{service_status:s.serviceStatus,max_passengers:s.maxPassengers,service_area:s.serviceArea,announcements:s.announcements||[]})}
function supaSaveTicket(t){supaFetch('POST','tickets','',{id:t.id,type:t.type,message:t.message,user_id:t.userId,user_name:t.userName,created_at:t.createdAt})}
