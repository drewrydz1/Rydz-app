// RYDZ Admin - Dispatch Panel
// Creates dispatch rides from phone calls — enters normal ride queue

var dspPuSel = null; // {name, address, lat, lng}
var dspDoSel = null;
var dspPassCount = 1;
var dspMap = null;
var dspPuMarker = null;
var dspDoMarker = null;
var dspRouteLine = null;
var dspAcPuSvc = null;
var dspAcDoSvc = null;
var dspEtaVal = null; // minutes
var dspBestDriver = null;

// Naples bounds for autocomplete bias
var DSP_BOUNDS = {north:26.22,south:26.08,east:-81.74,west:-81.83};

// Service area polygon — same as rider app
var _dspSVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
function _dspInArea(lat,lng){
  if(lat<26.087||lat>26.178||lng<-81.823||lng>-81.774) return false;
  if(typeof google!=='undefined'&&google.maps&&google.maps.geometry){
    try{return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat,lng),new google.maps.Polygon({paths:_dspSVC}))}catch(e){}
  }
  return true;
}

// ============================================================
// INIT — called when navigating to dispatch page
// ============================================================
function initDispatchPage() {
  dspResetForm();
  dspInitAutocomplete();
}

// ============================================================
// AUTOCOMPLETE — Google Places for pickup & dropoff
// ============================================================
function dspInitAutocomplete() {
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;

  var puInput = document.getElementById('dsp-pickup');
  var doInput = document.getElementById('dsp-dropoff');
  if (!puInput || !doInput) return;

  // Remove old listeners by replacing elements
  var newPu = puInput.cloneNode(true);
  puInput.parentNode.replaceChild(newPu, puInput);
  var newDo = doInput.cloneNode(true);
  doInput.parentNode.replaceChild(newDo, doInput);

  dspAcPuSvc = new google.maps.places.AutocompleteService();
  dspAcDoSvc = new google.maps.places.AutocompleteService();

  newPu.addEventListener('input', function() { dspOnType('pu', this.value); });
  newDo.addEventListener('input', function() { dspOnType('do', this.value); });

  // Close dropdowns on outside click
  document.addEventListener('click', function(e) {
    var puList = document.getElementById('dsp-ac-pu');
    var doList = document.getElementById('dsp-ac-do');
    if (puList && !e.target.closest('#dsp-pickup') && !e.target.closest('#dsp-ac-pu'))
      puList.innerHTML = '';
    if (doList && !e.target.closest('#dsp-dropoff') && !e.target.closest('#dsp-ac-do'))
      doList.innerHTML = '';
  });
}

var _dspTypeTimer = null;
function dspOnType(which, val) {
  var listEl = document.getElementById(which === 'pu' ? 'dsp-ac-pu' : 'dsp-ac-do');
  if (!val || val.length < 2) { if (listEl) listEl.innerHTML = ''; return; }
  if (_dspTypeTimer) clearTimeout(_dspTypeTimer);
  _dspTypeTimer = setTimeout(function() {
    dspAcPuSvc.getPlacePredictions({
      input: val,
      locationBias: {north: DSP_BOUNDS.north, south: DSP_BOUNDS.south, east: DSP_BOUNDS.east, west: DSP_BOUNDS.west},
      componentRestrictions: { country: 'us' }
    }, function(results, status) {
      if (status !== 'OK' || !results) { if (listEl) listEl.innerHTML = ''; return; }
      // Filter to Naples area results
      var filtered = results.filter(function(r) {
        var desc = (r.description || '').toLowerCase();
        return desc.indexOf('naples') >= 0 || desc.indexOf('collier') >= 0 ||
               desc.indexOf('marco') >= 0 || desc.indexOf('bonita') >= 0 ||
               desc.indexOf('fl ') >= 0 || desc.indexOf('florida') >= 0;
      });
      if (!filtered.length) filtered = results.slice(0, 5);
      listEl.innerHTML = filtered.slice(0, 5).map(function(r) {
        var main = r.structured_formatting ? r.structured_formatting.main_text : r.description;
        var sec = r.structured_formatting ? r.structured_formatting.secondary_text : '';
        return '<div class="dsp-ac-item" data-pid="' + r.place_id + '" data-which="' + which + '" onclick="dspSelectPlace(this)">' +
          '<div class="dsp-ac-main">' + esc(main) + '</div>' +
          '<div class="dsp-ac-sec">' + esc(sec) + '</div>' +
          '</div>';
      }).join('');
    });
  }, 250);
}

