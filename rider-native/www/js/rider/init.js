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

// ── Splash screen ──

var _splashDismissed = false;

function _dismissSplash() {
  if (_splashDismissed) return;
  _splashDismissed = true;
  var splash = document.getElementById('s-load');
  if (!splash) return;
  splash.style.transition = 'opacity 0.4s ease';
  splash.style.opacity = '0';
  setTimeout(function() {
    splash.classList.remove('on');
    splash.style.display = 'none';
  }, 420);
}

// Poll until home screen content is painted, then dismiss splash
function _watchForContent() {
  var t = 0;
  var iv = setInterval(function() {
    t += 1;
    var mapOk = document.querySelector('#home-map .gm-style');
    var catsOk = document.getElementById('home-cats') && document.getElementById('home-cats').children.length > 0;
    var promoOk = document.getElementById('promo-trk') && document.getElementById('promo-trk').children.length > 0;

    if ((mapOk && catsOk && promoOk) || t >= 50) {
      clearInterval(iv);
      // Small buffer for paint
      setTimeout(_dismissSplash, 150);
    }
  }, 120);
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
  if (mr) { arId = mr.id; target = 'wait'; }
  else if (curUser && curUser.email) { target = 'home'; }
  else { target = 'welcome'; }

  // Navigate — splash stays on top via z-index
  go(target);
  // go() removes .on from s-load — re-add it
  var _sp = document.getElementById('s-load');
  if (_sp) _sp.classList.add('on');

  if (target === 'home') {
    document.body.classList.add('tab-visible');
    // Fire categories + promos + sync — they render when ready
    initRiderCategories();
    loadSupaPromos();
    supaSync();
    // Watch for all content, then dismiss splash
    _watchForContent();
  } else {
    // Non-home: dismiss splash right away
    setTimeout(_dismissSplash, 300);
  }

  setInterval(poll, 700);
  setTimeout(supaSync, 3000);
  setInterval(supaSync, 5000);
}

// Apply logos
document.querySelectorAll('.logo-img').forEach(function(img){
  if(!img.src || img.src === window.location.href){
    img.src = img.style.height === '32px' ? LOGO_SM : LOGO_LG;
  }
});

init();
