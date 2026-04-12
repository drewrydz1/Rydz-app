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
_watchId=navigator.geolocation.watchPosition(function(pos){
var now=Date.now();
if(now-_lastGPS<10000)return;
_lastGPS=now;
var la=pos.coords.latitude;
var ln=pos.coords.longitude;
var dd=gD();if(dd){dd.lat=la;dd.lng=ln;sv()}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:la,lng:ln});
_checkPickupGeofence(la,ln);
},function(err){console.log('Watch error:',err.message)},{enableHighAccuracy:true,maximumAge:5000,timeout:10000});
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
