// RYDZ Rider - Maps v3
// Solid route line, car icon for driver, no driver route, full interactivity

var SVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var NC={lat:26.1334,lng:-81.7935};
var MS=[{elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{elementType:'labels.text.fill',stylers:[{color:'#9e9e9e'}]},{elementType:'labels.text.stroke',stylers:[{color:'#ffffff'}]},{featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#ebebeb'}]},{featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#b0b0b0'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#eeeeee'}]},{featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'road.arterial',elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{featureType:'road.local',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#dce8f2'}]},{featureType:'water',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'landscape',elementType:'geometry.fill',stylers:[{color:'#f0f1f4'}]}];
var _gm={};

// Car icon SVG path (top-down vehicle silhouette)
var CAR_ICON_PATH = 'M12 2C9.5 2 7.5 3.2 7 5L5 11v7c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h8v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-7l-2-6c-.5-1.8-2.5-3-5-3zM7.5 14c-.8 0-1.5-.7-1.5-1.5S6.7 11 7.5 11s1.5.7 1.5 1.5S8.3 14 7.5 14zm9 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM7.5 9l1.5-4.5h6L16.5 9h-9z';

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
          path: CAR_ICON_PATH,
          fillColor: '#007AFF', fillOpacity: 1,
          strokeColor: '#fff', strokeWeight: 1.5,
          scale: 1.2, anchor: new google.maps.Point(12, 12)
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