function dspSelectPlace(el) {
  var pid = el.dataset.pid;
  var which = el.dataset.which;
  if (!pid) return;

  var svc = new google.maps.places.PlacesService(document.createElement('div'));
  svc.getDetails({ placeId: pid, fields: ['name', 'formatted_address', 'geometry'] }, function(place, status) {
    if (status !== 'OK' || !place) return;
    var loc = {
      name: place.name,
      address: place.formatted_address,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    };

    // Service area check
    if(!_dspInArea(loc.lat, loc.lng)){
      dspShowStatus((which==='pu'?'Pickup':'Drop-off')+' location is outside the Rydz service area.', 'err');
      document.getElementById(which==='pu'?'dsp-pickup':'dsp-dropoff').value='';
      document.getElementById(which==='pu'?'dsp-ac-pu':'dsp-ac-do').innerHTML='';
      return;
    }

    if (which === 'pu') {
      dspPuSel = loc;
      document.getElementById('dsp-pickup').value = loc.name;
      document.getElementById('dsp-ac-pu').innerHTML = '';
      document.getElementById('dsp-pu-tag').innerHTML = '<span class="dsp-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="3"/></svg>' + esc(loc.name) + '<span class="dsp-tag-x" onclick="dspClearLoc(\'pu\')">&times;</span></span>';
    } else {
      dspDoSel = loc;
      document.getElementById('dsp-dropoff').value = loc.name;
      document.getElementById('dsp-ac-do').innerHTML = '';
      document.getElementById('dsp-do-tag').innerHTML = '<span class="dsp-tag dsp-tag-do"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/></svg>' + esc(loc.name) + '<span class="dsp-tag-x" onclick="dspClearLoc(\'do\')">&times;</span></span>';
    }

    // Same address check
    if(dspPuSel && dspDoSel && dspPuSel.name === dspDoSel.name){
      dspShowStatus('Pickup and drop-off cannot be the same location.', 'err');
      if(which==='pu'){dspPuSel=null;document.getElementById('dsp-pickup').value='';document.getElementById('dsp-pu-tag').innerHTML=''}
      else{dspDoSel=null;document.getElementById('dsp-dropoff').value='';document.getElementById('dsp-do-tag').innerHTML=''}
      return;
    }

    // If both selected, calculate ETA and show map
    if (dspPuSel && dspDoSel) {
      dspCalcETA();
      dspShowMap();
    }
  });
}

function dspClearLoc(which) {
  if (which === 'pu') {
    dspPuSel = null;
    document.getElementById('dsp-pickup').value = '';
    document.getElementById('dsp-pu-tag').innerHTML = '';
  } else {
    dspDoSel = null;
    document.getElementById('dsp-dropoff').value = '';
    document.getElementById('dsp-do-tag').innerHTML = '';
  }
  var etaBox = document.getElementById('dsp-eta-box');
  var mapWrap = document.getElementById('dsp-map-preview');
  if (etaBox) etaBox.style.display = 'none';
  if (mapWrap) mapWrap.style.display = 'none';
  dspEtaVal = null;
  dspBestDriver = null;
}

// ============================================================
// PASSENGER COUNT
// ============================================================
function dspPassAdj(delta) {
  dspPassCount = Math.max(1, Math.min(8, dspPassCount + delta));
  document.getElementById('dsp-pass-val').textContent = dspPassCount;
}

