// RYDZ Admin - Dispatch Panel
// Allows admin to create rides on behalf of callers (dispatch rides)

var _dpPuSel = null; // selected pickup {name, address, lat, lng}
var _dpDoSel = null; // selected dropoff {name, address, lat, lng}
var _dpEta = null;
var _dpBestDriver = null;
var _dpAutocomplete = null;
var _dpMap = null;
var _dpPuMarker = null;
var _dpDoMarker = null;
var _dpRouteLine = null;
var _dpCalcTimer = null;

// Service area polygon for validation
var _dpSVC = [
  {lat:26.17319345750562,lng:-81.81783943525166},
  {lat:26.093442909425136,lng:-81.80448104553827},
  {lat:26.092372283380186,lng:-81.80077692007605},
  {lat:26.09926039070288,lng:-81.78703595420656},
  {lat:26.104399080347548,lng:-81.78643988281546},
  {lat:26.115518792417305,lng:-81.78735693740616},
  {lat:26.126509216803697,lng:-81.77854499304347},
  {lat:26.138794565452926,lng:-81.77869523447562},
  {lat:26.142762589023363,lng:-81.7848211566605},
  {lat:26.169933772476142,lng:-81.78606141667692},
  {lat:26.171154572849133,lng:-81.79207471929068},
  {lat:26.17319345750562,lng:-81.81783943525166}
];

function initDispatchPage() {
  renderDispatchQueue();
  setupDispatchAutocomplete();
  initDispatchMap();
}

// ============================================================
// AUTOCOMPLETE SETUP
// ============================================================
function setupDispatchAutocomplete() {
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;

  var puInput = document.getElementById('dp-pu-input');
  var doInput = document.getElementById('dp-do-input');
  if (!puInput || !doInput) return;

  var bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(26.08, -81.83),
    new google.maps.LatLng(26.22, -81.74)
  );

  var opts = {
    bounds: bounds,
    strictBounds: true,
    componentRestrictions: { country: 'us' },
    fields: ['name', 'formatted_address', 'geometry']
  };

  var puAC = new google.maps.places.Autocomplete(puInput, opts);
  var doAC = new google.maps.places.Autocomplete(doInput, opts);

  puAC.addListener('place_changed', function() {
    var place = puAC.getPlace();
    if (!place || !place.geometry) {
      showDPError('Could not find that pickup location');
      return;
    }
    var lat = place.geometry.location.lat();
    var lng = place.geometry.location.lng();
    if (!isInServiceArea(lat, lng)) {
      showDPError('Pickup is outside the Naples service area');
      _dpPuSel = null;
      updateDispatchState();
      return;
    }
    _dpPuSel = {
      name: place.name || place.formatted_address,
      address: place.formatted_address || place.name,
      lat: lat,
      lng: lng
    };
    puInput.value = _dpPuSel.name;
    clearDPError();
    updateDispatchState();
    updateDispatchMap();
  });

  doAC.addListener('place_changed', function() {
    var place = doAC.getPlace();
    if (!place || !place.geometry) {
      showDPError('Could not find that drop-off location');
      return;
    }
    var lat = place.geometry.location.lat();
    var lng = place.geometry.location.lng();
    if (!isInServiceArea(lat, lng)) {
      showDPError('Drop-off is outside the Naples service area');
      _dpDoSel = null;
      updateDispatchState();
      return;
    }
    _dpDoSel = {
      name: place.name || place.formatted_address,
      address: place.formatted_address || place.name,
      lat: lat,
      lng: lng
    };
    doInput.value = _dpDoSel.name;
    clearDPError();
    updateDispatchState();
    updateDispatchMap();
  });
}

// ============================================================
// SERVICE AREA CHECK
// ============================================================
function isInServiceArea(lat, lng) {
  // Check dynamic zones first (loaded from zones.js)
  if (typeof _zones !== 'undefined' && _zones.length > 0) {
    return _zoneCheckPoint(lat, lng, _zones);
  }
  // Fallback to hardcoded SVC polygon
  if (lat < 26.087 || lat > 26.178 || lng < -81.823 || lng > -81.774) return false;
  if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
    var poly = new google.maps.Polygon({ paths: _dpSVC });
    return google.maps.geometry.poly.containsLocation(
      new google.maps.LatLng(lat, lng), poly
    );
  }
  return true;
}

