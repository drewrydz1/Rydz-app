// RYDZ Rider - Search v7
// Google Places with service-area priority + pagination
// Flow: dest → pickup → pass → existing ride flow

var _recent = [];
try { _recent = JSON.parse(localStorage.getItem('rydz-recent') || '[]'); } catch(e) { _recent = []; }

// Service area center (computed from SVC polygon in maps.js)
var _SVC_CENTER = { lat: 26.1325, lng: -81.798 };
var _SVC_RADIUS = 3000; // tight radius for service area core

// ===== SERVICE AREA CHECK (uses actual SVC polygon from maps.js) =====
window.isInArea = function(lat, lng) {
  if (lat < 26.087 || lat > 26.178 || lng < -81.823 || lng > -81.774) return false;
  if (typeof google !== 'undefined' && google.maps && google.maps.geometry && typeof SVC !== 'undefined') {
    try { return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat, lng), new google.maps.Polygon({ paths: SVC })); } catch(e) {}
  }
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

function _plSvc() {
  if (!window.__plSvc) {
    var el = document.createElement('div');
    el.style.cssText = 'width:0;height:0;position:absolute';
    document.body.appendChild(el);
    window.__plSvc = new google.maps.places.PlacesService(el);
  }
  return window.__plSvc;
}

// Row HTML — clean, no labels
function _row(name, addr, pid, type) {
  return '<div class="ss-row" data-pid="' + pid + '" data-type="' + type + '" onclick="ssPick(this)">' +
    '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bl)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>' +
    '<div class="ss-tx"><div class="ss-nm">' + esc(name) + '</div><div class="ss-ad">' + esc(addr) + '</div></div></div>';
}