// ============================================================
// ETA CALCULATION — uses Google Directions like the rider app
// ============================================================
function dspCalcETA() {
  if (!dspPuSel) return;
  var etaBox = document.getElementById('dsp-eta-box');
  var etaValEl = document.getElementById('dsp-eta-val');
  if (etaBox) etaBox.style.display = 'flex';
  if (etaValEl) etaValEl.textContent = 'Calculating...';

  // Get online drivers from the loaded data
  var drivers = users.filter(function(u) { return u.role === 'driver' && u.status === 'online'; });

  if (!drivers.length) {
    if (etaValEl) etaValEl.innerHTML = '<span style="color:var(--or)">No drivers online</span>';
    dspEtaVal = null;
    dspBestDriver = null;
    return;
  }

  var puLat = dspPuSel.lat;
  var puLng = dspPuSel.lng;
  var bestETA = null;
  var bestDriver = null;
  var pending = drivers.length;
  var done = false;

  var timer = setTimeout(function() {
    if (!done) {
      done = true;
      dspEtaVal = bestETA;
      dspBestDriver = bestDriver;
      dspShowETAResult();
    }
  }, 8000);

  drivers.forEach(function(drv) {
    if (done) return;
    dspCalcDriverETA(drv, puLat, puLng, function(eta) {
      if (done) return;
      pending--;
      if (eta !== null && (bestETA === null || eta < bestETA)) {
        bestETA = eta;
        bestDriver = drv.id;
      }
      if (pending <= 0) {
        done = true;
        clearTimeout(timer);
        var finalETA = bestETA !== null ? Math.max(2, bestETA + 1) : null;
        dspEtaVal = finalETA;
        dspBestDriver = bestDriver;
        dspShowETAResult();
      }
    });
  });
}

function dspShowETAResult() {
  var etaValEl = document.getElementById('dsp-eta-val');
  if (!etaValEl) return;
  if (dspEtaVal === null || dspEtaVal === 0) {
    etaValEl.innerHTML = '<span style="color:var(--or)">No drivers available</span>';
  } else {
    var now = new Date();
    var etaTime = new Date(now.getTime() + dspEtaVal * 60000);
    var etaStr = etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    etaValEl.innerHTML = '<strong>' + dspEtaVal + ' min</strong> &middot; ETA ' + etaStr;
  }
}

// Calculate single driver ETA — mirrors rider dispatch engine
function dspCalcDriverETA(drv, newPuLat, newPuLng, callback) {
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

  if (!drvRides.length) {
    dspDriveETA(dlat, dlng, newPuLat, newPuLng).then(function(secs) {
      callback(Math.max(1, Math.ceil(secs / 60)));
    });
    return;
  }

  var totalSecs = 0;
  var curLat = dlat;
  var curLng = dlng;
  var steps = [];

  drvRides.forEach(function(ri) {
    var riPuLat = parseFloat(ri.pu_x);
    var riPuLng = parseFloat(ri.pu_y);
    var riDoLat = parseFloat(ri.do_x);
    var riDoLng = parseFloat(ri.do_y);

    if (ri.status === 'picked_up') {
      if (riDoLat && riDoLng) steps.push({ lat: riDoLat, lng: riDoLng, buf: 30 });
    } else if (ri.status === 'arrived') {
      if (riDoLat && riDoLng) steps.push({ lat: riDoLat, lng: riDoLng, buf: 60 });
    } else if (ri.status === 'accepted' || ri.status === 'en_route') {
      if (riPuLat && riPuLng) steps.push({ lat: riPuLat, lng: riPuLng, buf: 30 });
      if (riDoLat && riDoLng) steps.push({ lat: riDoLat, lng: riDoLng, buf: 30 });
    } else if (ri.status === 'requested') {
      if (riPuLat && riPuLng) steps.push({ lat: riPuLat, lng: riPuLng, buf: 30 });
      if (riDoLat && riDoLng) steps.push({ lat: riDoLat, lng: riDoLng, buf: 30 });
    }
  });

  steps.push({ lat: newPuLat, lng: newPuLng, buf: 0 });

  var idx = 0;
  function next() {
    if (idx >= steps.length) {
      callback(Math.max(1, Math.ceil(totalSecs / 60)));
      return;
    }
    var s = steps[idx];
    dspDriveETA(curLat, curLng, s.lat, s.lng).then(function(secs) {
      totalSecs += secs + s.buf;
      curLat = s.lat;
      curLng = s.lng;
      idx++;
      next();
    });
  }
  next();
}