// ============================================================
// DISPATCH MAP
// ============================================================
function initDispatchMap() {
  if (typeof google === 'undefined' || !google.maps) return;
  var el = document.getElementById('dp-map');
  if (!el || _dpMap) return;

  _dpMap = new google.maps.Map(el, {
    center: NC,
    zoom: 13,
    styles: MS,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy'
  });

  // Draw service area polygons (all active zones)
  if(typeof _zones!=='undefined'&&_zones.length>0){
    for(var zi=0;zi<_zones.length;zi++){
      var zn=_zones[zi];
      if(!zn.active||!zn.polygon||zn.polygon.length<3)continue;
      var zc=zn.color||'#3b82f6';
      new google.maps.Polygon({paths:zn.polygon,strokeColor:zc,strokeOpacity:0.5,strokeWeight:2,fillColor:zc,fillOpacity:0.06,map:_dpMap});
    }
  }else{
    new google.maps.Polygon({paths:_dpSVC,strokeColor:'#3b82f6',strokeOpacity:0.5,strokeWeight:2,fillColor:'#3b82f6',fillOpacity:0.06,map:_dpMap});
  }
}

function updateDispatchMap() {
  if (!_dpMap) return;

  // Clear existing markers
  if (_dpPuMarker) { _dpPuMarker.setMap(null); _dpPuMarker = null; }
  if (_dpDoMarker) { _dpDoMarker.setMap(null); _dpDoMarker = null; }
  if (_dpRouteLine) { _dpRouteLine.setMap(null); _dpRouteLine = null; }

  var bounds = new google.maps.LatLngBounds();
  var hasBounds = false;

  if (_dpPuSel) {
    _dpPuMarker = new google.maps.Marker({
      position: { lat: _dpPuSel.lat, lng: _dpPuSel.lng },
      map: _dpMap,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      },
      title: 'Pickup: ' + _dpPuSel.name
    });
    bounds.extend(new google.maps.LatLng(_dpPuSel.lat, _dpPuSel.lng));
    hasBounds = true;
  }

  if (_dpDoSel) {
    _dpDoMarker = new google.maps.Marker({
      position: { lat: _dpDoSel.lat, lng: _dpDoSel.lng },
      map: _dpMap,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      },
      title: 'Drop-off: ' + _dpDoSel.name
    });
    bounds.extend(new google.maps.LatLng(_dpDoSel.lat, _dpDoSel.lng));
    hasBounds = true;
  }

  // Draw route line between pickup and dropoff
  if (_dpPuSel && _dpDoSel) {
    _dpRouteLine = new google.maps.Polyline({
      path: [
        { lat: _dpPuSel.lat, lng: _dpPuSel.lng },
        { lat: _dpDoSel.lat, lng: _dpDoSel.lng }
      ],
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map: _dpMap
    });
  }

  if (hasBounds) {
    if (_dpPuSel && _dpDoSel) {
      _dpMap.fitBounds(bounds, 60);
    } else {
      _dpMap.setCenter(bounds.getCenter());
      _dpMap.setZoom(15);
    }
  }
}

// ============================================================
// STATE MANAGEMENT & ETA
// ============================================================
function updateDispatchState() {
  var etaWrap = document.getElementById('dp-eta-wrap');
  var submitBtn = document.getElementById('dp-submit');
  var nameInp = document.getElementById('dp-name');
  var phoneInp = document.getElementById('dp-phone');

  // Check if both locations selected
  if (_dpPuSel && _dpDoSel) {
    // Calculate ETA
    if (etaWrap) etaWrap.style.display = 'block';
    calcDispatchETA();
  } else {
    if (etaWrap) etaWrap.style.display = 'none';
    _dpEta = null;
    _dpBestDriver = null;
  }

  // Enable submit only when all fields filled
  var canSubmit = _dpPuSel && _dpDoSel && nameInp && nameInp.value.trim() && phoneInp && phoneInp.value.trim();
  if (submitBtn) {
    submitBtn.disabled = !canSubmit;
    submitBtn.style.opacity = canSubmit ? '1' : '0.5';
  }
}

