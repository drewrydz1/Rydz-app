// RYDZ Rider - Dynamic Categories
// Loads enabled categories from Supabase, renders on home + search screens

// ===== ICON LIBRARY (SVG files in /icons/, matches admin/pages/categories.js) =====
var CAT_ICONS = {
  icon1: 'icons/1.svg',
  icon2: 'icons/2.svg',
  icon3: 'icons/3.svg',
  icon4: 'icons/4.svg',
  icon5: 'icons/5.svg',
  icon6: 'icons/6.svg',
  icon7: 'icons/7.svg',
  icon8: 'icons/8.svg',
  icon9: 'icons/9.svg'
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

// ===== ICON IMG HELPER =====
function _catIconImg(key, size) {
  var src = CAT_ICONS[key] || CAT_ICONS.icon9;
  return '<img src="' + src + '" width="' + size + '" height="' + size + '" style="display:block;object-fit:contain" alt="">';
}

// ===== RENDER ON BOTH SCREENS =====
function renderRiderCategories() {
  var cats = _riderCats || [];

  // Home screen
  var homeEl = document.getElementById('home-cats');
  if (homeEl) {
    var h = '';
    cats.forEach(function(c) {
      var key = c.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      h += '<div class="cat-btn" onclick="openCatSearch(\'' + key + '\')">' +
        '<div class="cat-ico">' + _catIconImg(c.icon_key, 22) + '</div>' +
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
        '<div class="ss-ci">' + _catIconImg(c.icon_key, 18) + '</div>' +
        '<span>' + esc(c.label) + '</span></div>';
    });
    searchEl.innerHTML = s;
  }
}

// ===== FALLBACK (renders immediately before Supabase responds) =====
function _renderFallbackCats() {
  _riderCats = [
    { label: 'Recent', icon_key: 'icon9' },
    { label: 'Dining', icon_key: 'icon1' },
    { label: 'Hotels', icon_key: 'icon6' },
    { label: 'Parks', icon_key: 'icon5' },
    { label: 'Shopping', icon_key: 'icon7' }
  ];
  renderRiderCategories();
}

// ===== INIT — called from rider init =====
function initRiderCategories() {
  _renderFallbackCats();
  loadRiderCategories();
}
