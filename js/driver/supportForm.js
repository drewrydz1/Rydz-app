// RYDZ Driver - Support & Dispatch Forms
// Dispatch panel: create rides for callers, finds best driver via ETA algo

function openDM(id){closeSB();if(id==='create'){crPU=null;crDO=null;
var html='<div class="mtop"><button class="btn btn-ghost" onclick="closeDM()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>Dispatch</h2></div>'+
'<div style="padding:20px"><p style="font-size:12px;color:var(--g400);margin-bottom:16px">Create a ride for a caller. Finds the nearest driver automatically.</p>'+
'<div class="ff"><label>Caller\'s Full Name</label><input id="cr-name" placeholder="e.g. John Smith" autocomplete="off"></div>'+
'<div class="fw"><div class="ff" style="margin:0"><label>Pickup Location</label><input id="cr-pu" placeholder="Search pickup location" autocomplete="off" oninput="crTyp(\'pu\')" onfocus="crTyp(\'pu\')"></div><div class="acl" id="cr-ac-pu"></div></div>'+
'<div class="fw"><div class="ff" style="margin:0"><label>Drop-off Location</label><input id="cr-do" placeholder="Search drop-off location" autocomplete="off" oninput="crTyp(\'do\')" onfocus="crTyp(\'do\')"></div><div class="acl" id="cr-ac-do"></div></div>'+
'<div class="ff"><label>Phone Number</label><input id="cr-phone" type="tel" placeholder="(239) 555-0100"></div>'+
'<div class="ff"><label>Number of Passengers</label><div style="display:flex;align-items:center;gap:14px"><button class="btn btn-dark" style="width:40px;height:40px;border-radius:50%;padding:0;font-size:20px;display:flex;align-items:center;justify-content:center" onclick="crPassAdj(-1)">&#8722;</button><span id="cr-pass-val" style="font-size:22px;font-weight:800;font-family:var(--font);min-width:24px;text-align:center">1</span><button class="btn btn-dark" style="width:40px;height:40px;border-radius:50%;padding:0;font-size:20px;display:flex;align-items:center;justify-content:center" onclick="crPassAdj(1)">+</button></div></div>'+
'<div id="cr-eta-box" style="display:none;padding:14px;background:var(--g50);border:1px solid var(--g150);border-radius:12px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:12px"><div style="width:44px;height:44px;border-radius:50%;background:rgba(0,122,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" fill="none" stroke="var(--bl)" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 1.5"/></svg></div><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--g400);letter-spacing:.5px">Estimated Wait</div><div id="cr-eta-val" style="font-size:15px;font-weight:700;margin-top:2px">--</div></div></div></div>'+
'<div class="fe" id="cr-err"></div>'+
'<button class="btn btn-p btn-lg btn-w" id="cr-submit-btn" style="margin-top:4px" onclick="submitCR()">Dispatch Ride</button>'+
'</div>';
document.getElementById('ms-create').innerHTML=html;
document.getElementById('ms-create').classList.add('on')}
if(id==='dashboard'){var shiftDone=db.rides.filter(function(r){return r.driverId===DID&&r.status==='completed'}).length;var shiftCanc=db.rides.filter(function(r){return r.driverId===DID&&r.status==='cancelled'}).length;var totalR=shiftDone+shiftCanc;var el=document.getElementById('ms-dashboard');el.innerHTML='<div class="mtop"><button class="btn btn-ghost" onclick="closeDM()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>Dashboard</h2></div><div style="padding:20px"><h3 style="font-size:16px;font-weight:800;margin-bottom:14px">Shift Statistics</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="card" style="margin:0;text-align:center;padding:16px"><svg width="22" height="22" fill="none" stroke="var(--gn)" stroke-width="2" style="margin-bottom:6px"><path d="M20 6L9 17l-5-5"/></svg><div style="font-size:28px;font-weight:900;color:var(--g800)">'+shiftDone+'</div><div style="font-size:11px;color:var(--g400);font-weight:600;font-family:var(--font2);margin-top:2px">Completed</div></div><div class="card" style="margin:0;text-align:center;padding:16px"><svg width="22" height="22" fill="none" stroke="var(--rd)" stroke-width="2" style="margin-bottom:6px"><path d="M18 6L6 18M6 6l12 12"/></svg><div style="font-size:28px;font-weight:900;color:var(--g800)">'+shiftCanc+'</div><div style="font-size:11px;color:var(--g400);font-weight:600;font-family:var(--font2);margin-top:2px">Cancelled</div></div><div class="card" style="margin:0;text-align:center;padding:16px"><svg width="22" height="22" fill="none" stroke="var(--or)" stroke-width="2" style="margin-bottom:6px"><path d="M11 1l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L11 15.4 5.4 18.2l1.1-6.2L2 7.6l6.2-.9L11 1z"/></svg><div style="font-size:28px;font-weight:900;color:var(--g800)">5.0</div><div style="font-size:11px;color:var(--g400);font-weight:600;font-family:var(--font2);margin-top:2px">Avg Rating</div></div><div class="card" style="margin:0;text-align:center;padding:16px"><svg width="22" height="22" fill="none" stroke="var(--cy)" stroke-width="2" style="margin-bottom:6px"><circle cx="11" cy="11" r="9"/><path d="M11 6v5l3 2"/></svg><div style="font-size:28px;font-weight:900;color:var(--g800)">$0</div><div style="font-size:11px;color:var(--g400);font-weight:600;font-family:var(--font2);margin-top:2px">Tips Earned</div></div></div><div class="card" style="margin-top:10px;text-align:center;padding:16px"><div style="font-size:36px;font-weight:900;color:var(--bl)">'+totalR+'</div><div style="font-size:12px;color:var(--g400);font-weight:600;font-family:var(--font2);margin-top:2px">Total Rides This Shift</div></div><p style="font-size:11px;color:var(--g300);text-align:center;margin-top:14px;font-family:var(--font2)">Stats reset every 24 hours</p></div>';el.classList.add('on')}
if(id==='profile'){var drv=gD();if(!drv)return;document.getElementById('ms-profile').innerHTML='<div class="mtop"><button class="btn btn-ghost" onclick="closeDM()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>My Profile</h2></div><div style="padding:24px 20px"><div style="text-align:center;margin-bottom:20px"><div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--bl),var(--cy));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:36px;margin:0 auto 10px;position:relative">'+drv.name[0]+'<div style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:50%;background:var(--w);border:2px solid var(--g200);display:flex;align-items:center;justify-content:center;cursor:pointer"><svg width="14" height="14" fill="none" stroke="var(--g500)" stroke-width="2"><path d="M12 3l3 3-9 9H3v-3l9-9z"/></svg></div></div><p style="font-size:11px;color:var(--g400);font-family:var(--font2)">Tap to update photo</p></div><div style="background:var(--g50);border:1px solid var(--g150);border-radius:var(--r2);overflow:hidden"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--g150)"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">First Name</span><span style="font-size:15px;font-weight:600">'+(drv.firstName||drv.name.split(' ')[0]||'')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--g150)"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">Last Name</span><span style="font-size:15px;font-weight:600">'+(drv.lastName||drv.name.split(' ').slice(1).join(' ')||'')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--g150)"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">Email</span><span style="font-size:15px;font-weight:600">'+(drv.email||'Not set')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--g150)"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">Phone</span><span style="font-size:15px;font-weight:600">'+(drv.phone||'Not set')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--g150)"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">Vehicle</span><span style="font-size:15px;font-weight:600">'+esc(drv.vehicle||'')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px"><span style="font-size:11px;color:var(--g400);font-weight:700;text-transform:uppercase;font-family:var(--font2)">Status</span><span style="font-size:15px;font-weight:600;color:'+(drv.status==='online'?'var(--gn)':'var(--g400)')+'">'+drv.status.toUpperCase()+'</span></div></div></div>';document.getElementById('ms-profile').classList.add('on')}
if(id==='history'){var rides=db.rides.filter(function(r){return r.driverId===DID}).sort(function(a,b){return(b.completedAt||b.createdAt)-(a.completedAt||a.createdAt)}).reverse();var h='<div class="mtop"><button class="btn btn-ghost" onclick="closeDM()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>Ride History</h2></div>';if(!rides.length)h+='<div class="empty"><svg width="40" height="40" fill="none" stroke="var(--g300)" stroke-width="1.5"><circle cx="20" cy="20" r="18"/><path d="M20 10v10l5 2.5"/></svg><h4>No rides yet</h4><p>Completed rides will appear here.</p></div>';rides.forEach(function(r){var ri=r.riderId?db.users.find(function(u){return u.id===r.riderId}):null;var rn=ri?ri.name:'Dispatch Ride';var rPhone=r.phone||(ri?ri.phone:'')||'';var nt=r.note||'None';var sc=r.status==='completed'?'background:var(--gnl);color:var(--gn)':r.status==='cancelled'?'background:var(--rdl);color:var(--rd)':'background:var(--blp);color:var(--bl)';h+='<div style="padding:16px 20px;border-bottom:1px solid var(--g100)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;'+sc+'">'+r.status.toUpperCase()+'</span><span style="font-size:11px;color:var(--g400);font-family:var(--font2)">'+fmt(r.createdAt)+'</span></div><div class="route">'+RDOTS+'<div class="route-i"><span class="route-lbl">PICKUP</span><p>'+esc(r.pickup)+'</p><div class="route-dv"><span class="route-lbl">DROP-OFF</span><p>'+esc(r.dropoff)+'</p></div></div></div><div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--g50);border:1px solid var(--g150);border-radius:10px;margin:8px 0 4px"><div><span style="font-size:10px;color:var(--g400);font-family:var(--font2);display:block">RIDER</span><span style="font-weight:700;font-size:13px">'+esc(rn)+'</span></div>'+(rPhone?'<a href="tel:'+esc(rPhone)+'" style="display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--gn);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:12px;font-family:var(--font)"><svg width="13" height="13" fill="none" stroke="#fff" stroke-width="2"><path d="M1 2.5A1.5 1.5 0 012.5 1h2.1a1 1 0 01.95.68l.7 2.1a1 1 0 01-.26 1.03l-.9.9a8 8 0 003.2 3.2l.9-.9a1 1 0 011.03-.26l2.1.7a1 1 0 01.68.95v2.1a1.5 1.5 0 01-1.5 1.5A12 12 0 011 2.5z"/></svg>Call</a>':'')+'</div><div style="font-size:12px;color:var(--g500);font-family:var(--font2)"><b style="color:var(--g400)">Notes:</b> '+esc(nt)+'</div><div style="display:flex;gap:10px;margin-top:4px;font-size:11px;color:var(--g400);font-family:var(--font2)"><span>'+r.passengers+' passengers</span></div></div>'});document.getElementById('ms-history').innerHTML=h;document.getElementById('ms-history').classList.add('on')}}
function closeDM(){document.querySelectorAll('.mscr').forEach(function(m){m.classList.remove('on')})}