function calcDispatchETA() {
  if (!_dpPuSel) return;
  var etaVal = document.getElementById('dp-eta-val');
  var etaStatus = document.getElementById('dp-eta-status');
  var etaDriver = document.getElementById('dp-eta-driver');
  if (etaVal) etaVal.textContent = '...';
  if (etaStatus) etaStatus.textContent = 'Calculating...';
  if (etaDriver) etaDriver.textContent = '';

  // Clear previous timer
  if (_dpCalcTimer) clearTimeout(_dpCalcTimer);

  _dpCalcTimer = setTimeout(function() {
    _calcDispatchETACore(_dpPuSel.lat, _dpPuSel.lng, function(eta, driverId) {
      _dpEta = eta;
      _dpBestDriver = driverId;

      if (!eta || eta === 0) {
        if (etaVal) etaVal.textContent = '--';
        if (etaStatus) etaStatus.textContent = 'No drivers available';
        if (etaDriver) etaDriver.textContent = '';
      } else {
        var etaTime = new Date(Date.now() + eta * 60000);
        var etaStr = etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (etaVal) etaVal.textContent = eta;
        if (etaStatus) etaStatus.textContent = 'ETA ' + etaStr;
        if (etaDriver && driverId) {
          var drv = users.find(function(u) { return u.id === driverId; });
          if (drv) etaDriver.textContent = 'Driver: ' + esc(drv.name);
        }
      }
      updateDispatchState();
    });
  }, 300);
}

// ============================================================
// ETA CALCULATION (adapted from rider dispatch engine)
// ============================================================
function _calcDispatchETACore(puLat, puLng, callback) {
  if (typeof google === 'undefined' || !google.maps) { callback(0, null); return; }

  var allDrivers = users.filter(function(u) { return u.role === 'driver'; });
  var eligible = allDrivers.filter(function(d) { return d.status === 'online'; });
  if (!eligible.length) { callback(0, null); return; }

  var bestETA = null;
  var bestDriver = null;
  var pending = eligible.length;
  var done = false;

  var timer = setTimeout(function() {
    if (!done) {
      done = true;
      callback(bestETA !== null ? Math.max(2, bestETA + 1) : 0, bestDriver);
    }
  }, 8000);

  eligible.forEach(function(drv) {
    if (done) return;
    _calcSingleDriverETA(drv, puLat, puLng, function(eta) {
      if (done) return;
      pending--;
      if (eta !== null && (bestETA === null || eta < bestETA)) {
        bestETA = eta;
        bestDriver = drv.id;
      }
      if (pending <= 0) {
        done = true;
        clearTimeout(timer);
        var finalETA = bestETA !== null ? Math.max(2, bestETA + 1) : 0;
        callback(finalETA, bestDriver);
      }
    });
  });
}

