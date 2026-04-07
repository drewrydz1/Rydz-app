// RYDZ Rider - Initialization
// Startup sequence, polling loop

async function poll() {
  var f = await ld();
  if (!f) return;
  db = f;

  // Check if account was disabled by admin
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

  // Check for active rides on this user
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

// Dismiss splash screen with fade
function _dismissSplash() {
  var splash = document.getElementById('s-load');
  if (!splash) return;
  splash.style.transition = 'opacity 0.4s ease';
  splash.style.opacity = '0';
  setTimeout(function() {
    splash.classList.remove('on');
    splash.style.opacity = '';
    splash.style.transition = '';
  }, 420);
}

// Wait for home screen content to be ready, then dismiss splash
function _waitForReady(target) {
  // If not going to home, dismiss splash immediately
  if (target !== 'home') {
    _dismissSplash();
    return;
  }

  var checks = 0;
  var maxChecks = 50; // 5 seconds max

  function check() {
    checks++;
    var mapEl = document.getElementById('home-map');
    var mapReady = mapEl && mapEl.querySelector('.gm-style');
    var catsEl = document.getElementById('home-cats');
    var catsReady = catsEl && catsEl.children.length > 0;
    var promoEl = document.getElementById('promo-trk');
    var promoReady = promoEl && promoEl.children.length > 0;

    // Dismiss when at least map + one other element is ready, or timeout
    if ((mapReady && (catsReady || promoReady)) || checks >= maxChecks) {
      // Small extra delay for visual polish
      setTimeout(_dismissSplash, 150);
    } else {
      setTimeout(check, 100);
    }
  }
  // Start checking after a brief moment
  setTimeout(check, 300);
}

async function init() {
  // Cache-bust: clear stale localStorage when version changes
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

  // Clear stale completed/cancelled rides from localStorage
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

  // Check for active ride
  var mr = curUser ? db.rides.find(function(r) {
    return r.riderId === curUser.id &&
      ['requested', 'accepted', 'en_route', 'arrived', 'picked_up'].indexOf(r.status) >= 0;
  }) : null;

  // Determine target screen
  var target;
  if (mr) {
    arId = mr.id;
    target = 'wait';
  } else if (curUser && curUser.email) {
    target = 'home';
  } else {
    target = 'welcome';
  }

  // Navigate to target (splash stays visible on top)
  go(target);
  if (target === 'home') document.body.classList.add('tab-visible');

  // Load dynamic categories from Supabase
  initRiderCategories();

  // Do first sync immediately, then wait for content to render
  try { await supaSync(); } catch(e) {}

  // Render promos after sync
  if (target === 'home' && typeof renPromoScroll === 'function') renPromoScroll();

  // Wait for everything to be visually ready, then fade out splash
  _waitForReady(target);

  // Start polling and recurring sync
  setInterval(poll, 700);
  setInterval(supaSync, 5000);
}

// Apply logos to img.logo-img elements that have no src yet (login/signup screens)
document.querySelectorAll('.logo-img').forEach(function(img){
  if(!img.src || img.src === window.location.href){
    img.src = img.style.height === '32px' ? LOGO_SM : LOGO_LG;
  }
});

init();
