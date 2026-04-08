// RYDZ Rider - Profile (My Account)

function renProfile() {
  if (!curUser) return;
  document.getElementById('ms-profile').innerHTML =
    // Custom header with Save button top-right
    '<div class="mtop" style="display:flex;align-items:center">' +
      '<button class="btn btn-ghost" onclick="menuBack()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button>' +
      '<h2 style="flex:1">My Account</h2>' +
      '<button onclick="saveProfile()" style="padding:6px 14px;border-radius:10px;background:var(--bl);border:none;color:#fff;font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer">Save</button>' +
    '</div>' +
    '<div class="pf-sec">' +
      '<div class="ff"><label>First Name</label><input id="pf-fn" value="' + esc(curUser.firstName || '') + '"></div>' +
      '<div class="ff"><label>Last Name</label><input id="pf-ln" value="' + esc(curUser.lastName || '') + '"></div>' +
      '<div class="ff"><label>Email</label><input id="pf-em" type="text" value="' + esc(curUser.email || '') + '"></div>' +
      '<div class="ff"><label>Phone</label><input id="pf-ph" type="tel" value="' + esc(curUser.phone || '') + '"></div>' +
      '<div class="ff"><label>Password</label><input id="pf-pw" type="password" placeholder="Enter new password"></div>' +
      '<div id="pf-msg" style="display:none;padding:10px;border-radius:var(--r);background:var(--gnl);color:var(--gn);font-size:13px;font-weight:600;text-align:center;margin-bottom:10px"></div>' +

      // Sign Out
      '<button onclick="doSignOut()" style="width:100%;margin-top:6px;padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:15px;font-weight:600;text-align:center;cursor:pointer;font-family:var(--font)">Sign Out</button>' +

      // Delete Account
      '<button onclick="confirmDeleteAccount()" style="width:100%;margin-top:10px;padding:14px;border-radius:14px;background:rgba(255,69,58,0.08);border:1px solid rgba(255,69,58,0.15);color:var(--rd);font-size:15px;font-weight:600;text-align:center;cursor:pointer;font-family:var(--font)">Delete Account</button>' +
    '</div>';
}

async function saveProfile() {
  var fn = document.getElementById('pf-fn').value.trim();
  var ln = document.getElementById('pf-ln').value.trim();
  var em = document.getElementById('pf-em').value.trim();
  var ph = document.getElementById('pf-ph').value.trim();
  var pw = document.getElementById('pf-pw').value;
  if (fn) curUser.firstName = fn;
  if (ln) curUser.lastName = ln;
  if (fn || ln) curUser.name = (fn + ' ' + ln).trim();
  if (em) curUser.email = em;
  if (ph) curUser.phone = ph;
  if (pw) curUser.password = pw;
  var u = db.users.find(function(x) { return x.id === curUser.id; });
  if (u) Object.assign(u, curUser);
  await sv();
  supaUpdateUser(curUser);
  updSB();
  var msg = document.getElementById('pf-msg');
  if (msg) {
    msg.textContent = 'Profile updated successfully';
    msg.style.display = 'block';
    setTimeout(function() { msg.style.display = 'none'; }, 2500);
  }
}

function confirmDeleteAccount() {
  if (!curUser) return;
  if (!confirm('Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.')) return;
  if (!confirm('This is permanent. Tap OK to confirm account deletion.')) return;
  deleteAccount();
}

async function deleteAccount() {
  if (!curUser) return;
  var uid = curUser.id;

  // Delete from Supabase
  try {
    await fetch(SUPA_URL + '/rest/v1/users?id=eq.' + encodeURIComponent(uid), {
      method: 'DELETE',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY
      }
    });
  } catch (e) {}

  // Remove from local db
  if (db && db.users) {
    db.users = db.users.filter(function(u) { return u.id !== uid; });
  }

  // Clear session
  curUser = null;
  try {
    localStorage.setItem('rydz-uid', '');
    localStorage.removeItem('rydz-db');
  } catch (e) {}

  closeAllM();
  go('welcome');
}