// Passenger count adjuster
var _crPassCount = 1;
function crPassAdj(d) {
  _crPassCount = Math.max(1, Math.min(6, _crPassCount + d));
  var el = document.getElementById('cr-pass-val');
  if (el) el.textContent = _crPassCount;
}

// Autocomplete setup for create ride fields
function crTyp(k){var inp=document.getElementById(k==='pu'?'cr-pu':'cr-do');if(!gmapLoaded){loadGMaps(function(){crTyp(k)});return}if(!gmaps['crac_'+k]){var ac=new google.maps.places.Autocomplete(inp,{bounds:new google.maps.LatLngBounds({lat:26.0874,lng:-81.8228},{lat:26.1782,lng:-81.7735}),strictBounds:true,types:['establishment','geocode'],componentRestrictions:{country:'us'}});ac.addListener('place_changed',function(){var place=ac.getPlace();if(!place||!place.geometry)return;var loc=place.geometry.location;var name=place.name||place.formatted_address;if(k==='pu'){crPU={name:name,lat:loc.lat(),lng:loc.lng()}}else{crDO={name:name,lat:loc.lat(),lng:loc.lng()}}
// Auto-calc ETA when both selected
if(crPU&&crDO){crCalcETA()}
});gmaps['crac_'+k]=ac}}

