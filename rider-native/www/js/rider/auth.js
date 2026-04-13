// RYDZ Rider - Authentication
// Signup saves to both localStorage and Supabase
// Login checks local first, then Supabase as fallback

async function doSignup() {
  var fn = document.getElementById('su-fn').value.trim();
  var ln = document.getElementById('su-ln').value.trim();
  var em = document.getElementById('su-em').value.trim();
  var ph = document.getElementById('su-ph').value.trim();
  var pw = document.getElementById('su-pw').value;
  var err = document.getElementById('su-err');

  if (!fn || !ln || !em || !ph || !pw) {
    err.textContent = 'Please fill in all fields.';
    err.classList.add('show');
    return;
  }
  if (pw.length < 6) {
    err.textContent = 'Password must be at least 6 characters long.';
    err.classList.add('show');
    return;
  }
  err.classList.remove('show');

  // Check if email already exists in Supabase
  try {
    var chk = await fetch(SUPA_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(em) + '&role=eq.rider&select=id', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if (chk.ok) {
      var existing = await chk.json();
      if (existing && existing.length) {
        err.textContent = 'An account with this email already exists. Please sign in instead.';
        err.classList.add('show');
        return;
      }
    }
  } catch (e) {}

  var uid = 'r-' + Math.random().toString(36).slice(2, 8);
  var user = {
    id: uid, role: 'rider', name: fn + ' ' + ln,
    firstName: fn, lastName: ln, email: em,
    phone: ph, password: pw, createdAt: Date.now()
  };

  // Save locally
  db.users.push(user);
  curUser = user;
  await sv();

  // Save to Supabase (this is what makes it appear in admin)
  supaSaveUser(user);

  try { localStorage.setItem('rydz-uid', uid); } catch (e) {}
  // New account: clear any stale onboarded flag so the intro runs
  try { localStorage.removeItem('rydz-onboarded'); } catch (e) {}
  if (typeof syncPushToken === 'function') syncPushToken();
  // Show post-signup onboarding (location -> notifications -> welcome)
  if (typeof onbStart === 'function') { onbStart(); }
  else { go('home'); }
}

async function doLogin() {
  var em = document.getElementById('li-em').value.trim();
  var pw = document.getElementById('li-pw').value;
  var err = document.getElementById('li-err');

  if (!em || !pw) {
    err.textContent = 'Please enter email and password.';
    err.classList.add('show');
    return;
  }

  // Check local db first
  var user = db.users.find(function(u) {
    return u.role === 'rider' && u.email === em && u.password === pw;
  });

  // If not found locally, try Supabase directly
  if (!user) {
    try {
      var res = await fetch(SUPA_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(em) + '&password=eq.' + encodeURIComponent(pw) + '&role=eq.rider', {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      if (res.ok) {
        var rows = await res.json();
        if (rows && rows.length) {
          // Found in Supabase - add to local db
          var su = rows[0];
          user = {
            id: su.id, role: su.role, name: su.name,
            firstName: su.first_name, lastName: su.last_name,
            email: su.email, phone: su.phone, password: su.password,
            disabled: !!su.disabled, createdAt: su.created_at
          };
          db.users.push(user);
          await sv();
        }
      }
    } catch (e) {
      console.error('Supabase login check:', e);
    }
  }

  if (!user) {
    err.textContent = 'Invalid email or password.';
    err.classList.add('show');
    return;
  }

  // Check if account is disabled
  if (user.disabled) {
    err.classList.remove('show');
    alert('Your account has been disabled. Please contact Rydz support for more information.');
    return;
  }

  err.classList.remove('show');
  curUser = user;
  try { localStorage.setItem('rydz-uid', user.id); } catch (e) {}
  if (typeof syncPushToken === 'function') syncPushToken();
  go('home');
}

async function doSignOut() {
  closeSB();
  curUser = null;
  try { localStorage.setItem('rydz-uid', ''); } catch (e) {}
  go('welcome');
}
