// RYDZ Driver - Location Services
// GPS tracking, Google Maps integration

var _watchId = null;
var _lastGPS = 0;

// Haversine distance in meters
function _distMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function(d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ---------------------------------------------------------------------------
// MapKit ETA publisher — same as the native driver copy. No-ops on web
// (window.Capacitor absent). See driver-native/www/js/driver/location.js for
// the full rationale.
// ---------------------------------------------------------------------------
var _lastETAPublish = 0;
var ETA_PUBLISH_MIN_MS = 1500;

function _publishMapKitETA(fromLat, fromLng) {
  try {
    var now = Date.now();
    if (now - _lastETAPublish < ETA_PUBLISH_MIN_MS) return;
    if (typeof gMR !== 'function') return;
    var mr = gMR();
    if (!mr || !mr.id) return;
    var st = mr.status;
    if (!st || st === 'completed' || st === 'canceled' || st === 'cancelled') return;

    var toLat, toLng;
    if (st === 'picked_up' || st === 'in_progress') {
      toLat = parseFloat(mr.doX); toLng = parseFloat(mr.doY);
    } else if (st === 'arrived') {
      _lastETAPublish = now;
      try {
        supaFetch('PATCH', 'rides', '?id=eq.' + encodeURIComponent(mr.id), {
          driver_eta_secs: 0,
          driver_eta_updated_at: new Date().toISOString()
        });
      } catch (e) {}
      return;
    } else {
      toLat = parseFloat(mr.puX); toLng = parseFloat(mr.puY);
    }
    if (!toLat || !toLng) return;

    if (!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RydzMapKit)) return;

    _lastETAPublish = now;
    window.Capacitor.Plugins.RydzMapKit.calculateETA({
      fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng
    }).then(function(res) {
      if (!res || typeof res.seconds !== 'number') return;
      var secs = Math.max(0, Math.round(res.seconds));
      try {
        supaFetch('PATCH', 'rides', '?id=eq.' + encodeURIComponent(mr.id), {
          driver_eta_secs: secs,
          driver_eta_updated_at: new Date().toISOString()
        });
      } catch (e) {}
    }).catch(function(err) {
      console.log('[MapKit] ETA calc failed:', err && err.message);
    });
  } catch (e) {}
}

// 500 ft ≈ 152 m - auto-flip ride to 'arrived' when driver is near pickup.
// Webhook fires 'Driver is nearby' push to rider.
function _checkPickupGeofence(lat, lng) {
  try {
    if (typeof gMR !== 'function') return;
    var mr = gMR();
    if (!mr || mr.status !== 'accepted') return;
    var puLat = parseFloat(mr.puX), puLng = parseFloat(mr.puY);
    if (!puLat || !puLng) return;
    var already = localStorage.getItem('rydz-nearby-' + mr.id);
    if (already === '1') return;
    var d = _distMeters(lat, lng, puLat, puLng);
    if (d <= 152) {
      localStorage.setItem('rydz-nearby-' + mr.id, '1');
      mr.status = 'arrived';
      if (typeof sv === 'function') { try { sv(); } catch (e) {} }
      if (typeof supaUpdateRide === 'function') { try { supaUpdateRide(mr.id, { status: 'arrived' }); } catch (e) {} }
      if (typeof ren === 'function') { try { ren(); } catch (e) {} }
    }
  } catch (e) {}
}

function startGPS(){
if(!navigator.geolocation){if(typeof showToast==='function')showToast('Location services not available.');return}
if(_watchId!==null)return;
navigator.geolocation.getCurrentPosition(
function(firstPos){
var lat=firstPos.coords.latitude;
var lng=firstPos.coords.longitude;
var d=gD();if(d){d.lat=lat;d.lng=lng;sv()}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:lat,lng:lng});
_checkPickupGeofence(lat,lng);
_publishMapKitETA(lat,lng);
_watchId=navigator.geolocation.watchPosition(function(pos){
var now=Date.now();
if(now-_lastGPS<1500)return;
_lastGPS=now;
var la=pos.coords.latitude;
var ln=pos.coords.longitude;
var dd=gD();if(dd){dd.lat=la;dd.lng=ln;sv()}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:la,lng:ln});
_checkPickupGeofence(la,ln);
_publishMapKitETA(la,ln);
},function(err){console.log('Watch error:',err.message)},{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
},
function(err){
if(err.code===1){
if(typeof showToast==='function')showToast('Location permission denied. Please enable Location Services in your phone Settings for this site.');
}else{
if(typeof showToast==='function')showToast('Could not get your location. Please try again.');
}
},
{enableHighAccuracy:true,timeout:10000}
);
}
function stopGPS(){
if(_watchId!==null){navigator.geolocation.clearWatch(_watchId);_watchId=null}
var d=gD();
if(d){d.lat=null;d.lng=null}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:null,lng:null});
}

// Google Maps is loaded via <script> tag in driver.html (same as admin.html)