// ============================================================
// ETA CALCULATION — same algo as admin dispatch
// Finds best driver, chains ride timelines, uses Directions API
// ============================================================
function crCalcETA() {
  if (!crPU) return;
  var etaBox = document.getElementById('cr-eta-box');
  var etaVal = document.getElementById('cr-eta-val');
  if (etaBox) etaBox.style.display = 'block';
  if (etaVal) etaVal.textContent = 'Calculating...';

  var drivers = db.users.filter(function(u) { return u.role === 'driver' && u.status === 'online'; });
  if (!drivers.length) {
    if (etaVal) etaVal.innerHTML = '<span style="color:var(--rd)">No drivers online</span>';
    window._crBestDriver = null;
    window._crEtaMin = null;
    return;
  }

  var puLat = crPU.lat, puLng = crPU.lng;
  var bestETA = null, bestDriver = null;
  var pending = drivers.length, done = false;

  var timer = setTimeout(function() {
    if (!done) {
      done = true;
      window._crBestDriver = bestDriver;
      window._crEtaMin = bestETA;
      _crShowETA();
    }
  }, 8000);

  drivers.forEach(function(drv) {
    if (done) return;
    _crCalcDriverETA(drv, puLat, puLng, function(eta) {
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
        window._crBestDriver = bestDriver;
        window._crEtaMin = finalETA;
        _crShowETA();
      }
    });
  });
}

