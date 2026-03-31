// RYDZ Rider - Search & Places v4
// Single "Where to?" → "Where are you?" flow
// Google Places Autocomplete + Nearby Search by category

var _recentPlaces = [];

// ========== SERVICE AREA CHECK ==========
window.isInArea = function(lat, lng) {
  if (lat < 26.087 || lat > 26.178 || lng < -81.823 || lng > -81.774) return false;
  if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
    try {
      return google.maps.geometry.poly.containsLocation(
        new google.maps.LatLng(lat, lng),
        new google.maps.Polygon({ paths: SVC })
      );
    } catch (e) {}
  }
  return true;
};

var _naplesBounds = null;
function getNaplesBounds() {
  if (!_naplesBounds && typeof google !== 'undefined' && google.maps) {
    _naplesBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(26.08, -81.83),
      new google.maps.LatLng(26.22, -81.74)
    );
  }
  return _naplesBounds;
}

// ========== RECENT PLACES ==========
function loadRecent() {
  try { var r = localStorage.getItem('rydz-recent-places'); _recentPlaces = r ? JSON.parse(r) : []; }
  catch (e) { _recentPlaces = []; }
}
function saveRecent(place) {
  loadRecent();
  _recentPlaces = _recentPlaces.filter(function(p) { return p.n !== place.n; });
  _recentPlaces.unshift(place);
  if (_recentPlaces.length > 10) _recentPlaces = _recentPlaces.slice(0, 10);
  try { localStorage.setItem('rydz-recent-places', JSON.stringify(_recentPlaces)); } catch (e) {}
}
loadRecent();

