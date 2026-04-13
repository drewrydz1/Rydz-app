// RYDZ Driver - Initialization
// Startup sequence, polling loop

// Block double-tap zoom and pinch zoom on iOS Safari
(function(){
  var lastTap=0;
  document.addEventListener('touchstart',function(e){
    if(e.touches.length>1){e.preventDefault()}
  },{passive:false});
  document.addEventListener('touchend',function(e){
    var now=Date.now();
    if(now-lastTap<300){e.preventDefault()}
    lastTap=now;
  },{passive:false});
  document.addEventListener('gesturestart',function(e){e.preventDefault()},{passive:false});
  document.addEventListener('gesturechange',function(e){e.preventDefault()},{passive:false});
  document.addEventListener('gestureend',function(e){e.preventDefault()},{passive:false});
})();

async function poll(){


var f=await ld();
if(f){
db=f;
var isOn=localStorage.getItem('rydz-drv-online')==='true';
var dd=gD();if(dd)dd.status=isOn?'online':'offline';
if(cur==='main')ren();
if(typeof checkPendingRides==='function'){try{checkPendingRides()}catch(e){}}
}
}
async function init(){
db=await ld();
if(!db){db=ddb();await sv()}
if(db&&db.rides){db.rides=db.rides.filter(function(r){return r.status!=='completed'&&r.status!=='cancelled'});try{localStorage.setItem('rydz-db',JSON.stringify(db))}catch(e){}}
if(!localStorage.getItem('rydz-drv-online')){localStorage.setItem('rydz-drv-online','false')}
// Force sign-in if app was force-closed (sessionStorage is cleared on termination)
var _activeSession=sessionStorage.getItem('rydz-drv-active');
if(!_activeSession){
localStorage.removeItem('rydz-drv-id');
localStorage.removeItem('rydz-drv-name');
localStorage.setItem('rydz-drv-online','false');
}
var _sid=localStorage.getItem('rydz-drv-id');if(_sid){DID=_sid;if(db){var _sd=gD();if(_sd&&!_sd.disabled){document.getElementById('h-nm').textContent=_sd.name;document.getElementById('h-av').textContent=(_sd.name||'D')[0];document.getElementById('h-vc').textContent=_sd.vehicle||'';setInterval(poll,5000);setTimeout(supaSync,2000);setInterval(supaSync,5000);if(localStorage.getItem('rydz-drv-online')==='true'){startGPS()}go('main');ren();return}}else{setInterval(poll,5000);setTimeout(supaSync,2000);setInterval(supaSync,5000);if(localStorage.getItem('rydz-drv-online')==='true'){startGPS()}go('main');supaSync();setTimeout(ren,2000);return}}go('login');
setInterval(poll,5000);
setTimeout(supaSync,2000);
setInterval(supaSync,5000);if(localStorage.getItem('rydz-drv-online')==='true'){startGPS()}
}

// Apply logos
document.querySelectorAll('.logo-img').forEach(function(img){
  img.src = img.style.height === '32px' ? LOGO_SM : LOGO_LG;
});

// Request location permission on app start
if(typeof requestLocationPermission==='function'){requestLocationPermission()}

// Boot
try{init()}catch(e){console.error('init crash:',e);document.getElementById('s-load').classList.remove('on');var lg=document.getElementById('s-login');if(lg)lg.classList.add('on')}
setTimeout(function(){var ls=document.getElementById('s-load');if(ls&&ls.classList.contains('on')){ls.classList.remove('on');var lg=document.getElementById('s-login');if(lg)lg.classList.add('on')}},3000);
