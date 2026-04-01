// RYDZ Admin - Categories Page
// Priority 0-5, max 5 enabled, predefined icon library

// ===== ICON LIBRARY (white SVGs inside blue buttons) =====
var ICON_LIB = {
  clock:    '<path d="M11 6v5l3.5 2"/><path d="M7.5 3.5a8.5 8.5 0 11-1 12"/><path d="M3 12.5l3.5 3.5L3 19.5"/>',
  utensils: '<path d="M5 2v7a3 3 0 006 0V2M8 9v11M17 2v4a2 2 0 004 0V2M19 6v13"/>',
  cocktail: '<path d="M4 2h14l-5 7v6h2v2H7v-2h2V9L4 2z"/>',
  gift:     '<rect x="2.5" y="9" width="17" height="11" rx="1.5"/><path d="M11 9v11"/><rect x="4" y="5" width="14" height="4" rx="1"/><path d="M11 5c-1-3-5-3-5-1s4 2 5 1z"/><path d="M11 5c1-3 5-3 5-1s-4 2-5 1z"/>',
  store:    '<rect x="2" y="10" width="18" height="10" rx="1"/><path d="M2 6h18v4H2z"/><rect x="8" y="14" width="6" height="6"/><path d="M5 6V4M17 6V4"/>',
  bed:      '<rect x="1" y="12" width="20" height="4" rx="1"/><path d="M3 12V8a2 2 0 012-2h12a2 2 0 012 2v4"/><path d="M1 16v2M21 16v2"/><rect x="5" y="8" width="4" height="4" rx="1"/><rect x="13" y="8" width="4" height="4" rx="1"/>',
  tree:     '<circle cx="11" cy="7" r="6"/><path d="M11 13v7"/><path d="M8 20h6"/><circle cx="8" cy="5" r="3"/><circle cx="14" cy="5" r="3"/><circle cx="11" cy="4" r="3"/>',
  heart:    '<path d="M11 19s-7-4.35-7-9.5A4.5 4.5 0 0111 6a4.5 4.5 0 017 3.5c0 5.15-7 9.5-7 9.5z"/>'
};
var ICON_KEYS = Object.keys(ICON_LIB);

// ===== STATE =====
var _cats = [];
var _catDirty = false;

// ===== LOAD =====
async function loadCategories() {
  var data = await api('GET', 'categories', '?order=priority.asc,created_at.asc');
  if (data && data.length) {
    _cats = data;
  } else {
    _cats = [];
  }
  _catDirty = false;
  renderCategories();
}

