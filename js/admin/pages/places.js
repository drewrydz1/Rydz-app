// RYDZ Admin - Places Page
// CRUD with multi-category, geocoding, service-area auto-detection

var _places = [];
var _placeCats = []; // junction table rows
var _editPlace = null; // null = closed, {} = new, {id:...} = editing

// ===== SERVICE AREA CHECK =====
function _placeInArea(lat, lng) {
  if (!lat || !lng) return false;
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
}

// ===== LOAD =====
async function loadPlaces() {
  var p = await api('GET', 'places', '?order=name.asc');
  var pc = await api('GET', 'place_categories', '');
  if (p) _places = p;
  if (pc) _placeCats = pc;
  _editPlace = null;
  renderPlaces();
}

// ===== GET CATEGORIES FOR A PLACE =====
function _getCatsForPlace(placeId) {
  return _placeCats
    .filter(function(pc) { return pc.place_id === placeId; })
    .map(function(pc) { return pc.category_id; });
}

function _getCatLabel(catId) {
  var c = _cats.find(function(cat) { return cat.id === catId; });
  return c ? c.label : '';
}

// ===== RENDER LIST =====
function renderPlaces() {
  var el = document.getElementById('places-list');
  if (!el) return;

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div><span style="font-size:13px;color:var(--tx3)">' + _places.length + ' places total</span></div>' +
    '<div style="display:flex;gap:8px">' +
      '<input id="place-search" placeholder="Search places..." oninput="renderPlaces()" style="padding:8px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);width:200px">' +
      '<button onclick="openPlaceEditor(null)" style="padding:8px 18px;background:var(--bl);color:#fff;border:none;border-radius:var(--r);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer">+ Add Place</button>' +
    '</div>' +
  '</div>';

  // Filter
  var searchEl = document.getElementById('place-search');
  var q = searchEl ? searchEl.value.toLowerCase().trim() : '';
  var filtered = q ? _places.filter(function(p) {
    return p.name.toLowerCase().indexOf(q) > -1 || (p.address || '').toLowerCase().indexOf(q) > -1;
  }) : _places;

  // Table header
  html += '<div style="display:grid;grid-template-columns:1fr 1.2fr 1fr 60px 60px 80px;gap:8px;padding:8px 12px;font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">' +
    '<span>Name</span><span>Address</span><span>Categories</span><span>Rating</span><span>Area</span><span>Actions</span></div>';

  if (!filtered.length) {
    html += '<div style="padding:24px;text-align:center;color:var(--tx3);font-size:13px">No places found. Add one above.</div>';
  }

  filtered.forEach(function(p) {
    var catIds = _getCatsForPlace(p.id);
    var catLabels = catIds.map(function(id) { return _getCatLabel(id); }).filter(Boolean).join(', ');
    var inArea = p.in_service_area;
    var stars = '';
    for (var s = 0; s < (p.rating || 0); s++) stars += '★';

    html += '<div style="display:grid;grid-template-columns:1fr 1.2fr 1fr 60px 60px 80px;gap:8px;padding:10px 12px;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r);margin-bottom:6px;align-items:center;font-size:12px">' +
      '<div style="font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) +
        (p.featured ? ' <span style="color:var(--or);font-size:10px">★</span>' : '') +
        (!p.active ? ' <span style="color:var(--rd);font-size:10px">OFF</span>' : '') +
      '</div>' +
      '<div style="color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.address || '') + '</div>' +
      '<div style="color:var(--tx3);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (catLabels || '—') + '</div>' +
      '<div style="color:#f59e0b">' + (stars || '—') + '</div>' +
      '<div><span style="font-size:10px;font-weight:700;color:' + (inArea ? 'var(--gn)' : 'var(--tx3)') + '">' + (inArea ? 'YES' : 'NO') + '</span></div>' +
      '<div style="display:flex;gap:4px">' +
        '<button onclick="openPlaceEditor(\'' + p.id + '\')" style="padding:4px 10px;background:var(--bl);color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:var(--font)">Edit</button>' +
        '<button onclick="deletePlace(\'' + p.id + '\')" style="padding:4px 8px;background:rgba(239,68,68,.1);color:var(--rd);border:1px solid rgba(239,68,68,.2);border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:var(--font)">×</button>' +
      '</div>' +
    '</div>';
  });

  el.innerHTML = html;

  // Render editor if open
  renderPlaceEditor();
}