// ========== RENDER HELPERS ==========
function renderFeatured(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var promos = (db && db.settings && db.settings.promotions) || [];
  if (!promos.length) { el.innerHTML = ''; return; }
  var h = '';
  promos.slice(0, 3).forEach(function(p) {
    var nm = (p.name || p.n || '').replace(/'/g, "\\'");
    var ad = (p.addr || p.a || '').replace(/'/g, "\\'");
    h += '<div class="ss-item" onclick="selectFeaturedPlace(\'' + nm + '\',\'' + ad + '\',\'' + containerId + '\')">' +
      '<div class="ss-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>' +
      '<div class="ss-item-text"><div class="ss-item-main">' + esc(p.name || p.n || '') + '</div>' +
      '<div class="ss-item-sub">' + esc(p.addr || p.a || 'Naples, Florida, USA') + '</div></div></div>';
  });
  el.innerHTML = h;
}

function renderExplore() {
  var el = document.getElementById('pickup-explore');
  if (!el) return;
  var cats = [
    { key: 'dining', label: 'Restaurants', svg: '<path d="M7 2v6.5c0 .83.67 1.5 1.5 1.5h1v6h2v-6h1c.83 0 1.5-.67 1.5-1.5V2h-2v5h-1V2h-2v5h-1V2H7zM17 2v8h-2v6h2.5c.28 0 .5-.22.5-.5V2h-1z" fill="var(--g400)"/>' },
    { key: 'bars', label: 'Bars', svg: '<path d="M5 3h14l-5 7v5h2v1H8v-1h2v-5L5 3z" fill="none" stroke="var(--g400)" stroke-width="1.5"/>' },
    { key: 'beaches', label: 'Beaches', svg: '<path d="M12 3c-3 4-7 6-9 7h18c-2 0-6-3-9-7z" fill="none" stroke="var(--g400)" stroke-width="1.5"/><path d="M12 3v16M3 19h18" fill="none" stroke="var(--g400)" stroke-width="1.5"/>' },
    { key: 'hotels', label: 'Hotels', svg: '<rect x="3" y="8" width="18" height="10" rx="1" fill="none" stroke="var(--g400)" stroke-width="1.5"/><path d="M7 8V6a3 3 0 016 0v2" fill="none" stroke="var(--g400)" stroke-width="1.5"/>' }
  ];
  var h = '';
  cats.forEach(function(c) {
    h += '<div class="ss-explore-item" onclick="openCatSearchInPickup(\'' + c.key + '\')">' +
      '<div class="ss-item-icon"><svg width="18" height="18" viewBox="0 0 24 24">' + c.svg + '</svg></div>' +
      '<div style="flex:1;font-size:14px;font-weight:600;color:#fff;font-family:var(--font)">' + c.label + '</div>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g300)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
  });
  el.innerHTML = h;
}

function renderDefaultResults(type) {
  if (type === 'dest') {
    var c = document.getElementById('dest-results');
    if (!c) return;
    var h = '';
    if (_recentPlaces.length > 0) {
      h += '<div class="ss-section-title">Recent</div>';
      _recentPlaces.slice(0, 5).forEach(function(p, i) {
        h += buildSSItem(p.n, p.a, 'selectRecentPlace(\\'dest\\',' + i + ')', 'recent');
      });
    }
    h += '<div class="ss-section-title">Featured Places</div><div id="dest-featured"></div>';
    c.innerHTML = h;
    renderFeatured('dest-featured');
  } else {
    var c = document.getElementById('pickup-results');
    if (!c) return;
    var h = '<div class="ss-item ss-current-loc" onclick="useCurrentLocation()">' +
      '<div class="ss-item-icon" style="background:#e3f2fd"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1976D2" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div>' +
      '<div class="ss-item-text"><div class="ss-item-main">Current Location</div><div class="ss-item-sub">Set on Map</div></div>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>';
    h += '<div class="ss-section-title">Featured Places</div><div id="pickup-featured"></div>';
    h += '<div class="ss-section-title">Explore</div><div id="pickup-explore"></div>';
    c.innerHTML = h;
    renderFeatured('pickup-featured');
    renderExplore();
  }
}

function buildSSItem(name, addr, onclick, iconType) {
  var iconSvg;
  if (iconType === 'recent') iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 1.5"/></svg>';
  else iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bl)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>';
  return '<div class="ss-item" onclick="' + onclick + '">' +
    '<div class="ss-item-icon">' + iconSvg + '</div>' +
    '<div class="ss-item-text"><div class="ss-item-main">' + esc(name) + '</div>' +
    '<div class="ss-item-sub">' + esc(addr || '') + '</div></div></div>';
}

// ========== OPEN/CLOSE ==========
window.closeSearchScreen = function(type) {
  if (type === 'dest') go('home');
  else go('search-dest');
};

// ========== TEXT SEARCH ==========
window.onSearchType = function(type) {
  var inp = document.getElementById(type === 'dest' ? 'f-dest' : 'f-pickup');
  var clearBtn = document.getElementById(type === 'dest' ? 'dest-clear' : 'pickup-clear');
  var q = inp ? inp.value.trim() : '';
  if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);
  if (q.length < 2) { renderDefaultResults(type); return; }

  if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;
  if (!window._acs) window._acs = new google.maps.places.AutocompleteService();

  var opts = { input: q, componentRestrictions: { country: 'us' }, locationRestriction: getNaplesBounds() };
  if (!opts.locationRestriction) {
    delete opts.locationRestriction;
    opts.locationBias = new google.maps.Circle({ center: { lat: 26.1334, lng: -81.7935 }, radius: 12000 });
  }

  window._acs.getPlacePredictions(opts, function(predictions, status) {
    var cId = type === 'dest' ? 'dest-results' : 'pickup-results';
    var container = document.getElementById(cId);
    if (!container) return;

    if (status !== 'OK' || !predictions || !predictions.length) {
      container.innerHTML = '<div class="ss-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span>No places found</span></div>';
      return;
    }
    var filtered = predictions.filter(function(p) {
      var d = (p.description || '').toLowerCase();
      return d.indexOf('naples') > -1 || d.indexOf('collier') > -1 || d.indexOf(', fl') > -1;
    });
    if (!filtered.length) filtered = predictions;

    var h = '<div class="ss-section-title">Search Results</div>';
    filtered.slice(0, 6).forEach(function(p) {
      var main = p.structured_formatting ? p.structured_formatting.main_text : p.description;
      var sec = p.structured_formatting ? p.structured_formatting.secondary_text : '';
      sec = sec.replace(/, USA$/, '').replace(/, United States$/, '');
      h += '<div class="ss-item" onclick="selectSearchResult(\'' + p.place_id + '\',\'' + type + '\')">' +
        '<div class="ss-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bl)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>' +
        '<div class="ss-item-text"><div class="ss-item-main">' + esc(main) + '</div>' +
        '<div class="ss-item-sub">' + esc(sec) + '</div></div></div>';
    });
    container.innerHTML = h;
  });
};

