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

// --- Auto sign-out at 5am America/New_York ---
// Uses login timestamp in localStorage (NOT sessionStorage) so the app survives
// iOS WebView memory eviction. Only explicit logout, disabled account, or
// crossing 5am ET signs the driver out.
function _last5amET(){
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(now);
  var y=parts.find(function(p){return p.type==='year'}).value;
  var m=parts.find(function(p){return p.type==='month'}).value;
  var d=parts.find(function(p){return p.type==='day'}).value;
  var h=parseInt(parts.find(function(p){return p.type==='hour'}).value,10);
  var dateStr;
  if(h<5){
    var prev=new Date(y+'-'+m+'-'+d+'T12:00:00Z');
    prev.setUTCDate(prev.getUTCDate()-1);
    dateStr=prev.getUTCFullYear()+'-'+String(prev.getUTCMonth()+1).padStart(2,'0')+'-'+String(prev.getUTCDate()).padStart(2,'0');
  }else{
    dateStr=y+'-'+m+'-'+d;
  }
  // Resolve DST by checking which UTC offset lands on 05:00 ET
  var guess=new Date(dateStr+'T05:00:00-05:00');
  var gh=parseInt(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(guess),10);
  if(gh===5)return guess.getTime();
  return new Date(dateStr+'T05:00:00-04:00').getTime();
}
function _fire5amLogout(){
  // If the driver is mid-ride, defer logout by 1 minute so we don't kick them
  // off while carrying a passenger.
  var active=(typeof gMR==='function')?gMR():null;
  if(active){setTimeout(_fire5amLogout,60000);return}
  if(typeof doLogout==='function')doLogout();
}
var _logoutTimer=null;
function _scheduleNext5amLogout(){
  if(_logoutTimer){try{clearTimeout(_logoutTimer)}catch(e){}}
  var now=Date.now();
  var next5=_last5amET()+24*60*60*1000;
  var nh=parseInt(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(new Date(next5)),10);
  if(nh===4)next5+=60*60*1000; // fall-back DST day (25h)
  if(nh===6)next5-=60*60*1000; // spring-forward DST day (23h)
  var delay=next5-now;
  if(delay<60000)delay=60000;
  _logoutTimer=setTimeout(_fire5amLogout,delay);
}

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
// Auto sign-out at 5am America/New_York: if the current session began before
// the most recent 5am boundary, expire it. iOS WebView eviction no longer logs
// the driver out — only explicit logout or crossing 5am ET.
var _loginTs=parseInt(localStorage.getItem('rydz-drv-login-ts')||'0',10);
if(_loginTs&&_loginTs<_last5amET()){
localStorage.removeItem('rydz-drv-id');
localStorage.removeItem('rydz-drv-name');
localStorage.removeItem('rydz-drv-login-ts');
localStorage.setItem('rydz-drv-online','false');
}
var _sid=localStorage.getItem('rydz-drv-id');if(_sid){DID=_sid;if(db){var _sd=gD();if(_sd&&!_sd.disabled){document.getElementById('h-nm').textContent=_sd.name;document.getElementById('h-av').textContent=(_sd.name||'D')[0];document.getElementById('h-vc').textContent=_sd.vehicle||'';setInterval(poll,5000);setTimeout(supaSync,2000);setInterval(supaSync,5000);if(localStorage.getItem('rydz-drv-online')==='true'){startGPS()}_scheduleNext5amLogout();go('main');ren();return}}else{setInterval(poll,5000);setTimeout(supaSync,2000);setInterval(supaSync,5000);if(localStorage.getItem('rydz-drv-online')==='true'){startGPS()}_scheduleNext5amLogout();go('main');supaSync();setTimeout(ren,2000);return}}go('login');
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