// Load more button
function _loadMoreBtn(id) {
  return '<div id="' + id + '" class="ss-row" style="justify-content:center;padding:14px 20px;cursor:pointer" onclick="ssLoadMore()">' +
    '<span style="font-size:13px;font-weight:600;color:var(--bl)">Load more results</span></div>';
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
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
    var body = _getBody(type);
    if (body) body.innerHTML = '<div class="ss-empty">Google Maps is loading...</div>';
    return;
  }
  if (!window._acs) window._acs = new google.maps.places.AutocompleteService();

  window._acs.getPlacePredictions({
    input: q,
    componentRestrictions: { country: 'us' },
    locationBias: { center: _SVC_CENTER, radius: 8000 }
  }, function(preds, status) {
    var body = _getBody(type);
    if (!body) return;
    if (status !== 'OK' || !preds || !preds.length) {
      body.innerHTML = '<div class="ss-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>No places found</div>';
      return;
    }

    // Sort Naples results first
    var sorted = preds.slice().sort(function(a, b) {
      var aD = (a.description || '').toLowerCase();
      var bD = (b.description || '').toLowerCase();
      var aLocal = aD.indexOf('naples') > -1 || aD.indexOf('5th ave') > -1 || aD.indexOf('third st') > -1 || aD.indexOf('3rd st') > -1;
      var bLocal = bD.indexOf('naples') > -1 || bD.indexOf('5th ave') > -1 || bD.indexOf('third st') > -1 || bD.indexOf('3rd st') > -1;
      if (aLocal && !bLocal) return -1;
      if (!aLocal && bLocal) return 1;
      return 0;
    });

    var h = '<div class="ss-lbl">Search Results</div>';
    sorted.slice(0, 8).forEach(function(p) {
      var main = p.structured_formatting ? p.structured_formatting.main_text : p.description;
      var sec = p.structured_formatting ? (p.structured_formatting.secondary_text || '') : '';
      sec = sec.replace(/, USA$/, '').replace(/, United States$/, '');
      h += _row(main, sec, p.place_id, type);
    });
    body.innerHTML = h;
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

  // Supabase place — already have lat/lng, no Google call needed
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

  // Google place — needs getDetails
  if (body) body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Loading...</div>';
  try {
    _plSvc().getDetails({ placeId: pid, fields: ['name', 'formatted_address', 'geometry'] }, function(place, status) {
      if (status !== 'OK' || !place || !place.geometry) {
        if (body) body.innerHTML = '<div class="ss-empty">Could not load place. Try again.</div>';
        return;
      }
      var loc = place.geometry.location;
      _finish(_mkPlace(place.name || place.formatted_address, place.formatted_address || '', loc.lat(), loc.lng()), type);
    });
  } catch(e) {
    if (body) body.innerHTML = '<div class="ss-empty">Error loading place.</div>';
  }
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
  if (!window._geo) window._geo = new google.maps.Geocoder();
  window._geo.geocode({ address: name + ', ' + addr }, function(results, status) {
    if (status === 'OK' && results[0]) {
      var loc = results[0].geometry.location;
      _finish(_mkPlace(name, addr, loc.lat(), loc.lng()), type);
    } else {
      if (body) body.innerHTML = '<div class="ss-empty">Could not find this place.</div>';
    }
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
  if (type === 'dest') { doSel = obj; _saveRecent(obj); go('search-pickup'); }
  else { puSel = obj; _saveRecent(obj); go('pass'); }
}

// ========================================================================
// CATEGORY SEARCH — service-area priority + pagination (load more)
// ========================================================================

// Category → Google Places type(s) + text queries
var _catConfig = {
  recent:        { types: [], textQuery: '' },
  dining:        { types: ['restaurant', 'cafe', 'meal_takeaway'], textQuery: 'restaurants Naples FL' },
  restaurants:   { types: ['restaurant', 'cafe', 'meal_takeaway'], textQuery: 'restaurants Naples FL' },
  bars:          { types: ['bar', 'night_club'],                    textQuery: 'bars nightlife Naples FL' },
  hotels:        { types: ['lodging'],                              textQuery: 'hotels resorts Naples FL' },
  beaches:       { types: [],                                       textQuery: 'beach Naples Marco Island FL' },
  shopping:      { types: ['shopping_mall', 'store', 'clothing_store'], textQuery: 'shopping stores Naples FL' },
  coffee:        { types: ['cafe'],                                 textQuery: 'coffee shops Naples FL' },
  parks:         { types: ['park'],                                 textQuery: 'parks Naples FL' },
  entertainment: { types: ['movie_theater', 'amusement_park'],      textQuery: 'entertainment Naples FL' },
  attractions:   { types: ['tourist_attraction'],                   textQuery: 'attractions things to do Naples FL' },
  gym:           { types: ['gym'],                                  textQuery: 'gyms fitness Naples FL' },
  pharmacy:      { types: ['pharmacy'],                             textQuery: 'pharmacy Naples FL' },
  gas:           { types: ['gas_station'],                          textQuery: 'gas stations Naples FL' }
};

// Pagination state
var _catPagination = null;
var _catAllResults = [];
var _catScreenType = 'dest';
var _catLabel = '';

// Split results into service-area and outside, render them
function _renderCatResults(allResults, screenType, label, hasMore) {
  var body = _getBody(screenType);
  if (!body) return;

  // Filter to service area only, dedupe
  var results = [];
  var seen = {};
  allResults.forEach(function(r) {
    if (!r.geometry || !r.geometry.location) return;
    if (seen[r.place_id]) return;
    seen[r.place_id] = true;
    if (isInArea(r.geometry.location.lat(), r.geometry.location.lng())) {
      results.push(r);
    }
  });

  // Sort by rating
  results.sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });

  var h = '';
  if (results.length) {
    h += '<div class="ss-lbl">' + label + '</div>';
    results.forEach(function(r) {
      var addr = (r.vicinity || r.formatted_address || 'Naples, FL').replace(/, USA$/, '');
      h += _row(r.name, addr, r.place_id, screenType);
    });
  }

  // Always show load-more if pagination exists (to find more in-area places)
  if (hasMore) {
    h += _loadMoreBtn('ss-load-more');
  }

  if (!results.length && !hasMore) {
    h = '<div class="ss-empty">No ' + label.toLowerCase() + ' found in the service area.</div>';
  } else if (!results.length && hasMore) {
    h = '<div class="ss-lbl">' + label + '</div>' +
      '<div style="padding:12px 20px;color:var(--g400);font-size:13px">Searching for places in the service area...</div>' +
      _loadMoreBtn('ss-load-more');
  }

  body.innerHTML = h;
}

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
var _supaPlaces = null; // loaded once
var _supaPlaceCats = null;

function _loadSupaPlaces() {
  if (_supaPlaces !== null) return; // already loading/loaded
  _supaPlaces = []; _supaPlaceCats = [];
  
  supaFetch('GET', 'places', '?active=eq.true&order=priority.desc')
    .then(function(data) { if (data && Array.isArray(data)) _supaPlaces = data; })
    .catch(function() {});

  supaFetch('GET', 'place_categories', '')
    .then(function(data) { if (data && Array.isArray(data)) _supaPlaceCats = data; })
    .catch(function() {});
}

// Call on startup (safe to call multiple times)
setTimeout(_loadSupaPlaces, 1500);

function _getSupaPlacesForCat(catLabel) {
  if (!_supaPlaces || !_supaPlaceCats || !_riderCats) return [];
  // Find category ID by label
  var cat = _riderCats.find(function(c) { return c.label.toLowerCase().replace(/[^a-z0-9]/g, '') === catLabel; });
  if (!cat || !cat.id) return [];
  // Get place IDs in this category
  var placeIds = _supaPlaceCats.filter(function(pc) { return pc.category_id === cat.id; }).map(function(pc) { return pc.place_id; });
  // Filter places, sorted by priority DESC
  return _supaPlaces.filter(function(p) { return placeIds.indexOf(p.id) > -1; })
    .sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
}

window.doCatSearch = function(cat, screenType) {
  var body = _getBody(screenType);
  if (!body) return;
  body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Searching...</div>';

  var label = cat.charAt(0).toUpperCase() + cat.slice(1);

  // Try Supabase places first
  var supaResults = _getSupaPlacesForCat(cat);
  if (supaResults.length) {
    var h = '<div class="ss-lbl">' + label + '</div>';
    supaResults.forEach(function(p) {
      // Use a fake place_id prefixed with 'supa:' so ssPick can handle it
      h += _row(p.name, p.address || 'Naples, FL', 'supa:' + p.id, screenType);
    });
    body.innerHTML = h;
    return;
  }

  // Fallback to Google Places
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
    body.innerHTML = '<div class="ss-empty">No places found. Try again.</div>';
    return;
  }

  var config = _catConfig[cat] || { types: [], textQuery: cat + ' Naples FL' };
  var svc = _plSvc();
  var center = new google.maps.LatLng(_SVC_CENTER.lat, _SVC_CENTER.lng);
  _catLabel = label;
  _catScreenType = screenType;
  _catAllResults = [];
  _catPagination = null;

  var onResults = function(results, status, pagination) {
    if (status === 'OK' && results && results.length) {
      _catAllResults = _catAllResults.concat(results);
    }
    _catPagination = (pagination && pagination.hasNextPage) ? pagination : null;
    _renderCatResults(_catAllResults, _catScreenType, _catLabel, !!_catPagination);

    if (_catPagination && _catAllResults.length > 0) {
      var anyInArea = _catAllResults.some(function(r) {
        if (!r.geometry || !r.geometry.location) return false;
        return isInArea(r.geometry.location.lat(), r.geometry.location.lng());
      });
      if (!anyInArea) {
        setTimeout(function() { ssLoadMore(); }, 300);
      }
    }
  };

  if (!config.types.length || cat === 'beaches') {
    svc.textSearch({ query: config.textQuery, location: center, radius: 20000 }, onResults);
  } else {
    svc.nearbySearch({ location: center, radius: 20000, type: config.types[0], rankBy: google.maps.places.RankBy.PROMINENCE }, onResults);
  }
};

// Load more results (called by button click)
window.ssLoadMore = function() {
  if (!_catPagination) return;

  // Replace button with spinner
  var btn = document.getElementById('ss-load-more');
  if (btn) btn.innerHTML = '<div class="ss-spin" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:6px"></div><span style="font-size:13px;color:var(--g400)">Loading more...</span>';

  // Google requires 2s delay between pagination calls
  setTimeout(function() {
    if (_catPagination && _catPagination.hasNextPage) {
      _catPagination.nextPage();
    }
  }, 300);
};

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
