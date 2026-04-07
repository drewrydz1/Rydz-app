// RYDZ Rider - Bottom Tab Bar

function switchTab(tab) {
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('on'); });

  // Update tab button states
  document.querySelectorAll('.tab-bar .tab').forEach(function(b) { b.classList.remove('active'); });

  var btn = document.getElementById('tab-btn-' + tab);
  if (btn) btn.classList.add('active');

  if (tab === 'home') {
    // Show the normal home content (hdr, home-scroll), hide tab screens
    var hdr = document.querySelector('#s-home .hdr');
    var scroll = document.querySelector('#s-home .home-scroll');
    if (hdr) hdr.style.display = '';
    if (scroll) scroll.style.display = '';
    // Refresh map
    setTimeout(function() {
      if (typeof google !== 'undefined' && google.maps && window._gm && window._gm['home-map'] && window._gm['home-map'].map) {
        google.maps.event.trigger(window._gm['home-map'].map, 'resize');
      }
    }, 100);
  } else {
    // Hide home content, show tab content
    var hdr = document.querySelector('#s-home .hdr');
    var scroll = document.querySelector('#s-home .home-scroll');
    if (hdr) hdr.style.display = 'none';
    if (scroll) scroll.style.display = 'none';

    var tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('on');

    // Update account info when switching to account tab
    if (tab === 'account' && typeof curUser !== 'undefined' && curUser) {
      var av = document.getElementById('acct-av');
      var nm = document.getElementById('acct-nm');
      var em = document.getElementById('acct-em');
      if (av) av.textContent = (curUser.firstName || curUser.name || 'U')[0].toUpperCase();
      if (nm) nm.textContent = curUser.name || '—';
      if (em) em.textContent = curUser.email || '—';
    }
  }
}

// Show/hide tab bar based on current screen
function updateTabBar() {
  var isHome = (typeof cur !== 'undefined' && cur === 'home');
  if (isHome) {
    document.body.classList.add('tab-visible');
  } else {
    document.body.classList.remove('tab-visible');
  }
}
