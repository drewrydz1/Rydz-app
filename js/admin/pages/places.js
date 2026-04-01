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
var _placeSearchQuery = '';
var _placeCatFilter = ''; // '' = all, or category ID

function _filterPlaces() {
  _placeSearchQuery = (document.getElementById('place-search') || {}).value || '';
  _renderPlaceRows();
}

function _filterByCat(val) {
  _placeCatFilter = val;
  _renderPlaceRows();
}

function renderPlaces() {
  var el = document.getElementById('places-list');
  if (!el) return;

  // Category dropdown options
  var catOpts = '<option value="">All Categories</option>';
  _cats.forEach(function(c) {
    if (!c.id) return;
    catOpts += '<option value="' + c.id + '"' + (_placeCatFilter === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>';
  });

  var html = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px">' +
    '<input id="place-search" placeholder="Search places..." oninput="_filterPlaces()" style="flex:1;min-width:140px;padding:10px 14px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-family:var(--font)">' +
    '<select onchange="_filterByCat(this.value)" style="padding:10px 14px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-family:var(--font);cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22%238A96A8%22 viewBox=%220 0 24 24%22><path d=%22M7 10l5 5 5-5z%22/></svg>\');background-repeat:no-repeat;background-position:right 10px center;padding-right:30px">' + catOpts + '</select>' +
    '<button onclick="openPlaceEditor(null)" style="padding:10px 20px;background:var(--bl);color:#fff;border:none;border-radius:var(--r);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;white-space:nowrap">+ Add Place</button>' +
  '</div>' +
  '<div style="margin-bottom:12px;font-size:12px;color:var(--tx3);font-weight:600" id="place-count">' + _places.length + ' places</div>' +
  '<div id="place-rows"></div>';

  el.innerHTML = html;

  if (_placeSearchQuery) {
    var inp = document.getElementById('place-search');
    if (inp) { inp.value = _placeSearchQuery; }
  }

  _renderPlaceRows();
  renderPlaceEditor();
}

function _renderPlaceRows() {
  var rowsEl = document.getElementById('place-rows');
  if (!rowsEl) return;

  var q = _placeSearchQuery.toLowerCase().trim();
  var filtered = _places;

  // Text search
  if (q) {
    filtered = filtered.filter(function(p) {
      return p.name.toLowerCase().indexOf(q) > -1 || (p.address || '').toLowerCase().indexOf(q) > -1;
    });
  }

  // Category filter
  if (_placeCatFilter) {
    filtered = filtered.filter(function(p) {
      return _getCatsForPlace(p.id).indexOf(_placeCatFilter) > -1;
    });
  }

  // Update count
  var countEl = document.getElementById('place-count');
  if (countEl) countEl.textContent = filtered.length + ' place' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    rowsEl.innerHTML = '<div style="padding:32px;text-align:center;color:var(--tx3);font-size:13px">No places found.</div>';
    return;
  }

  var html = '';
  filtered.forEach(function(p) {
    var catIds = _getCatsForPlace(p.id);
    var catLabels = catIds.map(function(id) { return _getCatLabel(id); }).filter(Boolean);
    var inArea = p.in_service_area;

    // Category pills
    var pills = '';
    if (catLabels.length) {
      catLabels.forEach(function(l) {
        pills += '<span style="display:inline-block;padding:2px 8px;background:rgba(30,144,255,.12);color:var(--bl);font-size:10px;font-weight:700;border-radius:6px;letter-spacing:.3px">' + esc(l) + '</span>';
      });
    }

    // Status badges
    var badges = '';
    if (p.featured) badges += '<span style="display:inline-block;padding:2px 7px;background:rgba(249,115,22,.12);color:var(--or);font-size:10px;font-weight:700;border-radius:6px">Featured</span>';
    if (!p.active) badges += '<span style="display:inline-block;padding:2px 7px;background:rgba(255,69,58,.1);color:var(--rd);font-size:10px;font-weight:700;border-radius:6px">Inactive</span>';

    html += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:14px;padding:14px 16px;margin-bottom:8px">' +
      // Top row: name + actions
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px">' +
        '<div style="font-size:14px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">' + esc(p.name) + '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button onclick="openPlaceEditor(\'' + p.id + '\')" style="padding:6px 14px;background:var(--bl);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Edit</button>' +
          '<button onclick="deletePlace(\'' + p.id + '\')" style="padding:6px 10px;background:rgba(239,68,68,.08);color:var(--rd);border:1px solid rgba(239,68,68,.15);border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Delete</button>' +
        '</div>' +
      '</div>' +
      // Address
      '<div style="font-size:12px;color:var(--tx2);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.address || 'No address') + '</div>' +
      // Bottom row: pills + meta
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">' +
        pills +
        badges +
        '<span style="display:inline-block;padding:2px 7px;background:' + (inArea ? 'rgba(34,197,94,.1)' : 'rgba(138,150,168,.1)') + ';color:' + (inArea ? 'var(--gn)' : 'var(--tx3)') + ';font-size:10px;font-weight:700;border-radius:6px">' + (inArea ? 'In Area' : 'Outside') + '</span>' +
        '<span style="display:inline-block;padding:2px 7px;background:rgba(30,144,255,.08);color:var(--bl);font-size:10px;font-weight:700;border-radius:6px">Pri ' + (p.priority || 0) + '</span>' +
      '</div>' +
    '</div>';
  });

  rowsEl.innerHTML = html;
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
    _editPlace = { id: null, name: '', address: '', lat: null, lng: null, in_service_area: false, priority: 50, featured: false, image_url: '', active: true, _catIds: [] };
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
  var _lbl = 'style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px"';
  var _inp = 'style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box"';

  // Category checkboxes
  var catChecks = '';
  _cats.forEach(function(c) {
    if (!c.id) return;
    var checked = p._catIds && p._catIds.indexOf(c.id) > -1;
    catChecks += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--tx);padding:6px 0">' +
      '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="togglePlaceCat(\'' + c.id + '\',this.checked)" style="width:18px;height:18px;accent-color:var(--bl)">' +
      esc(c.label) + '</label>';
  });

  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:flex-end;justify-content:center" onclick="closePlaceEditor()">' +
    '<div style="background:var(--bg2);border-radius:18px 18px 0 0;padding:24px 20px 32px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch" onclick="event.stopPropagation()">' +

    // Handle bar
    '<div style="width:36px;height:4px;background:var(--bdr);border-radius:2px;margin:0 auto 18px"></div>' +

    '<h3 style="margin:0 0 20px;font-size:18px;font-weight:800;color:var(--tx)">' + (isNew ? 'Add Place' : 'Edit Place') + '</h3>' +

    // Name
    '<label ' + _lbl + '>Name</label>' +
    '<input type="text" value="' + esc(p.name) + '" oninput="_editPlace.name=this.value" placeholder="Business name" ' + _inp + ' style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:14px;font-weight:600;font-family:var(--font);box-sizing:border-box;margin-bottom:14px">' +

    // Address + Geocode
    '<label ' + _lbl + '>Address</label>' +
    '<div style="display:flex;gap:8px;margin-bottom:4px">' +
      '<input type="text" id="pe-addr" value="' + esc(p.address) + '" oninput="_editPlace.address=this.value" placeholder="Full address" ' + _inp + ' style="flex:1;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box">' +
      '<button onclick="geocodePlace()" style="padding:10px 16px;background:var(--bl);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;white-space:nowrap">Geocode</button>' +
    '</div>' +
    '<div id="pe-coords" style="font-size:11px;color:var(--tx3);margin-bottom:14px">' +
      (p.lat ? 'Lat: ' + p.lat.toFixed(6) + ' &nbsp; Lng: ' + (p.lng ? p.lng.toFixed(6) : '—') + ' &nbsp; ' + (p.in_service_area ? '<span style="color:var(--gn);font-weight:700">In Area</span>' : '<span style="color:var(--rd);font-weight:700">Outside Area</span>') : '<span style="color:var(--tx3)">Click Geocode after entering address</span>') +
    '</div>' +

    // Categories
    '<label ' + _lbl + '>Categories</label>' +
    '<div style="margin-bottom:14px;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px">' + catChecks + '</div>' +

    // Priority + Featured + Active — horizontal row
    '<div style="display:flex;gap:12px;margin-bottom:14px">' +
      '<div style="flex:1">' +
        '<label ' + _lbl + '>Priority (0-100)</label>' +
        '<input type="number" min="0" max="100" value="' + (p.priority || 50) + '" onchange="_editPlace.priority=parseInt(this.value)" style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box">' +
      '</div>' +
      '<div style="flex:1;display:flex;align-items:flex-end;gap:16px;padding-bottom:4px">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--tx);font-weight:600">' +
          '<input type="checkbox" ' + (p.featured ? 'checked' : '') + ' onchange="_editPlace.featured=this.checked" style="width:18px;height:18px;accent-color:var(--or)"> Featured</label>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--tx);font-weight:600">' +
          '<input type="checkbox" ' + (p.active ? 'checked' : '') + ' onchange="_editPlace.active=this.checked" style="width:18px;height:18px;accent-color:var(--gn)"> Active</label>' +
      '</div>' +
    '</div>' +

    // Image URL
    '<label ' + _lbl + '>Image URL <span style="font-weight:400;color:var(--tx3)">(optional)</span></label>' +
    '<input type="text" value="' + esc(p.image_url || '') + '" oninput="_editPlace.image_url=this.value" placeholder="https://..." ' + _inp + ' style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box;margin-bottom:20px">' +

    // Buttons
    '<div style="display:flex;gap:10px">' +
      '<button onclick="closePlaceEditor()" style="flex:1;padding:12px;background:var(--bg3);color:var(--tx2);border:1px solid var(--bdr);border-radius:12px;font-size:14px;font-weight:600;font-family:var(--font);cursor:pointer">Cancel</button>' +
      '<button onclick="savePlace()" style="flex:1;padding:12px;background:var(--gn);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;font-family:var(--font);cursor:pointer" id="pe-save">' + (isNew ? 'Create' : 'Save') + '</button>' +
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
    priority: _editPlace.priority || 50,
    featured: !!_editPlace.featured,
    image_url: _editPlace.image_url || '',
    active: _editPlace.active !== false,
    updated_at: new Date().toISOString()
  };

  var placeId = _editPlace.id;

  if (placeId) {
    await api('PATCH', 'places', '?id=eq.' + placeId, payload);
  } else {
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