function _crShowETA() {
  var etaVal = document.getElementById('cr-eta-val');
  if (!etaVal) return;
  if (!window._crEtaMin) {
    etaVal.innerHTML = '<span style="color:var(--or)">No drivers available</span>';
  } else {
    var etaTime = new Date(Date.now() + window._crEtaMin * 60000);
    var etaStr = etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    etaVal.innerHTML = '<strong>' + window._crEtaMin + ' min</strong> &middot; ETA ' + etaStr;
  }
}

function _crCalcDriverETA(drv, newPuLat, newPuLng, callback) {
  var dlat = drv.lat ? parseFloat(drv.lat) : 26.1334;
  var dlng = drv.lng ? parseFloat(drv.lng) : -81.7935;

  // Get this driver's active/queued rides (driver app uses camelCase)
  var drvRides = db.rides.filter(function(ri) {
    return ri.driverId === drv.id &&
      ['accepted', 'en_route', 'arrived', 'picked_up', 'requested'].indexOf(ri.status) >= 0;
  }).sort(function(a, b) {
    var aActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(a.status) >= 0 ? 0 : 1;
    var bActive = ['accepted', 'en_route', 'arrived', 'picked_up'].indexOf(b.status) >= 0 ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    var ta = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt || 0).getTime();
    var tb = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });

  if (!drvRides.length) {
    _crDriveETA(dlat, dlng, newPuLat, newPuLng).then(function(secs) {
      callback(Math.max(1, Math.ceil(secs / 60)));
    });
    return;
  }

  var totalSecs = 0, curLat = dlat, curLng = dlng, steps = [];
  drvRides.forEach(function(ri) {
    var rpLat = parseFloat(ri.puX), rpLng = parseFloat(ri.puY);
    var rdLat = parseFloat(ri.doX), rdLng = parseFloat(ri.doY);
    if (ri.status === 'picked_up') {
      if (rdLat && rdLng) steps.push({ lat: rdLat, lng: rdLng, buf: 30 });
    } else if (ri.status === 'arrived') {
      if (rdLat && rdLng) steps.push({ lat: rdLat, lng: rdLng, buf: 60 });
    } else {
      if (rpLat && rpLng) steps.push({ lat: rpLat, lng: rpLng, buf: 30 });
      if (rdLat && rdLng) steps.push({ lat: rdLat, lng: rdLng, buf: 30 });
    }
  });
  steps.push({ lat: newPuLat, lng: newPuLng, buf: 0 });

  var idx = 0;
  function next() {
    if (idx >= steps.length) { callback(Math.max(1, Math.ceil(totalSecs / 60))); return; }
    var s = steps[idx];
    _crDriveETA(curLat, curLng, s.lat, s.lng).then(function(secs) {
      totalSecs += secs + s.buf;
      curLat = s.lat; curLng = s.lng; idx++; next();
    });
  }
  next();
}

