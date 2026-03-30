// RYDZ Rider - Maps v3
// Solid route line, car icon for driver, no driver route, full interactivity

var SVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var NC={lat:26.1334,lng:-81.7935};
var MS=[{elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{elementType:'labels.text.fill',stylers:[{color:'#9e9e9e'}]},{elementType:'labels.text.stroke',stylers:[{color:'#ffffff'}]},{featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#ebebeb'}]},{featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#b0b0b0'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#eeeeee'}]},{featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'road.arterial',elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{featureType:'road.local',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#dce8f2'}]},{featureType:'water',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'landscape',elementType:'geometry.fill',stylers:[{color:'#f0f1f4'}]}];
var _gm={};

// Driver shuttle icon (base64 PNG)
var DRIVER_ICON_URL = 'data:image/png;base64,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';

window.drawMap = function(el, opts) {
  if (!el || typeof google === 'undefined' || !google.maps) return;
  var mid = el.id || 'm';

  if (!_gm[mid]) {
    _gm[mid] = {
      map: new google.maps.Map(el, {
        center: NC, zoom: 12.8,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        styles: MS
      }),
      mk: [], rl: null
    };
    _gm[mid].map._saPoly = new google.maps.Polygon({
      paths: SVC, strokeColor: '#007AFF', strokeOpacity: 0.55, strokeWeight: 2.5,
      fillColor: '#007AFF', fillOpacity: 0.05, map: _gm[mid].map, clickable: false
    });
  }

  var g = _gm[mid];
  g.mk.forEach(function(m) { m.setMap(null); }); g.mk = [];
  if (g.rl) { g.rl.setMap(null); g.rl = null; }

  // Pickup marker
  if (opts && opts.pu && opts.pu.lat) {
    g.mk.push(new google.maps.Marker({
      position: { lat: opts.pu.lat, lng: opts.pu.lng }, map: g.map,
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#34c759', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5, scale: 8 }
    }));
  }

  // Dropoff marker
  if (opts && opts.d && opts.d.lat) {
    g.mk.push(new google.maps.Marker({
      position: { lat: opts.d.lat, lng: opts.d.lng }, map: g.map,
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#ff453a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5, scale: 8 }
    }));
  }

  // SOLID route line between pickup and dropoff (no dashes, no blink)
  if (opts && opts.pu && opts.pu.lat && opts.d && opts.d.lat) {
    var bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: opts.pu.lat, lng: opts.pu.lng });
    bounds.extend({ lat: opts.d.lat, lng: opts.d.lng });
    g.map.fitBounds(bounds, { top: 50, bottom: 50, left: 40, right: 40 });

    // Smooth bezier curve
    var mLat = (opts.pu.lat + opts.d.lat) / 2;
    var mLng = (opts.pu.lng + opts.d.lng) / 2;
    var dL = opts.d.lat - opts.pu.lat, dN = opts.d.lng - opts.pu.lng;
    var off = Math.sqrt(dL * dL + dN * dN) * 0.25;
    mLat += off * 0.4; mLng -= off * 0.25;

    var cp = [];
    for (var i = 0; i <= 30; i++) {
      var t = i / 30, u = 1 - t;
      cp.push({
        lat: u * u * opts.pu.lat + 2 * u * t * mLat + t * t * opts.d.lat,
        lng: u * u * opts.pu.lng + 2 * u * t * mLng + t * t * opts.d.lng
      });
    }

    // Solid line, no dashes, no repeat icons
    g.rl = new google.maps.Polyline({
      path: cp, geodesic: false,
      strokeColor: '#007AFF', strokeOpacity: 0.6, strokeWeight: 4,
      map: g.map
    });
  } else if (opts && opts.pu && opts.pu.lat) {
    g.map.setCenter({ lat: opts.pu.lat, lng: opts.pu.lng }); g.map.setZoom(15);
  }
}

window.updateDriverOnMap = function() {
  try {
    if (typeof google === 'undefined' || !google.maps || !db || !arId) return;
    var ride = db.rides.find(function(ri) { return ri.id === arId; });
    if (!ride || !ride.driverId) return;
    if (ride.status === 'requested') return;

    var drv = db.users.find(function(u) { return u.id === ride.driverId; });
    if (!drv) return;

    var dlat = drv.lat ? parseFloat(drv.lat) : null;
    var dlng = drv.lng ? parseFloat(drv.lng) : null;

    // If no GPS yet, fetch directly from Supabase (one-shot, not a loop)
    if (!dlat || !dlng) {
      if (!window._drvFetchPending) {
        window._drvFetchPending = true;
        supaFetch('GET', 'users', '?id=eq.' + encodeURIComponent(ride.driverId)).then(function(res) {
          window._drvFetchPending = false;
          if (res && res[0] && res[0].lat && res[0].lng) {
            drv.lat = res[0].lat; drv.lng = res[0].lng;
          }
        }).catch(function() { window._drvFetchPending = false; });
      }
      return;
    }

    var mapEl = document.getElementById('w-map');
    if (!mapEl || mapEl.offsetHeight < 10) return;

    var mid = 'w-map';
    var g = _gm[mid];

    // Initialize map if needed
    if (!g || !g.map) {
      drawMap(mapEl, { pu: { lat: parseFloat(ride.puX), lng: parseFloat(ride.puY) } });
      g = _gm[mid];
      if (!g || !g.map) return;
    }

    // Enable full interactivity
    g.map.setOptions({ gestureHandling: 'greedy', zoomControl: true });

    // Hide service area polygon during active ride
    if (g.map._saPoly && g.map._saPoly.getMap()) g.map._saPoly.setMap(null);

    // Track user interaction - stop auto-panning if user touches the map
    if (!g._interactListeners) {
      g._userPanned = false;
      g._interactListeners = true;
      google.maps.event.addListener(g.map, 'dragstart', function() { g._userPanned = true; });
      google.maps.event.addListener(g.map, 'pinchstart', function() { g._userPanned = true; });
    }

    // Create or SMOOTHLY move driver car marker (no route line)
    if (!g.drvMk) {
      g.drvMk = new google.maps.Marker({
        position: { lat: dlat, lng: dlng },
        map: g.map,
        icon: {
          url: DRIVER_ICON_URL,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20)
        },
        zIndex: 999, title: 'Your Driver'
      });
    } else {
      // Smooth animation to new position
      var oldPos = g.drvMk.getPosition();
      var newPos = new google.maps.LatLng(dlat, dlng);
      if (oldPos.lat() !== dlat || oldPos.lng() !== dlng) {
        _animateMarker(g.drvMk, oldPos, newPos, 800);
      }
    }

    // Ensure pickup marker
    var puLat = parseFloat(ride.puX), puLng = parseFloat(ride.puY);
    var doLat = parseFloat(ride.doX), doLng = parseFloat(ride.doY);

    if (!g._puMk && puLat && puLng) {
      g._puMk = new google.maps.Marker({
        position: { lat: puLat, lng: puLng }, map: g.map,
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#34c759', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5, scale: 8 },
        zIndex: 998
      });
    }

    // Ensure dropoff marker
    if (!g._doMk && doLat && doLng) {
      g._doMk = new google.maps.Marker({
        position: { lat: doLat, lng: doLng }, map: g.map,
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#ff453a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5, scale: 8 },
        zIndex: 997
      });
    }

    // Auto-follow only if user hasn't touched the map
    if (!g._userPanned) {
      var bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: dlat, lng: dlng });
      var dest = (ride.status === 'picked_up' && doLat && doLng)
        ? { lat: doLat, lng: doLng }
        : { lat: puLat, lng: puLng };
      if (dest.lat && dest.lng) bounds.extend(dest);
      g.map.fitBounds(bounds, { top: 80, bottom: 80, left: 60, right: 60 });
      if (g.map.getZoom() > 16) g.map.setZoom(16);
    }

    // NO route line from driver - driver takes whatever route they want

  } catch (e) { console.error('updateDriverOnMap:', e); }
}

// Smooth marker animation
function _animateMarker(marker, from, to, duration) {
  var start = Date.now();
  var fromLat = from.lat(), fromLng = from.lng();
  var toLat = to.lat(), toLng = to.lng();

  function step() {
    var elapsed = Date.now() - start;
    var t = Math.min(1, elapsed / duration);
    // Ease out cubic
    var ease = 1 - Math.pow(1 - t, 3);
    var lat = fromLat + (toLat - fromLat) * ease;
    var lng = fromLng + (toLng - fromLng) * ease;
    marker.setPosition({ lat: lat, lng: lng });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