// ===== EDITOR MODAL =====
function openPlaceEditor(id) {
  if (id) {
    var existing = _places.find(function(p) { return p.id === id; });
    if (existing) {
      _editPlace = JSON.parse(JSON.stringify(existing));
      _editPlace._catIds = _getCatsForPlace(id);
    }
  } else {
    _editPlace = { id: null, name: '', address: '', lat: null, lng: null, in_service_area: false, rating: 3, featured: false, image_url: '', active: true, _catIds: [] };
  }
  renderPlaceEditor();
}

function closePlaceEditor() {
  _editPlace = null;
  var el = document.getElementById('place-editor');
  if (el) el.innerHTML = '';
}

function renderPlaceEditor() {
  var el = document.getElementById('place-editor');
  if (!el) return;
  if (!_editPlace) { el.innerHTML = ''; return; }

  var p = _editPlace;
  var isNew = !p.id;

  // Category checkboxes
  var catChecks = '';
  _cats.forEach(function(c) {
    if (!c.id) return;
    var checked = p._catIds && p._catIds.indexOf(c.id) > -1;
    catChecks += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--tx);padding:4px 0">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="togglePlaceCat(\'' + c.id + '\',this.checked)" style="accent-color:var(--bl)">' +
      esc(c.label) + '</label>';
  });

  // Rating select
  var ratingOpts = '';
  for (var r = 1; r <= 5; r++) {
    ratingOpts += '<option value="' + r + '" ' + (p.rating === r ? 'selected' : '') + '>' + r + ' Star' + (r > 1 ? 's' : '') + '</option>';
  }

  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center" onclick="closePlaceEditor()">' +
    '<div style="background:var(--bg2);border-radius:var(--r2);padding:24px;width:480px;max-width:90vw;max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">' +

    '<h3 style="margin:0 0 16px;font-size:16px;color:var(--tx)">' + (isNew ? 'Add Place' : 'Edit Place') + '</h3>' +

    // Name
    '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Name</label>' +
    '<input type="text" value="' + esc(p.name) + '" oninput="_editPlace.name=this.value" placeholder="Business name" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-weight:600;font-family:var(--font);margin:4px 0 12px">' +

    // Address + Geocode
    '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Address</label>' +
    '<div style="display:flex;gap:6px;margin:4px 0 4px">' +
      '<input type="text" id="pe-addr" value="' + esc(p.address) + '" oninput="_editPlace.address=this.value" placeholder="Full address" style="flex:1;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font)">' +
      '<button onclick="geocodePlace()" style="padding:8px 12px;background:var(--bl);color:#fff;border:none;border-radius:var(--r);font-size:11px;font-weight:700;font-family:var(--font);cursor:pointer;white-space:nowrap">Geocode</button>' +
    '</div>' +
    '<div id="pe-coords" style="font-size:11px;color:var(--tx3);margin-bottom:12px">' +
      (p.lat ? 'Lat: ' + (p.lat ? p.lat.toFixed(6) : '—') + '  Lng: ' + (p.lng ? p.lng.toFixed(6) : '—') + '  In area: ' + (p.in_service_area ? '<span style="color:var(--gn)">YES</span>' : '<span style="color:var(--rd)">NO</span>') : 'Click Geocode after entering address') +
    '</div>' +

    // Categories
    '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Categories</label>' +
    '<div style="margin:4px 0 12px;padding:8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r)">' + catChecks + '</div>' +

    // Rating + Featured + Active
    '<div style="display:flex;gap:16px;margin-bottom:12px">' +
      '<div>' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Rating</label>' +
        '<select onchange="_editPlace.rating=parseInt(this.value)" style="display:block;padding:6px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px">' + ratingOpts + '</select>' +
      '</div>' +
      '<div>' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Featured</label>' +
        '<div style="margin-top:6px"><input type="checkbox" ' + (p.featured ? 'checked' : '') + ' onchange="_editPlace.featured=this.checked" style="accent-color:var(--bl)"> <span style="font-size:12px;color:var(--tx)">Yes</span></div>' +
      '</div>' +
      '<div>' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Active</label>' +
        '<div style="margin-top:6px"><input type="checkbox" ' + (p.active ? 'checked' : '') + ' onchange="_editPlace.active=this.checked" style="accent-color:var(--bl)"> <span style="font-size:12px;color:var(--tx)">Yes</span></div>' +
      '</div>' +
    '</div>' +

    // Image URL
    '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Image URL (optional)</label>' +
    '<input type="text" value="' + esc(p.image_url || '') + '" oninput="_editPlace.image_url=this.value" placeholder="https://..." style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin:4px 0 16px">' +

    // Buttons
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button onclick="closePlaceEditor()" style="padding:10px 20px;background:var(--bg3);color:var(--tx2);border:1px solid var(--bdr);border-radius:var(--r);font-size:13px;font-weight:600;font-family:var(--font);cursor:pointer">Cancel</button>' +
      '<button onclick="savePlace()" style="padding:10px 20px;background:var(--gn);color:#fff;border:none;border-radius:var(--r);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer" id="pe-save">' + (isNew ? 'Create Place' : 'Save Changes') + '</button>' +
    '</div>' +

    '</div></div>';

  el.innerHTML = html;
}

