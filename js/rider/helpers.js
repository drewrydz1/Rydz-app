// RYDZ Rider - Helpers & Navigation

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmt(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtD(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _origDraw(el, opts) {
  if (!el) return;
  var s = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e9eff7"/><path d="M0,0 L20,0 L18,12 L16,28 L20,42 L18,54 L16,66 L20,78 L22,92 L18,100 L0,100Z" fill="#c5d8ee" opacity=".55"/><rect x="20" y="0" width="80" height="100" fill="#edf1f7"/><g stroke="#d5dbe3" stroke-width=".35" fill="none">';
  for (var i = 24; i < 96; i += 7) s += '<line x1="' + i + '" y1="3" x2="' + i + '" y2="97"/>';
  for (var j = 8; j < 96; j += 7) s += '<line x1="20" y1="' + j + '" x2="96" y2="' + j + '"/>';
  s += '</g><line x1="55" y1="2" x2="55" y2="98" stroke="#c0c9d4" stroke-width="1.4"/><polygon points="22,14 56,14 56,76 42,76 32,72 22,62" fill="rgba(0,122,255,.05)" stroke="#007AFF" stroke-width=".5" stroke-dasharray="2,1.5"/><text x="38" y="46" font-size="3.2" fill="#8e9196" font-family="Poppins,sans-serif" font-weight="700" text-anchor="middle">NAPLES</text>';
  if (opts && opts.pu) s += '<circle cx="' + opts.pu.x + '" cy="' + opts.pu.y + '" r="4" fill="#34c759" opacity=".15"/><circle cx="' + opts.pu.x + '" cy="' + opts.pu.y + '" r="2.5" fill="#34c759" stroke="#fff" stroke-width="1"/>';
  if (opts && opts.d) s += '<circle cx="' + opts.d.x + '" cy="' + opts.d.y + '" r="4" fill="#007AFF" opacity=".15"/><circle cx="' + opts.d.x + '" cy="' + opts.d.y + '" r="2.5" fill="#007AFF" stroke="#fff" stroke-width="1"/>';
  if (opts && opts.pu && opts.d) s += '<line x1="' + opts.pu.x + '" y1="' + opts.pu.y + '" x2="' + opts.d.x + '" y2="' + opts.d.y + '" stroke="#007AFF" stroke-width=".8" stroke-dasharray="2,1.5" opacity=".45"/>';
  s += '</svg>';
  el.innerHTML = s;
}

// Navigation - controls which screen is visible
function go(id) {
  document.querySelectorAll('.scr').forEach(function(s) { s.classList.remove('on'); });
  var el = document.getElementById('s-' + id);
  if (el) el.classList.add('on');
  cur = id;
  closeAllM();

  if (id === 'home') {
    updHome();
    drawMap(document.getElementById('home-map'), { pu: puSel, d: doSel });
    renPromoScroll();
  }

  if (id === 'pass') updPass();
  if (id === 'overview') updOv();

  // FINDING SCREEN: Runs dispatch engine during the spinner animation
  // 1. Pulls fresh driver GPS from Supabase
  // 2. Evaluates all online drivers
  // 3. Picks the best one, calculates ETA
  // 4. Stores result in window._rideETA and window._bestDriverId
  // 5. Transitions to confirm screen with result ready to display
  if (id === 'finding') {
    window._rideETA = null;
    window._bestDriverId = null;
    // Pull fresh data first
    if (typeof supaSync === 'function') supaSync();
    // Wait for fresh data, then run dispatch
    setTimeout(function() {
      var _puLat = parseFloat(puSel.lat || puSel.x || 0);
      var _puLng = parseFloat(puSel.lng || puSel.y || 0);
      if (typeof calcRealETA === 'function' && _puLat && _puLng) {
        calcRealETA(_puLat, _puLng, function(eta, drvId) {
          window._rideETA = eta;
          window._bestDriverId = drvId;
          go('confirm');
        });
      } else {
        go('confirm');
      }
    }, 2000);
  }

  if (id === 'confirm') updConf();
  if (id === 'wait') updWait();
  if (id === 'complete') {
    if (typeof updComplete === 'function') updComplete();
  }
}