// ===== ICON PREVIEW HTML =====
function _iconSvg(key, size) {
  size = size || 22;
  var inner = ICON_LIB[key] || ICON_LIB.star;
  return '<svg width="' + size + '" height="' + size + '" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

function _iconPreview(key) {
  return '<div style="width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#007AFF,#0098ff);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(0,122,255,.18)">' + _iconSvg(key, 22) + '</div>';
}

// ===== ICON PICKER DROPDOWN =====
function _iconPicker(catIdx) {
  var html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">';
  ICON_KEYS.forEach(function(k) {
    var sel = _cats[catIdx].icon_key === k;
    html += '<div onclick="pickCatIcon(' + catIdx + ',\'' + k + '\')" style="width:36px;height:36px;border-radius:9px;background:' +
      (sel ? 'linear-gradient(135deg,#007AFF,#0098ff)' : 'var(--bg3)') +
      ';display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid ' +
      (sel ? '#007AFF' : 'transparent') + ';transition:all .15s">' +
      '<svg width="18" height="18" fill="none" stroke="' + (sel ? '#fff' : 'var(--tx2)') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      (ICON_LIB[k] || '') + '</svg></div>';
  });
  html += '</div>';
  return html;
}

function pickCatIcon(idx, key) {
  _cats[idx].icon_key = key;
  _catDirty = true;
  renderCategories();
}

// ===== RENDER =====
function renderCategories() {
  var el = document.getElementById('cat-list');
  if (!el) return;

  var enabledCount = _cats.filter(function(c) { return c.enabled; }).length;

  // Header
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
    '<div>' +
      '<span style="font-size:13px;color:var(--tx3)">Manage categories shown on the rider app. Max 5 enabled.</span>' +
      '<div style="margin-top:4px;font-size:12px;font-weight:700;color:' + (enabledCount > 5 ? 'var(--rd)' : 'var(--gn)') + '">' + enabledCount + ' / 5 enabled</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button onclick="addCategory()" style="padding:8px 18px;background:var(--bl);color:#fff;border:none;border-radius:var(--r);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer">+ Add Category</button>' +
      '<button onclick="saveCategories()" style="padding:8px 18px;background:' + (_catDirty ? 'var(--gn)' : 'var(--bg3)') + ';color:' + (_catDirty ? '#fff' : 'var(--tx3)') + ';border:none;border-radius:var(--r);font-size:12px;font-weight:700;font-family:var(--font);cursor:pointer;transition:all .2s" id="cat-save-btn">' + (_catDirty ? 'Save Changes' : 'All Saved') + '</button>' +
    '</div>' +
  '</div>';

  // Category cards
  _cats.forEach(function(cat, idx) {
    var isOn = cat.enabled;
    var canEnable = enabledCount < 5 || isOn;

    html += '<div style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;margin-bottom:10px;display:flex;align-items:flex-start;gap:14px">' +

      // Icon preview
      _iconPreview(cat.icon_key) +

      // Main content
      '<div style="flex:1;min-width:0">' +
        // Top row: label + priority
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
          '<input type="text" value="' + esc(cat.label) + '" oninput="setCatField(' + idx + ',\'label\',this.value)" placeholder="Category name" style="flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:14px;font-weight:600;font-family:var(--font)">' +
          '<span style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;white-space:nowrap">Priority ' + cat.priority + '</span>' +
          '<button onclick="moveCatUp(' + idx + ')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--bdr);background:var(--bg3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2);font-size:14px" title="Move up">&uarr;</button>' +
          '<button onclick="moveCatDown(' + idx + ')" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--bdr);background:var(--bg3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--tx2);font-size:14px" title="Move down">&darr;</button>' +
        '</div>' +

        // Icon picker
        '<div style="margin-bottom:8px">' +
          '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Icon</label>' +
          _iconPicker(idx) +
        '</div>' +
      '</div>' +

      // Right side: toggle + delete
      '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0">' +
        '<label style="position:relative;width:44px;height:24px;cursor:' + (canEnable ? 'pointer' : 'not-allowed') + ';display:block;opacity:' + (canEnable ? '1' : '.4') + '">' +
          '<input type="checkbox" ' + (isOn ? 'checked' : '') + ' onchange="toggleCatEnabled(' + idx + ',this.checked)" ' + (!canEnable ? 'disabled' : '') + ' style="opacity:0;width:0;height:0;position:absolute">' +
          '<div style="position:absolute;inset:0;border-radius:12px;background:' + (isOn ? 'var(--gn)' : 'var(--bg3)') + ';transition:background .2s"></div>' +
          '<div style="position:absolute;top:2px;left:' + (isOn ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .2s"></div>' +
        '</label>' +
        '<span style="font-size:9px;font-weight:700;color:' + (isOn ? 'var(--gn)' : 'var(--tx3)') + '">' + (isOn ? 'ON' : 'OFF') + '</span>' +
        '<button onclick="deleteCategory(' + idx + ')" style="width:28px;height:28px;border-radius:6px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);cursor:pointer;display:flex;align-items:center;justify-content:center" title="Delete">' +
          '<svg width="12" height="12" fill="none" stroke="var(--rd)" stroke-width="2"><path d="M2 2l8 8M10 2l-8 8"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';
  });

  el.innerHTML = html;
}

// ===== ACTIONS =====
function setCatField(idx, field, val) {
  _cats[idx][field] = val;
  _catDirty = true;
  // Only update save button, not full re-render (preserves focus)
  var btn = document.getElementById('cat-save-btn');
  if (btn) { btn.textContent = 'Save Changes'; btn.style.background = 'var(--gn)'; btn.style.color = '#fff'; }
}

function toggleCatEnabled(idx, val) {
  var enabledCount = _cats.filter(function(c) { return c.enabled; }).length;
  if (val && enabledCount >= 5) {
    alert('Maximum 5 categories can be enabled. Disable one first.');
    renderCategories();
    return;
  }
  _cats[idx].enabled = val;
  _catDirty = true;
  renderCategories();
}

function moveCatUp(idx) {
  if (idx === 0) return;
  // Swap priorities
  var cur = _cats[idx].priority;
  var prev = _cats[idx - 1].priority;
  _cats[idx].priority = prev;
  _cats[idx - 1].priority = cur;
  // Re-sort
  _cats.sort(function(a, b) { return a.priority - b.priority; });
  _catDirty = true;
  renderCategories();
}

function moveCatDown(idx) {
  if (idx >= _cats.length - 1) return;
  var cur = _cats[idx].priority;
  var nxt = _cats[idx + 1].priority;
  _cats[idx].priority = nxt;
  _cats[idx + 1].priority = cur;
  _cats.sort(function(a, b) { return a.priority - b.priority; });
  _catDirty = true;
  renderCategories();
}

function addCategory() {
  _cats.push({
    id: null,
    label: 'New Category',
    icon_key: 'star',
    priority: 5,
    enabled: false,
    created_at: new Date().toISOString()
  });
  _catDirty = true;
  renderCategories();
}

function deleteCategory(idx) {
  if (!confirm('Delete "' + _cats[idx].label + '"? This also removes it from all places.')) return;
  var cat = _cats[idx];
  _cats.splice(idx, 1);
  _catDirty = true;
  renderCategories();

  // Delete from DB if it has an ID
  if (cat.id) {
    api('DELETE', 'place_categories', '?category_id=eq.' + cat.id);
    api('DELETE', 'categories', '?id=eq.' + cat.id);
  }
}

// ===== SAVE =====
async function saveCategories() {
  if (!_catDirty) return;

  var btn = document.getElementById('cat-save-btn');
  if (btn) { btn.textContent = 'Saving...'; btn.style.background = 'var(--bg3)'; btn.style.color = 'var(--tx3)'; }

  // Reassign clean priorities 0-N based on current order
  _cats.forEach(function(c, i) { c.priority = i; });

  for (var i = 0; i < _cats.length; i++) {
    var cat = _cats[i];
    var payload = {
      label: cat.label,
      icon_key: cat.icon_key,
      priority: cat.priority,
      enabled: cat.enabled,
      updated_at: new Date().toISOString()
    };

    if (cat.id) {
      // Update existing
      await api('PATCH', 'categories', '?id=eq.' + cat.id, payload);
    } else {
      // Insert new
      var result = await api('POST', 'categories', '', payload);
      if (result && result.length) {
        _cats[i].id = result[0].id;
      }
    }
  }

  _catDirty = false;
  if (btn) { btn.textContent = 'Saved!'; btn.style.background = 'var(--gn)'; btn.style.color = '#fff'; }
  setTimeout(function() { renderCategories(); }, 1200);
}
