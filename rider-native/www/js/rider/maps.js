// RYDZ Rider - Maps v3
// Solid route line, car icon for driver, no driver route, full interactivity

var SVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var NC={lat:26.1334,lng:-81.7935};
var MS=[{elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{elementType:'labels.text.fill',stylers:[{color:'#9e9e9e'}]},{elementType:'labels.text.stroke',stylers:[{color:'#ffffff'}]},{featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#ebebeb'}]},{featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#b0b0b0'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#eeeeee'}]},{featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'road.arterial',elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{featureType:'road.local',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#dce8f2'}]},{featureType:'water',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'landscape',elementType:'geometry.fill',stylers:[{color:'#f0f1f4'}]}];
var _gm={};
window._gm=_gm;

// Clear all overlays (markers, route line) from a map instance
window.clearMapOverlays = function(mid) {
  var g = _gm[mid];
  if (!g) return;
  if (g.mk) { g.mk.forEach(function(m) { m.setMap(null); }); g.mk = []; }
  if (g.rl) { g.rl.setMap(null); g.rl = null; }
  if (g.drvMk) { g.drvMk.setMap(null); g.drvMk = null; }
  if (g._puMk) { g._puMk.setMap(null); g._puMk = null; }
  if (g._doMk) { g._doMk.setMap(null); g._doMk = null; }
  g._initialCentered = false;
};

// Draw all active zone polygons on a map instance
function _drawZonePolys(mid){
  var g=_gm[mid];if(!g)return;
  // Remove old zone polys (keep index 0 = default SVC)
  if(g.map._saPolys){
    for(var i=1;i<g.map._saPolys.length;i++){
      g.map._saPolys[i].setMap(null);
    }
  }
  g.map._saPolys=[g.map._saPoly];
  // Load zones from Supabase
  fetch(SUPA_URL+'/rest/v1/settings?id=eq.1&select=zones',{
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
  }).then(function(r){return r.json()}).then(function(res){
    if(!res||!res[0]||!res[0].zones)return;
    var zones=typeof res[0].zones==='string'?JSON.parse(res[0].zones):res[0].zones;
    if(!zones||!zones.length)return;
    // Hide default SVC poly — zones replace it
    if(g.map._saPoly)g.map._saPoly.setMap(null);
    g.map._saPolys=[];
    for(var j=0;j<zones.length;j++){
      var z=zones[j];
      if(!z.active||!z.polygon||z.polygon.length<3)continue;
      var col=z.color||'#007AFF';
      var p=new google.maps.Polygon({
        paths:z.polygon,strokeColor:col,strokeOpacity:0.55,strokeWeight:2.5,
        fillColor:col,fillOpacity:0.05,map:g.map,clickable:false
      });
      g.map._saPolys.push(p);
    }
  }).catch(function(){});
}

// Driver shuttle icon (base64 PNG)
var DRIVER_ICON_URL = 'data:image/png;base64,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';

window.drawMap = function(el, opts) {
  if (!el || typeof google === 'undefined' || !google.maps) return;
  var mid = el.id || 'm';

  if (!_gm[mid]) {
    _gm[mid] = {
      map: new google.maps.Map(el, {
        center: NC, zoom: 11.8,
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
    _gm[mid].map._saPolys = [_gm[mid].map._saPoly];
    // Load dynamic zones and draw them
    _drawZonePolys(mid);
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

    // Hide service area polygons during active ride
    if(g.map._saPolys){for(var pi=0;pi<g.map._saPolys.length;pi++){if(g.map._saPolys[pi].getMap())g.map._saPolys[pi].setMap(null)}}
    else if(g.map._saPoly&&g.map._saPoly.getMap())g.map._saPoly.setMap(null);

    // First time seeing driver: center map once, then never again
    if (!g._initialCentered) {
      g._initialCentered = true;
      var puLat = parseFloat(ride.puX), puLng = parseFloat(ride.puY);
      if (puLat && puLng) {
        var bnds = new google.maps.LatLngBounds();
        bnds.extend({ lat: dlat, lng: dlng });
        bnds.extend({ lat: puLat, lng: puLng });
        g.map.fitBounds(bnds, { top: 80, bottom: 80, left: 60, right: 60 });
        if (g.map.getZoom() > 16) g.map.setZoom(16);
      }
    }

    // Create or SMOOTHLY move driver car marker (no route line)
    if (!g.drvMk) {
      g.drvMk = new google.maps.Marker({
        position: { lat: dlat, lng: dlng },
        map: g.map,
        icon: {
          url: DRIVER_ICON_URL,
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14)
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

    // Map is free - rider controls zoom and pan

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