window.clearSearchInput = function(type) {
  var inp = document.getElementById(type === 'dest' ? 'f-dest' : 'f-pickup');
  var cb = document.getElementById(type === 'dest' ? 'dest-clear' : 'pickup-clear');
  if (inp) { inp.value = ''; inp.focus(); }
  if (cb) cb.classList.add('hidden');
  renderDefaultResults(type);
};

// ========== PLACE SELECTION ==========
window.selectSearchResult = function(placeId, type) {
  if (!window._plSvc) { var div = document.createElement('div'); window._plSvc = new google.maps.places.PlacesService(div); }
  window._plSvc.getDetails({ placeId: placeId, fields: ['name', 'formatted_address', 'geometry'] }, function(place, status) {
    if (status !== 'OK' || !place || !place.geometry) return;
    var loc = place.geometry.location;
    var obj = { n: place.name || place.formatted_address, a: place.formatted_address || '', lat: loc.lat(), lng: loc.lng() };
    if (type === 'dest') { doSel = obj; saveRecent(obj); go('search-pickup'); }
    else { puSel = obj; saveRecent(obj); go('pass'); }
  });
};

window.selectFeaturedPlace = function(name, addr, containerId) {
  var type = containerId.indexOf('dest') > -1 ? 'dest' : 'pickup';
  if (typeof google === 'undefined' || !google.maps) return;
  if (!window._geocoder) window._geocoder = new google.maps.Geocoder();
  window._geocoder.geocode({ address: name + ', ' + (addr || 'Naples, FL') }, function(results, status) {
    if (status === 'OK' && results[0]) {
      var loc = results[0].geometry.location;
      var obj = { n: name, a: addr || results[0].formatted_address, lat: loc.lat(), lng: loc.lng() };
      if (type === 'dest') { doSel = obj; saveRecent(obj); go('search-pickup'); }
      else { puSel = obj; saveRecent(obj); go('pass'); }
    }
  });
};

window.selectRecentPlace = function(type, idx) {
  var p = _recentPlaces[idx];
  if (!p) return;
  if (type === 'dest') { doSel = p; go('search-pickup'); }
  else { puSel = p; go('pass'); }
};

window.useCurrentLocation = function() {
  if (!navigator.geolocation) { showToast('Location access is not available.'); return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    puSel = { n: 'Current Location', a: 'Your location', lat: pos.coords.latitude, lng: pos.coords.longitude };
    go('pass');
  }, function() {
    showToast('Unable to get your location. Please type an address.');
  }, { enableHighAccuracy: true, timeout: 8000 });
};

// ========== CATEGORY SEARCH ==========
var _catTypeMap = { 'dining': 'restaurant', 'bars': 'bar', 'hotels': 'lodging', 'beaches': 'natural_feature', 'shopping': 'shopping_mall', 'recent': 'recent' };

window.openCatSearch = function(cat) {
  go('search-dest');
  setTimeout(function() { searchByCategory(cat); }, 150);
};

window.openCatSearchInPickup = function(cat) {
  searchByCategory(cat, 'pickup');
};

