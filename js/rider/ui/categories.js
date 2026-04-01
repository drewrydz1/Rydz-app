// RYDZ Rider - Dynamic Categories
// Loads enabled categories from Supabase, renders on home + search screens

// ===== ICON LIBRARY (matches admin/pages/categories.js) =====
var CAT_ICONS = {
  clock:    '<circle cx="11" cy="11" r="8.5"/><path d="M11 6v5l3.5 2"/>',
  utensils: '<path d="M5 2v7a3 3 0 006 0V2M8 9v11M17 2v4a2 2 0 004 0V2M19 6v13"/>',
  cocktail: '<path d="M4 2h14l-5 7v6h2v2H7v-2h2V9L4 2z"/>',
  bed:      '<rect x="2" y="8" width="18" height="11" rx="1.5"/><path d="M6 8V5.5A2.5 2.5 0 018.5 3h5A2.5 2.5 0 0116 5.5V8"/>',
  beach:    '<path d="M11 2c-3 4-7 6.5-9 7.5h18C18 9 14 6 11 2z"/><path d="M11 2v18M2 20h18"/>',
  bag:      '<rect x="2" y="6" width="18" height="14" rx="1.5"/><path d="M2 6l2.5-4h13L20 6"/><path d="M11 10v4"/>',
  coffee:   '<path d="M3 6h12v7a4 4 0 01-4 4H7a4 4 0 01-4-4V6z"/><path d="M15 8h2a2 2 0 010 4h-2"/><path d="M3 19h12"/>',
  tree:     '<path d="M11 2L4 12h4l-2 4h10l-2-4h4L11 2z"/><path d="M11 16v4"/>',
  music:    '<circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/><path d="M9 17V5l10-2v12"/>',
  heart:    '<path d="M11 19s-7-4.35-7-9.5A4.5 4.5 0 0111 6a4.5 4.5 0 017 3.5c0 5.15-7 9.5-7 9.5z"/>',
  star:     '<path d="M11 2l2.5 5.5L19 8.5l-4 4 1 5.5-5-2.8-5 2.8 1-5.5-4-4 5.5-1z"/>',
  gas:      '<rect x="3" y="4" width="10" height="16" rx="1"/><path d="M13 8h2a2 2 0 012 2v4"/><rect x="5" y="7" width="6" height="4" rx=".5"/>',
  pharmacy: '<rect x="3" y="3" width="16" height="16" rx="2"/><path d="M11 7v8M7 11h8"/>',
  gym:      '<path d="M4 11h14M2 8v6M20 8v6M5 9v4M17 9v4"/>'
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
