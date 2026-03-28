// RYDZ Admin - API Layer
// All Supabase communication for admin panel

async function api(m, t, q, b) {
  var u = SUPA + '/rest/v1/' + t + (q || '');
  var o = {
    method: m,
    headers: {
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (b) o.body = JSON.stringify(b);
  if (m === 'PATCH' || m === 'DELETE') o.headers['Prefer'] = 'return=minimal';

  try {
    var r = await fetch(u, o);
    if (!r.ok) {
      var errText = await r.text();
      console.error('[RYDZ Admin API] ' + m + ' ' + t + ' failed:', r.status, errText);
      return null;
    }
    // PATCH and DELETE with return=minimal have empty body
    if (m === 'PATCH' || m === 'DELETE') return true;
    var data = await r.json();
    return data;
  } catch (e) {
    console.error('[RYDZ Admin API] ' + m + ' ' + t + ' error:', e);
    return null;
  }
}

async function loadData() {
  var u = await api('GET', 'users', '?order=created_at.asc');
  var r = await api('GET', 'rides', '?order=created_at.desc&limit=1000');
  var t = await api('GET', 'tickets', '?order=created_at.desc');

  if (u) { users = u; } else { console.warn('[RYDZ] users fetch returned null'); }
  if (r) { rides = r; } else { console.warn('[RYDZ] rides fetch returned null'); }
  if (t) { tickets = t; } else { console.warn('[RYDZ] tickets fetch returned null'); }

  console.log('[RYDZ loadData] users:', users.length, 'rides:', rides.length, 'tickets:', tickets.length);

  updateMetrics();
  updateMap();

  // Re-render visible pages
  if (document.getElementById('pg-riders').classList.contains('on')) renderRiders();
  if (document.getElementById('pg-drivers').classList.contains('on')) renderDrivers();
  if (document.getElementById('pg-tickets').classList.contains('on')) renderTickets();
}
