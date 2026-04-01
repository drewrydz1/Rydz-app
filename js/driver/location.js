// RYDZ Driver - Location Services
// GPS tracking, Google Maps integration

var _watchId = null;
var _lastGPS = 0;

function startGPS(){
if(!navigator.geolocation){if(typeof showToast==='function')showToast('Location services not available.');return}
if(_watchId!==null)return;
navigator.geolocation.getCurrentPosition(
function(firstPos){
var lat=firstPos.coords.latitude;
var lng=firstPos.coords.longitude;
var d=gD();if(d){d.lat=lat;d.lng=lng;sv()}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:lat,lng:lng});
_watchId=navigator.geolocation.watchPosition(function(pos){
var now=Date.now();
if(now-_lastGPS<5000)return;
_lastGPS=now;
var la=pos.coords.latitude;
var ln=pos.coords.longitude;
var dd=gD();if(dd){dd.lat=la;dd.lng=ln;sv()}
supaFetch('PATCH','users','?id=eq.'+encodeURIComponent(DID),{lat:la,lng:ln});
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