window.searchByCategory = function(cat, screenType) {
  screenType = screenType || 'dest';
  var cId = screenType === 'dest' ? 'dest-results' : 'pickup-results';
  var container = document.getElementById(cId);
  if (!container) return;

  if (cat === 'recent') {
    loadRecent();
    if (!_recentPlaces.length) {
      container.innerHTML = '<div class="ss-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 1.5"/></svg><span>No recent places yet</span></div>';
      return;
    }
    var h = '<div class="ss-section-title">Recent</div>';
    _recentPlaces.forEach(function(p, i) {
      h += buildSSItem(p.n, p.a, "selectRecentPlace('" + screenType + "'," + i + ")", 'recent');
    });
    container.innerHTML = h;
    return;
  }

  container.innerHTML = '<div class="ss-loading"><div class="spinner"></div>Searching...</div>';
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) { container.innerHTML = '<div class="ss-empty">Maps not loaded</div>'; return; }
  if (!window._plSvc) { var div = document.createElement('div'); window._plSvc = new google.maps.places.PlacesService(div); }

  var cb = function(results, status) {
    var label = cat.charAt(0).toUpperCase() + cat.slice(1);
    if (status !== 'OK' || !results || !results.length) {
      container.innerHTML = '<div class="ss-empty"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><span>No ' + label.toLowerCase() + ' found nearby</span></div>';
      return;
    }
    var filtered = results.filter(function(r) {
      if (!r.geometry || !r.geometry.location) return false;
      var lat = r.geometry.location.lat(), lng = r.geometry.location.lng();
      return lat > 26.08 && lat < 26.22 && lng > -81.84 && lng < -81.73;
    }).sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });
    if (!filtered.length) filtered = results.slice(0, 10);

    var h = '<div class="ss-section-title">' + label + '</div>';
    filtered.slice(0, 12).forEach(function(r) {
      var addr = (r.vicinity || r.formatted_address || 'Naples, FL').replace(/, USA$/, '');
      h += '<div class="ss-item" onclick="selectSearchResult(\'' + r.place_id + '\',\'' + screenType + '\')">' +
        '<div class="ss-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--bl)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>' +
        '<div class="ss-item-text"><div class="ss-item-main">' + esc(r.name) + '</div>' +
        '<div class="ss-item-sub">' + esc(addr) + '</div></div></div>';
    });
    container.innerHTML = h;
  };

  if (cat === 'beaches') {
    window._plSvc.textSearch({ query: 'beach Naples FL', location: new google.maps.LatLng(26.1334, -81.7935), radius: 12000 }, cb);
  } else {
    window._plSvc.nearbySearch({ location: new google.maps.LatLng(26.1334, -81.7935), radius: 12000, type: _catTypeMap[cat] || 'point_of_interest' }, cb);
  }
};

window.selectCatResult = function(placeId, screenType) { selectSearchResult(placeId, screenType); };

// ========== COMPATIBILITY STUBS ==========
window.chkBtn = function() {
  var b = document.getElementById('h-btn');
  if (b) b.disabled = !(puSel && doSel && db && db.settings.serviceStatus);
};
window.onTyp = function(k) {};
window.clr = function(k) { if (k === 'pu') puSel = null; else doSel = null; };
window.selPlace = function() {};

window.showToast = function(msg) {
  var ov = document.getElementById('sa-ov'); if (ov) ov.remove();
  var md = document.getElementById('sa-md'); if (md) md.remove();
  ov = document.createElement('div'); ov.id = 'sa-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99998;animation:fi .2s ease';
  md = document.createElement('div'); md.id = 'sa-md';
  md.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:28px 24px;border-radius:20px;font-size:15px;font-weight:600;font-family:Poppins,sans-serif;z-index:99999;box-shadow:0 16px 50px rgba(0,0,0,.25);max-width:300px;text-align:center;line-height:1.5;animation:fi .25s ease';
  md.innerHTML = '<div style="width:48px;height:48px;border-radius:50%;background:#ffe5e5;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg width="22" height="22" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v5M11 14.5h.01"/></svg></div><p style="margin-bottom:16px;color:#1d1d1f">' + msg + '</p><button id="sa-btn" style="width:100%;padding:13px;background:#007AFF;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Poppins,sans-serif">Got it</button>';
  ov.onclick = function() { ov.remove(); md.remove(); };
  document.body.appendChild(ov); document.body.appendChild(md);
  document.getElementById('sa-btn').onclick = function() { document.getElementById('sa-ov').remove(); document.getElementById('sa-md').remove(); };
};
