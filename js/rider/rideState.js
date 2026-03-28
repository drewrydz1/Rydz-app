// RYDZ Rider - Ride State v2
// Manages wait screen: pre-accept timeline ETA, post-accept live GPS tracking
// Handles ride status transitions and decline notification

function updWait() {
  if (cur !== 'wait' || !arId) return;

  // Pull fresh data from Supabase
  if (typeof supaSync === 'function') supaSync();

  // Start live ETA updates if not already running
  if (typeof startETAUpdates === 'function' && !window._etaStarted) {
    window._etaStarted = true;
    startETAUpdates();
  }

  var ride = db.rides.find(function(r) { return r.id === arId; });
  if (!ride) return;

  // === STATUS TRANSITIONS ===

  // Ride completed by driver → feedback screen
  if (ride.status === 'completed') {
    window._etaStarted = false;
    go('complete');
    return;
  }

  // Ride cancelled/declined by driver → notify rider, go home
  if (ride.status === 'cancelled') {
    window._etaStarted = false;
    arId = null;
    if (typeof showToast === 'function') {
      showToast('Your ride was declined by the driver. Please request a new ride.');
    }
    go('home');
    return;
  }

  // === UPDATE SCREEN CONTENT ===
  document.getElementById('w-pu').textContent = ride.pickup;
  document.getElementById('w-do').textContent = ride.dropoff;
  document.getElementById('w-p1').textContent = 'PICKUP';
  document.getElementById('w-p2').textContent = 'DROP-OFF';

  drawMap(document.getElementById('w-map'), {
    pu: { x: ride.puX, y: ride.puY, lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) },
    d: { x: ride.doX, y: ride.doY, lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
  });

  var t = document.getElementById('w-t');
  var st = document.getElementById('w-st');
  var it = document.getElementById('w-it');
  var mn = document.getElementById('w-mn');

  // === PRE-ACCEPT: Waiting for driver to accept ===
  if (ride.status === 'requested') {
    t.textContent = 'Ride Requested';
    it.textContent = 'Waiting for your driver to accept.';

    // Show the pre-calculated ETA from dispatch
    if (window._rideETA && mn) {
      mn.textContent = window._rideETA;
      var etaStr = new Date(Date.now() + window._rideETA * 60000).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit'
      });
      st.textContent = 'Estimated pickup: ' + etaStr;
    } else {
      st.textContent = 'Finding your driver...';
    }
  }

  // === POST-ACCEPT: Driver accepted, on the way ===
  else if (ride.status === 'accepted' || ride.status === 'en_route') {
    t.textContent = 'Driver On The Way';
    it.textContent = 'Your driver is approaching.';
    // Live ETA is handled by startETAUpdates (direct GPS → pickup)
  }

  // === ARRIVED: Driver at pickup ===
  else if (ride.status === 'arrived') {
    t.textContent = 'Driver Arrived';
    st.textContent = 'Your driver is at the pickup!';
    it.textContent = 'Meet your driver now.';
    if (mn) mn.textContent = '0';
  }

  // === PICKED UP: Heading to drop-off ===
  else if (ride.status === 'picked_up') {
    t.textContent = 'Heading to Drop-off';
    it.textContent = 'Enjoy your ride!';
    // Live ETA is handled by startETAUpdates (direct GPS → dropoff)
  }

  // === DRIVER CARD ===
  var dc = document.getElementById('w-dc');
  if (ride.driverId) {
    var drv = db.users.find(function(u) { return u.id === ride.driverId; });
    if (drv) {
      dc.classList.remove('hidden');
      document.getElementById('w-di').textContent = (drv.name || 'D')[0];
      document.getElementById('w-dn').textContent = drv.name || 'Driver';
      document.getElementById('w-dv').textContent = ((drv.vehicle || '') + ' ' + (drv.plate || '')).trim();

      // Direct GPS → destination tracking (post-accept only)
      if (ride.status !== 'requested' && drv.lat && drv.lng && typeof google !== 'undefined' && google.maps) {
        var dlat = parseFloat(drv.lat);
        var dlng = parseFloat(drv.lng);
        var dest = (ride.status === 'picked_up')
          ? { lat: parseFloat(ride.doX), lng: parseFloat(ride.doY) }
          : { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) };

        if (dest.lat && dest.lng) {
          try {
            new google.maps.DirectionsService().route({
              origin: { lat: dlat, lng: dlng },
              destination: dest,
              travelMode: 'DRIVING'
            }, function(res, stat) {
              if (stat === 'OK' && res.routes[0] && res.routes[0].legs[0]) {
                var mins = Math.max(1, Math.ceil(res.routes[0].legs[0].duration.value / 60)) + 1;
                if (mn) mn.textContent = mins;
                var etaStr = new Date(Date.now() + mins * 60000).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit'
                });
                if (ride.status === 'picked_up') {
                  st.textContent = mins + ' min to drop-off. ETA ' + etaStr;
                } else if (ride.status === 'arrived') {
                  st.textContent = 'Your driver is here!';
                } else {
                  st.textContent = 'Arriving in ' + mins + ' min. ETA ' + etaStr;
                }
              }
            });
          } catch (e) {}
        }
      }
    }
  } else {
    dc.classList.add('hidden');
  }

  // Update driver marker on map
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
  document.getElementById('o-p1').textContent = 'PICKUP';
  document.getElementById('o-p2').textContent = 'DROP-OFF';
  document.getElementById('o-pl').textContent = pl;
  drawMap(document.getElementById('ov-map'), { pu: puSel, d: doSel });
}