// Google Directions call — mirrors rider dispatch
function dspDriveETA(fLat, fLng, tLat, tLng) {
  return new Promise(function(resolve) {
    if (!fLat || !fLng || !tLat || !tLng) { resolve(600); return; }
    fLat = parseFloat(fLat); fLng = parseFloat(fLng);
    tLat = parseFloat(tLat); tLng = parseFloat(tLng);

    var dx = tLat - fLat;
    var dy = tLng - fLng;
    var quickDist = Math.sqrt(dx * dx + dy * dy) * 111000;
    if (quickDist < 100) { resolve(30); return; }

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
            resolve(dspHvETA(fLat, fLng, tLat, tLng));
          }
        });
      } catch (e) {
        resolve(dspHvETA(fLat, fLng, tLat, tLng));
      }
    } else {
      resolve(dspHvETA(fLat, fLng, tLat, tLng));
    }
  });
}

function dspHvETA(fLat, fLng, tLat, tLng) {
  var R = 6371000;
  var dLat = (tLat - fLat) * Math.PI / 180;
  var dLng = (tLng - fLng) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(fLat * Math.PI / 180) * Math.cos(tLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(60, Math.round(dist / 6.9));
}

// ============================================================
// MAP PREVIEW — shows pickup/dropoff markers and route
// ============================================================
function dspShowMap() {
  if (!dspPuSel || !dspDoSel) return;
  var wrap = document.getElementById('dsp-map-preview');
  if (wrap) wrap.style.display = 'block';

  if (!dspMap) {
    dspMap = new google.maps.Map(document.getElementById('dsp-map'), {
      center: NC,
      zoom: 13,
      styles: MS,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy'
    });
  }

  // Trigger resize so map renders fully, then scroll into view
  setTimeout(function() {
    google.maps.event.trigger(dspMap, 'resize');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);

  // Clear old markers/route
  if (dspPuMarker) dspPuMarker.setMap(null);
  if (dspDoMarker) dspDoMarker.setMap(null);
  if (dspRouteLine) dspRouteLine.setMap(null);

  dspPuMarker = new google.maps.Marker({
    position: { lat: dspPuSel.lat, lng: dspPuSel.lng },
    map: dspMap,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#22C55E',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    },
    title: 'Pickup: ' + dspPuSel.name
  });

  dspDoMarker = new google.maps.Marker({
    position: { lat: dspDoSel.lat, lng: dspDoSel.lng },
    map: dspMap,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    },
    title: 'Drop-off: ' + dspDoSel.name
  });

  // Draw route
  var ds = new google.maps.DirectionsService();
  var dr = new google.maps.DirectionsRenderer({
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.8 }
  });
  dr.setMap(dspMap);

  ds.route({
    origin: { lat: dspPuSel.lat, lng: dspPuSel.lng },
    destination: { lat: dspDoSel.lat, lng: dspDoSel.lng },
    travelMode: 'DRIVING'
  }, function(res, st) {
    if (st === 'OK') {
      dr.setDirections(res);
    } else {
      dspRouteLine = new google.maps.Polyline({
        path: [
          { lat: dspPuSel.lat, lng: dspPuSel.lng },
          { lat: dspDoSel.lat, lng: dspDoSel.lng }
        ],
        strokeColor: '#3b82f6',
        strokeWeight: 3,
        strokeOpacity: 0.7,
        map: dspMap
      });
    }
  });

  // Fit bounds — also re-fit after a short delay so map is fully sized
  var bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: dspPuSel.lat, lng: dspPuSel.lng });
  bounds.extend({ lat: dspDoSel.lat, lng: dspDoSel.lng });
  dspMap.fitBounds(bounds, 50);
  setTimeout(function() {
    google.maps.event.trigger(dspMap, 'resize');
    dspMap.fitBounds(bounds, 50);
  }, 400);
}

