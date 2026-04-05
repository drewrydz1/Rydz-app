// RYDZ Shared - Supabase API Client
// All apps use this single fetch wrapper
// Errors are logged and optionally shown to user

function supaFetch(m, t, q, b) {
  var c = new AbortController();
  var ti = setTimeout(function() { c.abort() }, 8000);
  var u = SUPA_URL + '/rest/v1/' + t + (q || '');
  var o = {
    method: m,
    headers: Object.assign({}, SUPA_H),
    signal: c.signal
  };
  if (b) o.body = JSON.stringify(b);
  if (m === 'PATCH') o.headers['Prefer'] = 'return=minimal';
  
  return fetch(u, o).then(function(r) {
    clearTimeout(ti);
    if (!r.ok) {
      return r.text().then(function(txt) {
        logError('supaFetch ' + m + ' ' + t, r.status + ': ' + txt);
        return null;
      });
    }
    if (m === 'PATCH' || m === 'DELETE') return true;
    return r.json();
  }).catch(function(err) {
    clearTimeout(ti);
    logError('supaFetch ' + m + ' ' + t, err.message || err);
    return null;
  });
}
