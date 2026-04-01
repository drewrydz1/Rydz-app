// RYDZ Rider - Dynamic Categories
// Loads enabled categories from Supabase, renders on home + search screens

// ===== ICON LIBRARY (matches admin/pages/categories.js) =====
var CAT_ICONS = {
  clock:    '<path d="M11 6v5l3.5 2"/><path d="M7.5 3.5a8.5 8.5 0 11-1 12"/><path d="M3 12.5l3.5 3.5L3 19.5"/>',
  utensils: '<path d="M5 2v7a3 3 0 006 0V2M8 9v11M17 2v4a2 2 0 004 0V2M19 6v13"/>',
  cocktail: '<path d="M4 2h14l-5 7v6h2v2H7v-2h2V9L4 2z"/>',
  gift:     '<rect x="2.5" y="9" width="17" height="11" rx="1.5"/><path d="M11 9v11"/><rect x="4" y="5" width="14" height="4" rx="1"/><path d="M11 5c-1-3-5-3-5-1s4 2 5 1z"/><path d="M11 5c1-3 5-3 5-1s-4 2-5 1z"/>',
  store:    '<rect x="2" y="10" width="18" height="10" rx="1"/><path d="M2 6h18v4H2z"/><rect x="8" y="14" width="6" height="6"/><path d="M5 6V4M17 6V4"/>',
  bed:      '<rect x="1" y="12" width="20" height="4" rx="1"/><path d="M3 12V8a2 2 0 012-2h12a2 2 0 012 2v4"/><path d="M1 16v2M21 16v2"/><rect x="5" y="8" width="4" height="4" rx="1"/><rect x="13" y="8" width="4" height="4" rx="1"/>',
  tree:     '<circle cx="11" cy="7" r="6"/><path d="M11 13v7"/><path d="M8 20h6"/><circle cx="8" cy="5" r="3"/><circle cx="14" cy="5" r="3"/><circle cx="11" cy="4" r="3"/>',
  heart:    '<path d="M11 19s-7-4.35-7-9.5A4.5 4.5 0 0111 6a4.5 4.5 0 017 3.5c0 5.15-7 9.5-7 9.5z"/>'
};

// ===== STATE =====
var _riderCats = null;

// ===== LOAD FROM SUPABASE =====
function loadRiderCategories() {
  supaFetch('GET', 'categories', '?enabled=eq.true&order=priority.asc')
    .then(function(data) {
      if (data && Array.isArray(data)) {
        _riderCats = data;
      } else {
        _riderCats = [];
      }
      renderRiderCategories();
    })
    .catch(function() {
      _riderCats = [];
      renderRiderCategories();
    });
}

// ===== SVG HELPER =====
function _catIconSvg(key, size) {
  var inner = CAT_ICONS[key] || CAT_ICONS.star;
  return '<svg width="' + size + '" height="' + size + '" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

// ===== RENDER ON BOTH SCREENS =====
function renderRiderCategories() {
  var cats = _riderCats || [];

  // Home screen (52px icons)
  var homeEl = document.getElementById('home-cats');
  if (homeEl) {
    var h = '';
    cats.forEach(function(c) {
      var key = c.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      h += '<div class="cat-btn" onclick="openCatSearch(\'' + key + '\')">' +
        '<div class="cat-ico">' + _catIconSvg(c.icon_key, 22) + '</div>' +
        '<span>' + esc(c.label) + '</span></div>';
    });
    homeEl.innerHTML = h;
  }

  // Search screen (smaller icons)
  var searchEl = document.getElementById('search-cats');
  if (searchEl) {
    var s = '';
    cats.forEach(function(c) {
      var key = c.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      s += '<div class="ss-cat" onclick="doCatSearch(\'' + key + '\',\'dest\')">' +
        '<div class="ss-ci">' + _catIconSvg(c.icon_key, 18) + '</div>' +
        '<span>' + esc(c.label) + '</span></div>';
    });
    searchEl.innerHTML = s;
  }
}

// ===== FALLBACK (renders immediately before Supabase responds) =====
function _renderFallbackCats() {
  _riderCats = [
    { label: 'Recent', icon_key: 'clock' },
    { label: 'Dining', icon_key: 'utensils' },
    { label: 'Hotels', icon_key: 'bed' },
    { label: 'Beaches', icon_key: 'beach' },
    { label: 'Shopping', icon_key: 'bag' }
  ];
  renderRiderCategories();
}

// ===== INIT — called from rider init =====
function initRiderCategories() {
  _renderFallbackCats();
  loadRiderCategories();
}