// ============================================================
// SUBMIT RIDE — creates dispatch ride in Supabase as a normal ride
// ============================================================
async function dspSubmitRide() {
  var nameEl = document.getElementById('dsp-name');
  var phoneEl = document.getElementById('dsp-phone');
  var submitBtn = document.getElementById('dsp-submit-btn');

  var name = nameEl ? nameEl.value.trim() : '';
  var phone = phoneEl ? phoneEl.value.trim() : '';

  // Validation
  if (!name) { dspShowStatus('Please enter the caller\'s name.', 'err'); nameEl.focus(); return; }
  if (!phone) { dspShowStatus('Please enter a phone number.', 'err'); phoneEl.focus(); return; }
  if (!dspPuSel) { dspShowStatus('Please select a pickup location.', 'err'); return; }
  if (!dspDoSel) { dspShowStatus('Please select a drop-off location.', 'err'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Dispatching...';

  // Create ride ID (use ride- prefix like normal rides)
  var rideId = 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

  // Build ride object — same schema as rider app, no extra fields
  var ride = {
    id: rideId,
    rider_id: null,
    driver_id: dspBestDriver || null,
    pickup: dspPuSel.name || dspPuSel.address,
    dropoff: dspDoSel.name || dspDoSel.address,
    pu_x: dspPuSel.lat,
    pu_y: dspPuSel.lng,
    do_x: dspDoSel.lat,
    do_y: dspDoSel.lng,
    passengers: dspPassCount,
    status: 'requested',
    phone: phone,
    note: name,
    created_at: new Date().toISOString()
  };

  var result = await api('POST', 'rides', '', ride);

  if (result && result.length) {
    // Log the admin action
    await logAct('dispatch_ride', rideId);

    // Add to local rides array and refresh metrics/map
    rides.unshift(result[0]);
    updateMetrics();

    dspShowStatus('Ride dispatched! Wait time: ' + (dspEtaVal ? dspEtaVal + ' min' : 'Awaiting driver'), 'ok');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Dispatch Ride';

    // Reset form and go to home after short delay so they see it on the map
    setTimeout(function() {
      dspResetForm();
      goPage('home');
    }, 2000);
  } else {
    dspShowStatus('Failed to dispatch ride. Please try again.', 'err');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Dispatch Ride';
  }
}

function dspShowStatus(msg, type) {
  var el = document.getElementById('dsp-status');
  if (!el) return;
  el.style.display = 'block';
  el.className = 'dsp-status dsp-status-' + type;
  el.textContent = msg;
  if (type === 'ok') {
    setTimeout(function() { el.style.display = 'none'; }, 4000);
  }
}

// ============================================================
// RESET FORM
// ============================================================
function dspResetForm() {
  dspPuSel = null;
  dspDoSel = null;
  dspPassCount = 1;
  dspEtaVal = null;
  dspBestDriver = null;

  var nameEl = document.getElementById('dsp-name');
  var phoneEl = document.getElementById('dsp-phone');
  var puEl = document.getElementById('dsp-pickup');
  var doEl = document.getElementById('dsp-dropoff');
  var passEl = document.getElementById('dsp-pass-val');
  var etaBox = document.getElementById('dsp-eta-box');
  var mapWrap = document.getElementById('dsp-map-preview');
  var statusEl = document.getElementById('dsp-status');
  var puTag = document.getElementById('dsp-pu-tag');
  var doTag = document.getElementById('dsp-do-tag');

  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (puEl) puEl.value = '';
  if (doEl) doEl.value = '';
  if (passEl) passEl.textContent = '1';
  if (etaBox) etaBox.style.display = 'none';
  if (mapWrap) mapWrap.style.display = 'none';
  if (statusEl) statusEl.style.display = 'none';
  if (puTag) puTag.innerHTML = '';
  if (doTag) doTag.innerHTML = '';
}
