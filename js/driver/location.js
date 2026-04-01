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

// Google Maps Enhancement

// === GOOGLE MAPS ENHANCEMENT (driver) ===
(function(){
var GK='AIzaSyDvV2iMkLWP5twK_EyLC4L-Hjnp1Xsrkdw';
var NC={lat:26.1334,lng:-81.7935};
var SA=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var sc=document.createElement('script');
sc.src='https://maps.googleapis.com/maps/api/js?key='+GK+'&libraries=places,geometry&callback=_gmInitD';
sc.async=true;sc.defer=true;
sc.onerror=function(){};
window._gmInitD=function(){
// Google Maps Places library now ready.
// Autocomplete is bound dynamically in _crInitAutocomplete() when dispatch form opens.
};
setTimeout(function(){try{document.head.appendChild(sc)}catch(e){}},1500);
})();
