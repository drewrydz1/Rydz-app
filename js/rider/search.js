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

// Row HTML with service-area badge
function _row(name, addr, pid, type, inArea) {
  var badge = inArea ? '<span style="display:inline-block;font-size:9px;font-weight:700;color:#007AFF;background:rgba(0,122,255,.1);padding:2px 6px;border-radius:4px;margin-left:6px;vertical-align:middle">SERVICE AREA</span>' : '';
  return '<div class="ss-row" data-pid="' + pid + '" data-type="' + type + '" onclick="ssPick(this)">' +
    '<div class="ss-ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="' + (inArea ? 'var(--bl)' : 'var(--g400)') + '"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>' +
    '<div class="ss-tx"><div class="ss-nm">' + esc(name) + badge + '</div><div class="ss-ad">' + esc(addr) + '</div></div></div>';
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
    h += '<div class="ss-lbl">Explore</div>';
    var cats = [
      { k: 'dining', l: 'Restaurants' },
      { k: 'bars', l: 'Bars' },
      { k: 'beaches', l: 'Beaches' },
      { k: 'hotels', l: 'Hotels' },
      { k: 'shopping', l: 'Shopping' }
    ];
    cats.forEach(function(c) {
      h += '<div class="ss-explore" onclick="doCatSearch(\'' + c.k + '\',\'pickup\')">' +
        '<div style="flex:1;font-size:14px;font-weight:600;color:#fff;font-family:var(--font)">' + c.l + '</div>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g300)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
    });
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
      var naplesResult = (sec + ' ' + main).toLowerCase().indexOf('naples') > -1;
      h += _row(main, sec, p.place_id, type, naplesResult);
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
  dining:    { types: ['restaurant', 'cafe', 'meal_takeaway'], textQuery: 'restaurants Naples FL' },
  bars:     { types: ['bar', 'night_club'],                    textQuery: 'bars nightlife Naples FL' },
  hotels:   { types: ['lodging'],                              textQuery: 'hotels resorts Naples FL' },
  beaches:  { types: [],                                       textQuery: 'beach Naples Marco Island FL' },
  shopping: { types: ['shopping_mall', 'store', 'clothing_store'], textQuery: 'shopping stores Naples FL' }
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

  // Split: in service area vs outside
  var inArea = [];
  var outside = [];
  var seen = {};

  allResults.forEach(function(r) {
    if (!r.geometry || !r.geometry.location) return;
    if (seen[r.place_id]) return;
    seen[r.place_id] = true;
    var lat = r.geometry.location.lat();
    var lng = r.geometry.location.lng();
    if (isInArea(lat, lng)) { inArea.push(r); }
    else { outside.push(r); }
  });

  // Sort each group by rating
  var byRating = function(a, b) { return (b.rating || 0) - (a.rating || 0); };
  inArea.sort(byRating);
  outside.sort(byRating);

  var h = '';

  // Service area results first
  if (inArea.length) {
    h += '<div class="ss-lbl" style="color:var(--bl)">' + label + ' — Service Area</div>';
    inArea.forEach(function(r) {
      var addr = (r.vicinity || r.formatted_address || 'Naples, FL').replace(/, USA$/, '');
      h += _row(r.name, addr, r.place_id, screenType, true);
    });
  }

  // Outside service area
  if (outside.length) {
    h += '<div class="ss-lbl">' + label + ' — Nearby</div>';
    outside.forEach(function(r) {
      var addr = (r.vicinity || r.formatted_address || 'Naples, FL').replace(/, USA$/, '');
      h += _row(r.name, addr, r.place_id, screenType, false);
    });
  }

  if (!inArea.length && !outside.length) {
    h = '<div class="ss-empty">No ' + label.toLowerCase() + ' found.</div>';
  }

  // Load more button
  if (hasMore) {
    h += _loadMoreBtn('ss-load-more');
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

window.doCatSearch = function(cat, screenType) {
  var body = _getBody(screenType);
  if (!body) return;
  body.innerHTML = '<div class="ss-loading"><div class="ss-spin"></div>Searching ' + cat + '...</div>';

  if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
    body.innerHTML = '<div class="ss-empty">Google Maps loading. Try again.</div>';
    return;
  }

  var config = _catConfig[cat] || { types: [], textQuery: cat + ' Naples FL' };
  var svc = _plSvc();
  var center = new google.maps.LatLng(_SVC_CENTER.lat, _SVC_CENTER.lng);
  _catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
  _catScreenType = screenType;
  _catAllResults = [];
  _catPagination = null;

  var onResults = function(results, status, pagination) {
    if (status === 'OK' && results && results.length) {
      _catAllResults = _catAllResults.concat(results);
    }
    _catPagination = (pagination && pagination.hasNextPage) ? pagination : null;
    _renderCatResults(_catAllResults, _catScreenType, _catLabel, !!_catPagination);

    // If we got results but NONE are in service area, auto-load next page
    if (_catPagination && _catAllResults.length > 0) {
      var anyInArea = _catAllResults.some(function(r) {
        if (!r.geometry || !r.geometry.location) return false;
        return isInArea(r.geometry.location.lat(), r.geometry.location.lng());
      });
      if (!anyInArea) {
        // Auto-fetch more to find service-area results
        setTimeout(function() { ssLoadMore(); }, 300);
      }
    }
  };

  // Use textSearch for beaches (no good Places type), nearbySearch for others
  if (!config.types.length || cat === 'beaches') {
    svc.textSearch({
      query: config.textQuery,
      location: center,
      radius: 20000
    }, onResults);
  } else {
    // Search with primary type first
    svc.nearbySearch({
      location: center,
      radius: 20000,
      type: config.types[0],
      rankBy: google.maps.places.RankBy.PROMINENCE
    }, onResults);
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