function _calcSingleDriverETA(drv, newPuLat, newPuLng, callback) {
  var dlat = drv.lat ? parseFloat(drv.lat) : 26.1334;
  var dlng = drv.lng ? parseFloat(drv.lng) : -81.7935;

  var drvRides = rides.filter(function(ri) {
    return ri.driver_id === drv.id &&
      ['accepted', 'en_route', 'arrived', 'picked_up', 'requested'].indexOf(ri.status) >= 0;
  }).sort(function(a, b) {
    var aActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(a.status) >= 0 ? 0 : 1;
    var bActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(b.status) >= 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  // Idle driver - direct drive to pickup
  if (!drvRides.length) {
    _dpDriveETA(dlat, dlng, newPuLat, newPuLng).then(function(secs) {
      callback(Math.max(1, Math.ceil(secs / 60)));
    });
    return;
  }

  // Busy driver - chain through rides
  var steps = [];
  drvRides.forEach(function(ri) {
    var puX = parseFloat(ri.pu_x);
    var puY = parseFloat(ri.pu_y);
    var doX = parseFloat(ri.do_x);
    var doY = parseFloat(ri.do_y);

    if (ri.status === 'picked_up') {
      if (doX && doY) steps.push({ lat: doX, lng: doY, buf: 30 });
    } else if (ri.status === 'arrived') {
      if (doX && doY) steps.push({ lat: doX, lng: doY, buf: 60 });
    } else if (ri.status === 'accepted' || ri.status === 'en_route') {
      if (puX && puY) steps.push({ lat: puX, lng: puY, buf: 30 });
      if (doX && doY) steps.push({ lat: doX, lng: doY, buf: 30 });
    } else if (ri.status === 'requested') {
      if (puX && puY) steps.push({ lat: puX, lng: puY, buf: 30 });
      if (doX && doY) steps.push({ lat: doX, lng: doY, buf: 30 });
    }
  });

  steps.push({ lat: parseFloat(newPuLat), lng: parseFloat(newPuLng), buf: 0 });

  var totalSecs = 0;
  var curLat = dlat;
  var curLng = dlng;
  var idx = 0;

  function next() {
    if (idx >= steps.length) {
      callback(Math.max(1, Math.ceil(totalSecs / 60)));
      return;
    }
    var s = steps[idx];
    _dpDriveETA(curLat, curLng, s.lat, s.lng).then(function(secs) {
      totalSecs += secs + s.buf;
      curLat = s.lat;
      curLng = s.lng;
      idx++;
      next();
    });
  }
  next();
}

function _dpDriveETA(fLat, fLng, tLat, tLng) {
  return new Promise(function(resolve) {
    if (!fLat || !fLng || !tLat || !tLng) { resolve(600); return; }
    fLat = parseFloat(fLat); fLng = parseFloat(fLng);
    tLat = parseFloat(tLat); tLng = parseFloat(tLng);

    var dx = (tLat - fLat) * 111320;
    var dy = (tLng - fLng) * 111320 * Math.cos(fLat * Math.PI / 180);
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 100) { resolve(30); return; }

    if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
      try {
        var ds = new google.maps.DirectionsService();
        ds.route({
          origin: { lat: fLat, lng: fLng },
          destination: { lat: tLat, lng: tLng },
          travelMode: 'DRIVING',
          drivingOptions: { departureTime: new Date() }
        }, function(res, st) {
          if (st === 'OK' && res.routes[0] && res.routes[0].legs[0]) {
            var leg = res.routes[0].legs[0];
            resolve(leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value);
          } else {
            resolve(Math.max(60, Math.round(dist * 1.4 / 6.9)));
          }
        });
      } catch (e) {
        resolve(Math.max(60, Math.round(dist * 1.4 / 6.9)));
      }
    } else {
      resolve(Math.max(60, Math.round(dist * 1.4 / 6.9)));
    }
  });
}

