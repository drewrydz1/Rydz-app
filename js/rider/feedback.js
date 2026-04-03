// RYDZ Rider - Feedback & Rating

var rideRating=0;

window.updComplete=function(){
try{
if(!arId){arId=localStorage.getItem('rydz-active-ride');if(!arId)return}
var ride=db?db.rides.find(function(r){return r.id===arId}):null;
if(!ride){
var cppu=document.getElementById('cp-pu');if(cppu)cppu.textContent='Ride completed';
return;
}
var puEl=document.getElementById('cp-pu');if(puEl)puEl.textContent=ride.pickup||'';
var doEl=document.getElementById('cp-do');if(doEl)doEl.textContent=ride.dropoff||'';
var stEl=document.getElementById('stars');
if(stEl){stEl.innerHTML='';for(var si=1;si<=5;si++){stEl.innerHTML+='<div style="cursor:pointer;padding:4px" onclick="setRate('+si+')"><svg width="36" height="36" viewBox="0 0 24 24" fill="'+(si<=rideRating?'#ff9f0a':'none')+'" stroke="#ff9f0a" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div>'}}
if(ride.driverId&&db){var drv=db.users.find(function(u){return u.id===ride.driverId});if(drv){var di=document.getElementById('cp-di');if(di)di.textContent=(drv.name||'D')[0];var dn=document.getElementById('cp-dn');if(dn)dn.textContent=drv.name||'Driver';var dv=document.getElementById('cp-dv');if(dv)dv.textContent=((drv.vehicle||'')+' '+(drv.plate||'')).trim()}}
}catch(e){console.log('updComplete error:',e)}
}
window.setRate=function(n){rideRating=n;updComplete()}
window.finishRide=async function(){
try{
var ride=arId?db.rides.find(function(r){return r.id===arId}):null;
if(ride){
var fb=(document.getElementById('cp-feedback')||{}).value||'';
var updates={status:'completed',completed_at:new Date().toISOString()};
if(rideRating)updates.rating=rideRating;
if(fb)updates.feedback=fb;
fetch(SUPA_URL+'/rest/v1/rides?id=eq.'+encodeURIComponent(ride.id),{method:'PATCH',headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(updates)}).catch(function(){});
}
if(typeof stopETAUpdates==='function')stopETAUpdates();
localStorage.removeItem('rydz-active-ride');
arId=null;rideRating=0;
puSel=null;doSel=null;pass=1;
var fpu=document.getElementById('f-pu');if(fpu)fpu.value='';
var fdo=document.getElementById('f-do');if(fdo)fdo.value='';
var pufd=document.getElementById('pu-fd');if(pufd)pufd.classList.remove('hv','valid');
var dofd=document.getElementById('do-fd');if(dofd)dofd.classList.remove('hv','valid');
go('home');
}catch(e2){go('home')}}