function _crDriveETA(fLat, fLng, tLat, tLng) {
  return new Promise(function(resolve) {
    if (!fLat || !fLng || !tLat || !tLng) { resolve(600); return; }
    fLat = parseFloat(fLat); fLng = parseFloat(fLng);
    tLat = parseFloat(tLat); tLng = parseFloat(tLng);
    var dx = tLat - fLat, dy = tLng - fLng;
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
          } else { resolve(_crHvETA(fLat, fLng, tLat, tLng)); }
        });
      } catch (e) { resolve(_crHvETA(fLat, fLng, tLat, tLng)); }
    } else { resolve(_crHvETA(fLat, fLng, tLat, tLng)); }
  });
}

function _crHvETA(fLat, fLng, tLat, tLng) {
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
// SUBMIT — POST ride to Supabase, same schema as rider/admin
// ============================================================
async function submitCR() {
  var nameEl = document.getElementById('cr-name');
  var phoneEl = document.getElementById('cr-phone');
  var errEl = document.getElementById('cr-err');
  var btn = document.getElementById('cr-submit-btn');

  var callerName = nameEl ? nameEl.value.trim() : '';
  var phone = phoneEl ? phoneEl.value.trim() : '';
  var passengers = _crPassCount || 1;

  if (!callerName) { errEl.textContent = 'Please enter the caller\'s name.'; errEl.classList.add('show'); nameEl.focus(); return; }
  if (!crPU || !crDO) { errEl.textContent = 'Please select pickup and drop-off from suggestions.'; errEl.classList.add('show'); return; }
  if (!phone) { errEl.textContent = 'Please enter a phone number.'; errEl.classList.add('show'); phoneEl.focus(); return; }
  errEl.classList.remove('show');

  if (btn) { btn.disabled = true; btn.textContent = 'Dispatching...'; }

  var rideId = 'ride-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  var drvName = gD() ? gD().name : 'Driver';

  // POST directly to Supabase — same schema as rider app
  var body = {
    id: rideId,
    rider_id: null,
    driver_id: window._crBestDriver || null,
    pickup: crPU.name,
    dropoff: crDO.name,
    pu_x: crPU.lat,
    pu_y: crPU.lng,
    do_x: crDO.lat,
    do_y: crDO.lng,
    passengers: passengers,
    status: 'requested',
    phone: phone,
    note: 'DISPATCH: ' + callerName + ' — Dispatched by ' + drvName,
    created_at: new Date().toISOString()
  };

  try {
    var res = await fetch(SUPA_URL + '/rest/v1/rides', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      var errText = await res.text();
      console.error('Dispatch ride failed:', errText);
      errEl.textContent = 'Failed to dispatch ride. Please try again.';
      errEl.classList.add('show');
      if (btn) { btn.disabled = false; btn.textContent = 'Dispatch Ride'; }
      return;
    }

    // Success — add to local db and refresh
    var result = await res.json();
    if (result && result[0]) {
      var r = result[0];
      db.rides.push({
        id: r.id, riderId: r.rider_id, driverId: r.driver_id,
        pickup: r.pickup, dropoff: r.dropoff,
        puX: r.pu_x, puY: r.pu_y, doX: r.do_x, doY: r.do_y,
        passengers: r.passengers, status: r.status,
        phone: r.phone, note: r.note,
        createdAt: r.created_at, completedAt: r.completed_at
      });
    }

    showToast('Ride dispatched! ETA: ' + (window._crEtaMin ? window._crEtaMin + ' min' : 'Awaiting driver'));
    closeDM();
    _crPassCount = 1;
    window._crBestDriver = null;
    window._crEtaMin = null;
    ren();

  } catch (err) {
    console.error('Dispatch network error:', err);
    errEl.textContent = 'Network error. Please try again.';
    errEl.classList.add('show');
    if (btn) { btn.disabled = false; btn.textContent = 'Dispatch Ride'; }
  }
}
