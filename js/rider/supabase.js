// RYDZ Rider - Supabase API Layer

function supaSync() {
  Promise.all([
    supaFetch('GET', 'users', '?order=created_at.asc'),
    supaFetch('GET', 'rides', '?order=created_at.desc&limit=200'),
    supaFetch('GET', 'settings', '?id=eq.1'),
    supaFetch('GET', 'promotions', '?is_active=eq.true&order=slot_index.asc')
  ]).then(function(res) {
    var u = res[0], r = res[1], s = res[2], p = res[3];
    if (!u || !r || !s) return;
    if (!p) p = [];
    var st = s[0] || {};
    // Snapshot the previous rides array BEFORE we rebuild db. We use this
    // below to preserve fresher realtime-sourced ETA values for the active
    // ride when the 5s batch fetch returns slightly stale data.
    var _prevRides = (typeof db !== 'undefined' && db && db.rides) ? db.rides : [];
    db = {
      users: u.map(function(x) {
        return {
          id: x.id, role: x.role, name: x.name, firstName: x.first_name,
          lastName: x.last_name, email: x.email, phone: x.phone,
          password: x.password, vehicle: x.vehicle, plate: x.plate,
          status: x.status, lat: x.lat || null, lng: x.lng || null,
          disabled: !!x.disabled, createdAt: x.created_at
        };
      }),
      rides: r.map(function(x) {
        var mapped = {
          id: x.id, riderId: x.rider_id, driverId: x.driver_id,
          pickup: x.pickup, dropoff: x.dropoff,
          puX: x.pu_x, puY: x.pu_y, doX: x.do_x, doY: x.do_y,
          passengers: x.passengers, status: x.status,
          phone: x.phone, note: x.note,
          // MapKit ETA published by the driver iPhone on every GPS tick.
          // This is what drives the rider's wait-screen countdown — no
          // Google Directions calls post-accept.
          driverEtaSecs: x.driver_eta_secs,
          driverEtaUpdatedAt: x.driver_eta_updated_at,
          createdAt: x.created_at, completedAt: x.completed_at
        };
        // Clobber guard: if realtime just delivered a newer ETA for the
        // active ride, the 5s REST poll might return an older row due to
        // replication lag. Keep whichever timestamp is newer.
        if (typeof arId !== 'undefined' && arId && mapped.id === arId) {
          var prev = _prevRides.find(function(pr) { return pr.id === arId; });
          if (prev && prev.driverEtaUpdatedAt) {
            var prevTs = new Date(prev.driverEtaUpdatedAt).getTime();
            var newTs  = mapped.driverEtaUpdatedAt ? new Date(mapped.driverEtaUpdatedAt).getTime() : 0;
            if (prevTs > newTs) {
              mapped.driverEtaSecs = prev.driverEtaSecs;
              mapped.driverEtaUpdatedAt = prev.driverEtaUpdatedAt;
            }
          }
        }
        return mapped;
      }),
      settings: {
        serviceStatus: st.service_status !== false,
        maxPassengers: st.max_passengers || 5,
        serviceArea: st.service_area || 'Naples, FL',
        announcements: st.announcements || [],
        hours: st.hours || {},
        promotions: (function(){
          var src = (Array.isArray(p) && p.length) ? p : [];
          if (!src.length) return (typeof PROMOS !== 'undefined' ? PROMOS : []);
          return src.map(function(x) {
            return {
              id: x.slot_index || x.id || '',
              name: x.title || x.name || '',
              addr: x.destination_address || x.addr || '',
              desc: x.description || '',
              color: x.color || '#007AFF',
              img: x.image_url || x.img_url || ''
            };
          });
        })()
      },
      tickets: []
    };
    try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}
    // Update service hours text
    var _hi = document.getElementById('h-hrs');
    if (_hi && st.service_info) {
      _hi.textContent = st.service_info;
      try { localStorage.setItem('rydz-hrs-text', st.service_info); } catch (e) {}
    }
    // Restore active ride state
    if (cur === 'home') updAlerts();
    if (cur === 'wait') updWait();
  }).catch(function(err) {
    logError('supaSync', err);
  });
}

function supaSaveUser(u) {
  var body = {
    id: u.id, role: u.role || 'rider', name: u.name || '',
    first_name: u.firstName || '', last_name: u.lastName || '',
    email: u.email || '', phone: u.phone || '', password: u.password || '',
    created_at: new Date(u.createdAt || Date.now()).toISOString()
  };
  fetch(SUPA_URL + '/rest/v1/users', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) {
      res.text().then(function(t) {
        logError('supaSaveUser', res.status + ': ' + t);
        console.error('supaSaveUser failed:', res.status, t);
      });
    }
  }).catch(function(e) {
    logError('supaSaveUser', e);
  });
}

function supaUpdateUser(u) {
  supaFetch('PATCH', 'users', '?id=eq.' + encodeURIComponent(u.id), {
    name: u.name, first_name: u.firstName, last_name: u.lastName,
    email: u.email, phone: u.phone, password: u.password,
    vehicle: u.vehicle, plate: u.plate, status: u.status
  });
}

function supaSaveRide(r) {
  var body = {
    id: r.id, rider_id: r.riderId, driver_id: r.driverId || null,
    pickup: r.pickup || '', dropoff: r.dropoff || '',
    pu_x: parseFloat(r.puX) || 0, pu_y: parseFloat(r.puY) || 0,
    do_x: parseFloat(r.doX) || 0, do_y: parseFloat(r.doY) || 0,
    passengers: r.passengers || 1, status: r.status || 'requested',
    phone: r.phone || null, note: r.note || '',
    created_at: new Date(r.createdAt || Date.now()).toISOString()
  };
  fetch(SUPA_URL + '/rest/v1/rides', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) res.text().then(function(t) { logError('supaSaveRide', t); });
  }).catch(function(e) { logError('supaSaveRide', e); });
}

function supaUpdateRide(id, d) {
  var o = {};
  if (d.status !== undefined) o.status = d.status;
  if (d.driverId !== undefined) o.driver_id = d.driverId;
  if (d.completedAt !== undefined) o.completed_at = d.completedAt;
  supaFetch('PATCH', 'rides', '?id=eq.' + encodeURIComponent(id), o);
}

function supaSaveSettings(s) {
  supaFetch('PATCH', 'settings', '?id=eq.1', {
    service_status: s.serviceStatus,
    max_passengers: s.maxPassengers,
    service_area: s.serviceArea,
    announcements: s.announcements || []
  });
}

function supaSaveTicket(t) {
  var body = {
    id: t.id,
    type: t.type || 'general',
    message: t.message || '',
    user_id: t.userId || null,
    user_name: t.userName || '',
    status: 'pending',
    created_at: new Date(t.createdAt || Date.now()).toISOString()
  };
  fetch(SUPA_URL + '/rest/v1/tickets', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) {
      res.text().then(function(t2) {
        logError('supaSaveTicket', res.status + ': ' + t2);
        console.error('supaSaveTicket failed:', res.status, t2);
      });
    } else {
      console.log('Ticket saved to Supabase');
    }
  }).catch(function(err) {
    logError('supaSaveTicket', err);
    console.error('supaSaveTicket network error:', err);
  });
}
