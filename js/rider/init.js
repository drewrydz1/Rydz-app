// RYDZ Rider - Initialization
// Startup sequence, polling loop

async function poll() {
  var f = await ld();
  if (!f) return;
  db = f;

  if (curUser) {
    var _du = db.users.find(function(u) { return u.id === curUser.id; });
    if (_du && _du.disabled) {
      curUser = null;
      try { localStorage.setItem('rydz-uid', ''); } catch (e) {}
      go('welcome');
      setTimeout(function() { alert('Your account has been disabled. Please contact Rydz support for more information.'); }, 300);
      return;
    }
  }

  if (cur === 'home') updAlerts();
  if (cur === 'wait') updWait();
  if (cur === 'pass' && document.getElementById('p-mx')) {
    document.getElementById('p-mx').textContent = db.settings.maxPassengers;
  }

  if (!arId && curUser) {
    var mr = db.rides.find(function(r) {
      return r.riderId === curUser.id &&
        ['requested', 'accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
    });
    if (mr) {
      arId = mr.id;
      if (cur !== 'wait') go('wait');
    }
  }
}

// ── Splash screen control ──

function _dismissSplash() {
  var splash = document.getElementById('s-load');
  if (!splash || !splash.classList.contains('on')) return;
  splash.style.transition = 'opacity 0.45s ease';
  splash.style.opacity = '0';
  setTimeout(function() {
    splash.classList.remove('on');
    splash.style.opacity = '';
    splash.style.transition = '';
  }, 460);
}

function _waitForReady() {
  var checks = 0;
  var maxChecks = 60; // 6 seconds max

  function check() {
    checks++;
    var mapEl = document.getElementById('home-map');
    var mapReady = mapEl && mapEl.querySelector('.gm-style');
    var catsEl = document.getElementById('home-cats');
    var catsReady = catsEl && catsEl.children.length > 0;
    var promoEl = document.getElementById('promo-trk');
    var promoReady = promoEl && promoEl.children.length > 0;

    // ALL three must be ready, or timeout
    if ((mapReady && catsReady && promoReady) || checks >= maxChecks) {
      // Extra 200ms buffer for images to start painting
      setTimeout(_dismissSplash, 200);
    } else {
      setTimeout(check, 100);
    }
  }
  setTimeout(check, 200);
}

// ── Fetch Supabase promos (returns a promise) ──

function _fetchSupaPromos() {
  return fetch(SUPA_URL + '/rest/v1/promotions?order=slot_index.asc&is_active=eq.true', {
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data && Array.isArray(data) && data.length) {
      _supaPromos = data;
    }
  }).catch(function() {});
}

// ── Fetch Supabase categories (returns a promise) ──

function _fetchSupaCats() {
  return supaFetch('GET', 'categories', '?enabled=eq.true&order=priority.asc')
    .then(function(data) {
      if (data && Array.isArray(data)) {
        _riderCats = data;
      } else {
        _riderCats = [];
      }
    }).catch(function() {
      // Fallback
      _riderCats = [
        { label: 'Recent', icon_key: 'icon9' },
        { label: 'Dining', icon_key: 'icon1' },
        { label: 'Hotels', icon_key: 'icon6' },
        { label: 'Parks', icon_key: 'icon5' },
        { label: 'Shopping', icon_key: 'icon7' }
      ];
    });
}

// ── Main init ──

async function init() {
  try {
    var _cv = localStorage.getItem('rydz-ver');
    if (_cv !== RYDZ_VERSION) {
      localStorage.removeItem('rydz-db');
      localStorage.setItem('rydz-ver', RYDZ_VERSION);
    }
  } catch(e) {}

  try {
    var _ht = localStorage.getItem('rydz-hrs-text');
    if (_ht) {
      var _he = document.getElementById('h-hrs');
      if (_he) _he.textContent = _ht;
    }
  } catch (e) {}

  db = await ld();
  if (!db) { db = ddb(); await sv(); }

  if (db && db.rides) {
    db.rides = db.rides.filter(function(r) {
      return ['requested', 'accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
    });
    try { localStorage.setItem('rydz-db', JSON.stringify(db)); } catch (e) {}
  }

  if (!db.settings.promotions || !db.settings.promotions.length) {
    db.settings.promotions = typeof PROMOS !== 'undefined' ? PROMOS.map(function(p) { return Object.assign({}, p); }) : [];
    await sv();
  }

  if (!db.users.find(function(u) { return u.email === 'test'; })) {
    db.users.push(typeof TEST_ACCT !== 'undefined' ? TEST_ACCT : { id: 'r-test', role: 'rider', name: 'Test User', email: 'test', password: '1' });
    await sv();
  }

  var uid = null;
  try { uid = localStorage.getItem('rydz-uid'); } catch (e) {}
  if (uid) {
    curUser = db.users.find(function(u) { return u.id === uid; });
  }

  var mr = curUser ? db.rides.find(function(r) {
    return r.riderId === curUser.id &&
      ['requested', 'accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
  }) : null;

  var target;
  if (mr) {
    arId = mr.id;
    target = 'wait';
  } else if (curUser && curUser.email) {
    target = 'home';
  } else {
    target = 'welcome';
  }

  if (target !== 'home') {
    // Non-home screens: navigate and dismiss splash immediately
    go(target);
    _dismissSplash();
    setInterval(poll, 700);
    setTimeout(supaSync, 2000);
    setInterval(supaSync, 5000);
    return;
  }

  // ── HOME SCREEN: load everything BEFORE showing ──

  // Safety: always open within 6 seconds no matter what
  var _opened = false;
  var _safetyTimer = setTimeout(function() {
    if (!_opened) { _opened = true; _forceOpen(); }
  }, 6000);

  function _forceOpen() {
    clearTimeout(_safetyTimer);
    go('home');
    var sp = document.getElementById('s-load');
    if (sp) { sp.classList.remove('on'); sp.style.display = 'none'; }
    document.body.classList.add('tab-visible');
    if (typeof renderRiderCategories === 'function') renderRiderCategories();
    if (typeof renPromoScroll === 'function') renPromoScroll();
    if (typeof initRiderCategories === 'function') initRiderCategories();
  }

  // 1. Fetch Supabase promos + categories in parallel (with individual timeouts)
  try {
    await Promise.all([
      _fetchSupaPromos().catch(function() {}),
      _fetchSupaCats().catch(function() {}),
      supaSync().catch(function() {})
    ]);
  } catch(e) {}

  if (_opened) { setInterval(poll, 700); setInterval(supaSync, 5000); return; }

  // 2. Now navigate to home (behind splash)
  go(target);
  var _splash = document.getElementById('s-load');
  if (_splash) _splash.classList.add('on');
  document.body.classList.add('tab-visible');

  // 3. Render categories and promos with FINAL Supabase data
  if (typeof renderRiderCategories === 'function') renderRiderCategories();
  if (typeof renPromoScroll === 'function') renPromoScroll();

  // 4. Wait for map to finish rendering, then fade out splash
  _opened = true;
  clearTimeout(_safetyTimer);
  _waitForReady();

  // 5. Start polling
  setInterval(poll, 700);
  setInterval(supaSync, 5000);
}

// Apply logos
document.querySelectorAll('.logo-img').forEach(function(img){
  if(!img.src || img.src === window.location.href){
    img.src = img.style.height === '32px' ? LOGO_SM : LOGO_LG;
  }
});

init();