// ============================================================
// SUBMIT DISPATCH RIDE
// ============================================================
async function submitDispatchRide() {
  var nameInp = document.getElementById('dp-name');
  var phoneInp = document.getElementById('dp-phone');
  var passInp = document.getElementById('dp-pass');
  var noteInp = document.getElementById('dp-note');
  var submitBtn = document.getElementById('dp-submit');

  var callerName = nameInp ? nameInp.value.trim() : '';
  var callerPhone = phoneInp ? phoneInp.value.trim() : '';
  var passengers = passInp ? parseInt(passInp.value) || 1 : 1;
  var note = noteInp ? noteInp.value.trim() : '';

  if (!callerName) { showDPError('Please enter the caller\'s name'); return; }
  if (!callerPhone) { showDPError('Please enter the caller\'s phone number'); return; }
  if (!_dpPuSel) { showDPError('Please select a pickup location'); return; }
  if (!_dpDoSel) { showDPError('Please select a drop-off location'); return; }
  if (passengers < 1 || passengers > 5) { showDPError('Passengers must be between 1 and 5'); return; }

  // Disable button during submission
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  var rideId = 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  var dispatchNote = 'DISPATCH: ' + callerName + (note ? ' | ' + note : '');

  var body = {
    id: rideId,
    rider_id: null,
    driver_id: _dpBestDriver || null,
    pickup: _dpPuSel.name || _dpPuSel.address,
    dropoff: _dpDoSel.name || _dpDoSel.address,
    pu_x: _dpPuSel.lat,
    pu_y: _dpPuSel.lng,
    do_x: _dpDoSel.lat,
    do_y: _dpDoSel.lng,
    passengers: passengers,
    status: 'requested',
    phone: callerPhone,
    note: dispatchNote,
    created_at: new Date().toISOString()
  };

  try {
    var res = await fetch(SUPA + '/rest/v1/rides', {
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      var errText = await res.text();
      console.error('Dispatch ride failed:', errText);
      showDPError('Failed to create ride. Please try again.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Dispatch Ride'; }
      return;
    }

    // Log the action
    await logAct('dispatch_ride', rideId);

    // Success
    showDPSuccess('Ride dispatched! ID: ' + rideId.slice(0, 15) + '...');
    resetDispatchForm();
    await loadData();
    renderDispatchQueue();

  } catch (err) {
    console.error('Dispatch network error:', err);
    showDPError('Network error. Please try again.');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Dispatch Ride'; }
  }
}

// ============================================================
// DISPATCH QUEUE - show active dispatch rides
// ============================================================
function renderDispatchQueue() {
  var tbody = document.getElementById('dp-queue-tbody');
  if (!tbody) return;

  // Filter dispatch rides (note starts with "DISPATCH:")
  var dispatchRides = rides.filter(function(r) {
    return r.note && r.note.indexOf('DISPATCH:') === 0;
  }).sort(function(a, b) {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Show last 50
  var recent = dispatchRides.slice(0, 50);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:30px">No dispatch rides yet</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(function(r) {
    var callerName = r.note.replace('DISPATCH: ', '').split(' | ')[0];
    var sc = r.status === 'completed' ? 'gn' : r.status === 'cancelled' ? 'rd' : r.status === 'requested' ? 'or' : 'bl';
    var statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
    var driver = r.driver_id ? users.find(function(u) { return u.id === r.driver_id; }) : null;
    var driverName = driver ? esc(driver.name) : '<span style="color:var(--tx3)">Unassigned</span>';
    var timeAgo = ago(new Date(r.created_at));

    return '<tr onclick="openRidePN(\'' + r.id + '\')">' +
      '<td><span class="badge ' + sc + '">' + statusLabel + '</span></td>' +
      '<td>' + esc(callerName) + '</td>' +
      '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.pickup) + '</td>' +
      '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.dropoff) + '</td>' +
      '<td>' + (r.passengers || 1) + '</td>' +
      '<td>' + driverName + '</td>' +
      '<td>' + timeAgo + '</td>' +
      '</tr>';
  }).join('');

  // Update dispatch count in metrics area
  var activeCount = dispatchRides.filter(function(r) {
    return ['requested', 'accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
  }).length;
  var countEl = document.getElementById('dp-active-count');
  if (countEl) countEl.textContent = activeCount;
}

// ============================================================
// FORM HELPERS
// ============================================================
function resetDispatchForm() {
  _dpPuSel = null;
  _dpDoSel = null;
  _dpEta = null;
  _dpBestDriver = null;

  var puInp = document.getElementById('dp-pu-input');
  var doInp = document.getElementById('dp-do-input');
  var nameInp = document.getElementById('dp-name');
  var phoneInp = document.getElementById('dp-phone');
  var passInp = document.getElementById('dp-pass');
  var noteInp = document.getElementById('dp-note');
  var submitBtn = document.getElementById('dp-submit');
  var etaWrap = document.getElementById('dp-eta-wrap');

  if (puInp) puInp.value = '';
  if (doInp) doInp.value = '';
  if (nameInp) nameInp.value = '';
  if (phoneInp) phoneInp.value = '';
  if (passInp) passInp.value = '1';
  if (noteInp) noteInp.value = '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Dispatch Ride'; submitBtn.style.opacity = '0.5'; }
  if (etaWrap) etaWrap.style.display = 'none';

  // Clear map markers
  if (_dpPuMarker) { _dpPuMarker.setMap(null); _dpPuMarker = null; }
  if (_dpDoMarker) { _dpDoMarker.setMap(null); _dpDoMarker = null; }
  if (_dpRouteLine) { _dpRouteLine.setMap(null); _dpRouteLine = null; }
  if (_dpMap) { _dpMap.setCenter(NC); _dpMap.setZoom(13); }
}

function showDPError(msg) {
  var el = document.getElementById('dp-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = 'var(--rd)';
  el.style.background = 'var(--rdl)';
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

function showDPSuccess(msg) {
  var el = document.getElementById('dp-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = 'var(--gn)';
  el.style.background = 'var(--gnl)';
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

function clearDPError() {
  var el = document.getElementById('dp-msg');
  if (el) el.style.display = 'none';
}

function dpPassChange(delta) {
  var inp = document.getElementById('dp-pass');
  if (!inp) return;
  var v = parseInt(inp.value) || 1;
  v += delta;
  if (v < 1) v = 1;
  if (v > 5) v = 5;
  inp.value = v;
}
