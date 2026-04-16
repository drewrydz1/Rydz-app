// RYDZ Shared - Supabase API Client
// All apps use this single fetch wrapper + singleton realtime client
// Errors are logged and optionally shown to user

// Singleton Supabase realtime client. Every module that needs realtime
// (rider/realtime.js, rider/dispatch.js, driver/realtime.js, driver/dispatch.js)
// MUST call getRealtimeClient() instead of creating its own. One WebSocket
// connection per app = no races, no zombie subscriptions, no iOS background kills
// leaving one of two sockets dead.
var _sharedRealtimeClient = null;

function getRealtimeClient() {
  if (_sharedRealtimeClient) return _sharedRealtimeClient;
  if (!window.supabase || !window.supabase.createClient) return null;
  try {
    _sharedRealtimeClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } catch (e) {
    console.error('[supabase] realtime client init failed', e);
    return null;
  }
  return _sharedRealtimeClient;
}

// Force tear-down and rebuild of the shared realtime connection.
// Call on app resume from background — iOS kills WebSockets silently.
function reconnectRealtimeClient() {
  if (_sharedRealtimeClient) {
    try {
      if (_sharedRealtimeClient.realtime && _sharedRealtimeClient.realtime.disconnect) {
        _sharedRealtimeClient.realtime.disconnect();
      }
    } catch (e) {}
    _sharedRealtimeClient = null;
  }
  return getRealtimeClient();
}

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
