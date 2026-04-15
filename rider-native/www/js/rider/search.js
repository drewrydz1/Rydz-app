// RYDZ Rider - Search v9
// Apple MapKit native plugin only. Zero Google Places/Geocoder/Directions calls.
// Flow: dest → pickup → pass → existing ride flow

var _recent = [];
try { _recent = JSON.parse(localStorage.getItem('rydz-recent') || '[]'); } catch(e) { _recent = []; }

// Service area center (computed from SVC polygon in maps.js)
var _SVC_CENTER = { lat: 26.1325, lng: -81.798 };
var _SVC_RADIUS = 3000; // tight radius for service area core

// ===== MAPKIT BRIDGE =====
// All place search, autocomplete, and geocoding go through the native
// RydzMapKit Capacitor plugin. No Google fallback — the rider-native
// app is iOS-only so MapKit is always available.
function _mkPlugin() {
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RydzMapKit) {
      return window.Capacitor.Plugins.RydzMapKit;
    }
  } catch (e) {}
  return null;
}
function _hasMK() { return !!_mkPlugin(); }

// ===== PURE-JS POINT-IN-POLYGON (ray casting) =====
// Replaces google.maps.geometry.poly.containsLocation so the service-area
// geofence check has zero Google dependency.
function _pip(lat, lng, poly) {
  if (!poly || poly.length < 3) return false;
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i].lat, yi = poly[i].lng;
    var xj = poly[j].lat, yj = poly[j].lng;
    var intersect = ((yi > lng) !== (yj > lng)) &&
                    (lat < (xj - xi) * (lng - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ===== SERVICE AREA CHECK (uses zones from Supabase, falls back to SVC polygon) =====
var _riderZones=null;
(function(){
  function _loadRiderZones(){
    fetch(SUPA_URL+'/rest/v1/settings?id=eq.1&select=zones',{
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    }).then(function(r){return r.json()}).then(function(res){
      if(res&&res[0]&&res[0].zones){
        try{
          var zd=typeof res[0].zones==='string'?JSON.parse(res[0].zones):res[0].zones;
          // Only use if we have at least one active zone with a valid polygon
          if(zd&&zd.length){
            var hasActive=false;
            for(var i=0;i<zd.length;i++){if(zd[i].active&&zd[i].polygon&&zd[i].polygon.length>=3){hasActive=true;break}}
            _riderZones=hasActive?zd:null;
          }else{_riderZones=null}
        }catch(e){_riderZones=null}
      }
    }).catch(function(){});
  }
  _loadRiderZones();
  setInterval(_loadRiderZones,60000);
})();
window.isInArea = function(lat, lng) {
  // Supabase-configured zones take precedence
  if (_riderZones && _riderZones.length > 0) {
    for (var i = 0; i < _riderZones.length; i++) {
      var z = _riderZones[i];
      if (!z.active || !z.polygon || z.polygon.length < 3) continue;
      if (_pip(lat, lng, z.polygon)) return true;
    }
    return false;
  }
  // Fast bbox reject
  if (lat < 26.087 || lat > 26.178 || lng < -81.823 || lng > -81.774) return false;
  // Default SVC polygon from maps.js
  if (typeof SVC !== 'undefined') return _pip(lat, lng, SVC);
  return true;
};

// ===== HELPERS =====
function _mkPlace(name, addr, lat, lng) {
  return { n: name, a: addr, lat: lat, lng: lng, x: lat, y: lng };
}
function _saveRecent(obj) {
  _recent = _recent.filter(function(p) { return p.n !== obj.n; });
  _recent.unshift(obj);
  if (_recent.length > 10) _recent = _recent.slice(0, 10);
  try { localStorage.setItem('rydz-recent', JSON.stringify(_recent)); } catch(e) {}
}
function _getInput(type) { return document.getElementById(type === 'dest' ? 'ss-dest-inp' : 'ss-pu-inp'); }
function _getBody(type) { return document.getElementById(type === 'dest' ? 'ss-dest-body' : 'ss-pu-body'); }
function _getX(type) { return document.getElementById(type === 'dest' ? 'ss-dest-x' : 'ss-pu-x'); }

// Row HTML — clean, optional category icon
function _row(name, addr, pid, type, iconKey) {
  var iconHtml;
  if (iconKey && typeof CAT_ICONS !== 'undefined' && CAT_ICONS[iconKey]) {
    iconHtml = '<div class="ss-ic"><img src="' + CAT_ICONS[iconKey] + '" width="18" height="18" style="display:block;object-fit:contain" alt=""></div>';
  } else {
    iconHtml = '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bl)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>';
  }
  return '<div class="ss-row" data-pid="' + pid + '" data-type="' + type + '" onclick="ssPick(this)">' +
    iconHtml +
    '<div class="ss-tx"><div class="ss-nm">' + esc(name) + '</div><div class="ss-ad">' + esc(addr) + '</div></div></div>';
}

// ===== RENDER DEFAULTS =====
window.ssDefaults = function(type) {
  var body = _getBody(type);
  if (!body) return;
  var h = '';

  if (type === 'pickup') {
    h += '<div class="ss-row" onclick="ssGPS()">' +
      '<div class="ss-ic" style="background:#e3f2fd"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1976D2" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div>' +
      '<div class="ss-tx"><div class="ss-nm">Current Location</div><div class="ss-ad">Use GPS</div></div></div>';
  }

  var promos = (db && db.settings && db.settings.promotions) || [];
  if (promos.length) {
    h += '<div class="ss-lbl">Featured Places</div>';
    promos.slice(0, 4).forEach(function(p, i) {
      h += '<div class="ss-row" data-idx="' + i + '" data-type="' + type + '" onclick="ssFeatured(this)">' +
        '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>' +
        '<div class="ss-tx"><div class="ss-nm">' + esc(p.name || p.n || '') + '</div><div class="ss-ad">' + esc(p.addr || p.a || 'Naples, FL') + '</div></div></div>';
    });
  }

  if (type === 'dest' && _recent.length) {
    h += '<div class="ss-lbl">Recent</div>';
    _recent.slice(0, 5).forEach(function(p, i) {
      h += '<div class="ss-row" data-ridx="' + i + '" data-type="' + type + '" onclick="ssRecent(this)">' +
        '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 1.5"/></svg></div>' +
        '<div class="ss-tx"><div class="ss-nm">' + esc(p.n) + '</div><div class="ss-ad">' + esc(p.a || '') + '</div></div></div>';
    });
  }

  if (type === 'pickup') {
    var expCats = (typeof _riderCats !== 'undefined' && _riderCats && _riderCats.length) ? _riderCats : [
      { label: 'Dining' }, { label: 'Bars' }, { label: 'Beaches' }, { label: 'Hotels' }, { label: 'Shopping' }
    ];
    if (expCats.length) {
      h += '<div class="ss-lbl">Explore</div>';
      expCats.forEach(function(c) {
        var key = c.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (key === 'recent') return; // skip Recent in explore list
        h += '<div class="ss-explore" onclick="doCatSearch(\'' + key + '\',\'pickup\')">' +
          '<div style="flex:1;font-size:14px;font-weight:600;color:#fff;font-family:var(--font)">' + esc(c.label) + '</div>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g300)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
      });
    }
  }

  body.innerHTML = h || '<div class="ss-empty">Start typing to search</div>';
};

// ===== AUTOCOMPLETE =====
var _ssTimer = null;
window.ssType = function(type) {
  var inp = _getInput(type);
  var xBtn = _getX(type);
  var q = inp ? inp.value.trim() : '';
  if (xBtn) xBtn.style.display = q.length > 0 ? '' : 'none';
  if (_ssTimer) clearTimeout(_ssTimer);
  if (q.length < 2) { ssDefaults(type); return; }
  _ssTimer = setTimeout(function() { _doAutocomplete(q, type); }, 250);
};

function _doAutocomplete(q, type) {
  var body = _getBody(type);
  if (!body) return;

  // Native MapKit search. MKLocalSearch returns full results (name +
  // address + lat/lng) in one shot, so each row encodes its coords
  // directly in the pid as "mk:<lat>,<lng>|<name>|<addr>" — no
  // separate details round-trip needed when the user picks one.
  var mk = _mkPlugin();
  if (!mk) {
    body.innerHTML = '<div class="ss-empty">Search unavailable.</div>';
    return;
  }
  mk.searchPlaces({
    query: q,
    centerLat: _SVC_CENTER.lat,
    centerLng: _SVC_CENTER.lng,
    radiusMeters: 15000,
    maxResults: 15
  }).then(function(res) {
    var results = (res && res.results) || [];
    if (!results.length) {
      body.innerHTML = '<div class="ss-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>No places found</div>';
      return;
    }
    // Rank in-service-area results first
    results.sort(function(a, b) {
      var aIn = isInArea(a.lat, a.lng) ? 0 : 1;
      var bIn = isInArea(b.lat, b.lng) ? 0 : 1;
      return aIn - bIn;
    });
    var h = '<div class="ss-lbl">Search Results</div>';
    results.slice(0, 10).forEach(function(p) {
      var pid = 'mk:' + p.lat + ',' + p.lng + '|' + encodeURIComponent(p.name || '') + '|' + encodeURIComponent(p.address || '');
      h += _row(p.name || p.address, (p.address || '').replace(/, USA$/, ''), pid, type);
    });
    body.innerHTML = h;
  }).catch(function() {
    body.innerHTML = '<div class="ss-empty">Search failed. Please try again.</div>';
  });
}

// ===== CLEAR =====
window.ssClear = function(type) {
  var inp = _getInput(type);
  var xBtn = _getX(type);
  if (inp) { inp.value = ''; inp.focus(); }
  if (xBtn) xBtn.style.display = 'none';
  ssDefaults(type);
};

// ===== SELECT PLACE =====
window.ssPick = function(el) {
  var pid = el.getAttribute('data-pid');
  var type = el.getAttribute('data-type');
  if (!pid) return;
  var body = _getBody(type);

  // Supabase place — already have lat/lng, no API call needed
  if (pid.indexOf('supa:') === 0) {
    var supaId = pid.replace('supa:', '');
    var sp = _supaPlaces ? _supaPlaces.find(function(p) { return p.id === supaId; }) : null;
    if (sp && sp.lat && sp.lng) {
      _finish(_mkPlace(sp.name, sp.address || 'Naples, FL', sp.lat, sp.lng), type);
    } else if (body) {
      body.innerHTML = '<div class="ss-empty">Place not found.</div>';
    }
    return;
  }

  // MapKit place — lat/lng + name/address are encoded in the pid itself,
  // so we finish immediately with no extra call. Format:
  //   "mk:<lat>,<lng>|<encName>|<encAddr>"
  if (pid.indexOf('mk:') === 0) {
    var rest = pid.slice(3);
    var bar = rest.indexOf('|');
    var coords = bar === -1 ? rest : rest.slice(0, bar);
    var after = bar === -1 ? '' : rest.slice(bar + 1);
    var bar2 = after.indexOf('|');
    var name = bar2 === -1 ? after : after.slice(0, bar2);
    var addr = bar2 === -1 ? '' : after.slice(bar2 + 1);
    try { name = decodeURIComponent(name); } catch (e) {}
    try { addr = decodeURIComponent(addr); } catch (e) {}
    var parts = coords.split(',');
    var lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
    if (isFinite(lat) && isFinite(lng)) {
      _finish(_mkPlace(name || addr || 'Place', addr || 'Naples, FL', lat, lng), type);
    } else if (body) {
      body.innerHTML = '<div class="ss-empty">Could not load place. Try again.</div>';
    }
    return;
  }

  if (body) body.innerHTML = '<div class="ss-empty">Unknown place.</div>';
};

window.ssFeatured = function(el) {
  var idx = parseInt(el.getAttribute('data-idx'));
  var type = el.getAttribute('data-type');
  var promos = (db && db.settings && db.settings.promotions) || [];
  var p = promos[idx];
  if (!p) return;
  var name = p.name || p.n || '';
  var addr = p.addr || p.a || 'Naples, FL';
  var body = _getBody(type);
  if (body) body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Loading...</div>';

  var mk = _mkPlugin();
  if (!mk) {
    if (body) body.innerHTML = '<div class="ss-empty">Search unavailable.</div>';
    return;
  }
  mk.geocode({ address: name + ', ' + addr }).then(function(r) {
    if (r && isFinite(r.lat) && isFinite(r.lng)) {
      _finish(_mkPlace(name, addr, r.lat, r.lng), type);
    } else if (body) {
      body.innerHTML = '<div class="ss-empty">Could not find this place.</div>';
    }
  }).catch(function() {
    if (body) body.innerHTML = '<div class="ss-empty">Could not find this place.</div>';
  });
};

window.ssRecent = function(el) {
  var idx = parseInt(el.getAttribute('data-ridx'));
  var type = el.getAttribute('data-type');
  var p = _recent[idx];
  if (!p) return;
  if (!p.x && p.lat) { p.x = p.lat; p.y = p.lng; }
  _finish(p, type);
};

window.ssGPS = function() {
  if (!navigator.geolocation) { showToast('Location not available.'); return; }
  var body = _getBody('pickup');
  if (body) body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Getting location...</div>';
  navigator.geolocation.getCurrentPosition(function(pos) {
    _finish(_mkPlace('Current Location', 'Your location', pos.coords.latitude, pos.coords.longitude), 'pickup');
  }, function() {
    showToast('Unable to get location. Please type an address.');
    ssDefaults('pickup');
  }, { enableHighAccuracy: true, timeout: 10000 });
};

function _finish(obj, type) {
  // Block out-of-area selections immediately
  if(obj&&obj.lat&&typeof isInArea==='function'&&!isInArea(obj.lat,obj.lng)){
    showToast((type==='dest'?'Drop-off':'Pickup')+' location is outside the Rydz service area.');
    return;
  }
  if (type === 'dest') { doSel = obj; _saveRecent(obj); go('search-pickup'); }
  else { puSel = obj; _saveRecent(obj); go('pass'); }
}

// ========================================================================
// CATEGORY SEARCH — Supabase places first, then MapKit natural-language
// ========================================================================

// Category → natural-language query MapKit understands
var _catConfig = {
  recent:        { textQuery: '' },
  dining:        { textQuery: 'restaurants Naples FL' },
  restaurants:   { textQuery: 'restaurants Naples FL' },
  bars:          { textQuery: 'bars nightlife Naples FL' },
  hotels:        { textQuery: 'hotels resorts Naples FL' },
  beaches:       { textQuery: 'beach Naples Marco Island FL' },
  shopping:      { textQuery: 'shopping stores Naples FL' },
  coffee:        { textQuery: 'coffee shops Naples FL' },
  parks:         { textQuery: 'parks Naples FL' },
  entertainment: { textQuery: 'entertainment Naples FL' },
  attractions:   { textQuery: 'attractions things to do Naples FL' },
  gym:           { textQuery: 'gyms fitness Naples FL' },
  pharmacy:      { textQuery: 'pharmacy Naples FL' },
  gas:           { textQuery: 'gas stations Naples FL' }
};

window.openCatSearch = function(cat) {
  if (cat === 'recent') {
    go('search-dest');
    setTimeout(function() {
      var body = _getBody('dest');
      if (!body) return;
      if (!_recent.length) { body.innerHTML = '<div class="ss-empty">No recent places yet.</div>'; return; }
      var h = '<div class="ss-lbl">Recent</div>';
      _recent.forEach(function(p, i) {
        h += '<div class="ss-row" data-ridx="' + i + '" data-type="dest" onclick="ssRecent(this)">' +
          '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 1.5"/></svg></div>' +
          '<div class="ss-tx"><div class="ss-nm">' + esc(p.n) + '</div><div class="ss-ad">' + esc(p.a || '') + '</div></div></div>';
      });
      body.innerHTML = h;
    }, 120);
    return;
  }
  go('search-dest');
  setTimeout(function() { doCatSearch(cat, 'dest'); }, 120);
};

// ===== SUPABASE PLACES CACHE =====
var _supaPlaces = null;
var _supaPlaceCats = null;
var _supaReady = false;
var _supaLoadPromise = null;

function _loadSupaPlaces() {
  if (_supaLoadPromise) return _supaLoadPromise;
  _supaLoadPromise = Promise.all([
    supaFetch('GET', 'places', '?active=eq.true&order=priority.desc'),
    supaFetch('GET', 'place_categories', '')
  ]).then(function(results) {
    _supaPlaces = (results[0] && Array.isArray(results[0])) ? results[0] : [];
    _supaPlaceCats = (results[1] && Array.isArray(results[1])) ? results[1] : [];
    _supaReady = true;
  }).catch(function() {
    _supaPlaces = []; _supaPlaceCats = []; _supaReady = true;
  });
  return _supaLoadPromise;
}

// Start loading early
setTimeout(_loadSupaPlaces, 500);

function _getSupaPlacesForCat(catLabel) {
  if (!_supaReady || !_supaPlaces || !_supaPlaceCats) return [];
  // Find category ID — needs real Supabase categories with UUIDs
  var catId = null;
  if (typeof _riderCats !== 'undefined' && _riderCats) {
    var cat = _riderCats.find(function(c) {
      return c.id && c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === catLabel;
    });
    if (cat) catId = cat.id;
  }
  if (!catId) return [];

  var placeIds = _supaPlaceCats
    .filter(function(pc) { return pc.category_id === catId; })
    .map(function(pc) { return pc.place_id; });

  // Return filtered + sorted by priority DESC (100 at top, 1 at bottom)
  return _supaPlaces
    .filter(function(p) { return placeIds.indexOf(p.id) > -1; })
    .sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
}

window.doCatSearch = function(cat, screenType) {
  var body = _getBody(screenType);
  if (!body) return;
  body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Loading...</div>';

  var label = cat.charAt(0).toUpperCase() + cat.slice(1);

  // Find the category's icon_key for place rows
  var _catIconKey = null;
  if (typeof _riderCats !== 'undefined' && _riderCats) {
    var _catMatch = _riderCats.find(function(c) {
      return c.label && c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === cat;
    });
    if (_catMatch) _catIconKey = _catMatch.icon_key;
  }

  // Wait for Supabase data, then search
  _loadSupaPlaces().then(function() {
    var supaResults = _getSupaPlacesForCat(cat);

    if (supaResults.length) {
      var h = '<div class="ss-lbl">' + label + '</div>';
      supaResults.forEach(function(p) {
        h += _row(p.name, p.address || 'Naples, FL', 'supa:' + p.id, screenType, _catIconKey);
      });
      body.innerHTML = h;
      return;
    }

    var config = _catConfig[cat] || { textQuery: cat + ' Naples FL' };

    var mk = _mkPlugin();
    if (!mk) {
      body.innerHTML = '<div class="ss-empty">Search unavailable.</div>';
      return;
    }
    mk.searchPlaces({
      query: config.textQuery,
      centerLat: _SVC_CENTER.lat,
      centerLng: _SVC_CENTER.lng,
      radiusMeters: 20000,
      maxResults: 25
    }).then(function(res) {
      var raw = (res && res.results) || [];
      // Filter to in-area, dedupe by coord
      var seen = {};
      var filtered = raw.filter(function(r) {
        var k = r.lat.toFixed(5) + ',' + r.lng.toFixed(5);
        if (seen[k]) return false;
        seen[k] = true;
        return isInArea(r.lat, r.lng);
      });
      if (!filtered.length) {
        body.innerHTML = '<div class="ss-empty">No ' + label.toLowerCase() + ' found in the service area.</div>';
        return;
      }
      var h = '<div class="ss-lbl">' + label + '</div>';
      filtered.forEach(function(p) {
        var pid = 'mk:' + p.lat + ',' + p.lng + '|' + encodeURIComponent(p.name || '') + '|' + encodeURIComponent(p.address || '');
        h += _row(p.name || p.address, (p.address || 'Naples, FL').replace(/, USA$/, ''), pid, screenType, _catIconKey);
      });
      body.innerHTML = h;
    }).catch(function() {
      body.innerHTML = '<div class="ss-empty">Search failed. Try again.</div>';
    });
  });
};

// ssLoadMore — legacy no-op (MapKit returns a single batch, no pagination)
window.ssLoadMore = function() {};

// ===== BACKWARD COMPATIBILITY =====
window.chkBtn = function() { var b = document.getElementById('h-btn'); if (b) b.disabled = !(puSel && doSel); };
window.onTyp = function() {};
window.clr = function(k) { if (k === 'pu') puSel = null; else doSel = null; };
window.selPlace = function() {};

window.showToast = function(msg) {
  var ov = document.getElementById('sa-ov'); if (ov) ov.remove();
  var md = document.getElementById('sa-md'); if (md) md.remove();
  ov = document.createElement('div'); ov.id = 'sa-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99998';
  md = document.createElement('div'); md.id = 'sa-md';
  md.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:28px 24px;border-radius:20px;font-size:15px;font-weight:600;font-family:Poppins,sans-serif;z-index:99999;box-shadow:0 16px 50px rgba(0,0,0,.25);max-width:300px;text-align:center;line-height:1.5';
  md.innerHTML = '<div style="width:48px;height:48px;border-radius:50%;background:#ffe5e5;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg width="22" height="22" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v5M11 14.5h.01"/></svg></div><p style="margin-bottom:16px;color:#1d1d1f">' + msg + '</p><button id="sa-btn" style="width:100%;padding:13px;background:#007AFF;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Poppins,sans-serif">Got it</button>';
  ov.onclick = function() { ov.remove(); md.remove(); };
  document.body.appendChild(ov); document.body.appendChild(md);
  document.getElementById('sa-btn').onclick = function() { var o=document.getElementById('sa-ov'),m=document.getElementById('sa-md'); if(o)o.remove(); if(m)m.remove(); };
};