// ===== GEOCODE =====
function geocodePlace() {
  var addr = document.getElementById('pe-addr');
  if (!addr || !addr.value.trim()) return;
  if (!window._geoAdmin) window._geoAdmin = new google.maps.Geocoder();

  var coordsEl = document.getElementById('pe-coords');
  if (coordsEl) coordsEl.textContent = 'Geocoding...';

  window._geoAdmin.geocode({ address: addr.value.trim() }, function(results, status) {
    if (status === 'OK' && results[0]) {
      var loc = results[0].geometry.location;
      _editPlace.lat = loc.lat();
      _editPlace.lng = loc.lng();
      _editPlace.in_service_area = _placeInArea(loc.lat(), loc.lng());
      _editPlace.address = results[0].formatted_address || addr.value.trim();
      renderPlaceEditor();
    } else {
      if (coordsEl) coordsEl.innerHTML = '<span style="color:var(--rd)">Geocode failed. Check the address.</span>';
    }
  });
}

// ===== TOGGLE CATEGORY =====
function togglePlaceCat(catId, checked) {
  if (!_editPlace._catIds) _editPlace._catIds = [];
  if (checked) {
    if (_editPlace._catIds.indexOf(catId) === -1) _editPlace._catIds.push(catId);
  } else {
    _editPlace._catIds = _editPlace._catIds.filter(function(id) { return id !== catId; });
  }
}

// ===== SAVE PLACE =====
async function savePlace() {
  if (!_editPlace) return;
  if (!_editPlace.name.trim()) { alert('Name is required.'); return; }

  var btn = document.getElementById('pe-save');
  if (btn) btn.textContent = 'Saving...';

  var payload = {
    name: _editPlace.name.trim(),
    address: _editPlace.address || '',
    lat: _editPlace.lat || null,
    lng: _editPlace.lng || null,
    in_service_area: _placeInArea(_editPlace.lat, _editPlace.lng),
    rating: _editPlace.rating || 3,
    featured: !!_editPlace.featured,
    image_url: _editPlace.image_url || '',
    active: _editPlace.active !== false,
    updated_at: new Date().toISOString()
  };

  var placeId = _editPlace.id;

  if (placeId) {
    // Update existing
    await api('PATCH', 'places', '?id=eq.' + placeId, payload);
  } else {
    // Insert new
    var result = await api('POST', 'places', '', payload);
    if (result && result.length) placeId = result[0].id;
  }

  if (!placeId) {
    if (btn) btn.textContent = 'Error!';
    return;
  }

  // Sync junction table — delete old, insert new
  await api('DELETE', 'place_categories', '?place_id=eq.' + placeId);
  var catIds = _editPlace._catIds || [];
  for (var i = 0; i < catIds.length; i++) {
    await api('POST', 'place_categories', '', { place_id: placeId, category_id: catIds[i] });
  }

  // Reload
  await loadPlaces();
}

// ===== DELETE =====
async function deletePlace(id) {
  var p = _places.find(function(pl) { return pl.id === id; });
  if (!p || !confirm('Delete "' + p.name + '"?')) return;
  await api('DELETE', 'place_categories', '?place_id=eq.' + id);
  await api('DELETE', 'places', '?id=eq.' + id);
  await loadPlaces();
}
