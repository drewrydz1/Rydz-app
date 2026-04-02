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

  if (mr) {
    arId = mr.id;
    go('wait');
  } else if (curUser && curUser.email) {
    go('home');
  } else {
    go('welcome');
  }

  // Load dynamic categories from Supabase
  initRiderCategories();

  // Start polling and sync
  setInterval(poll, 700);
  setTimeout(supaSync, 2000);
  setInterval(supaSync, 5000);
}

// Apply logos to img.logo-img elements that have no src yet (login/signup screens)
document.querySelectorAll('.logo-img').forEach(function(img){
  if(!img.src || img.src === window.location.href){
    img.src = img.style.height === '32px' ? LOGO_SM : LOGO_LG;
  }
});

init();
