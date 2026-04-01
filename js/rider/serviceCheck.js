// RYDZ Rider - Service Check

var _svcSettings=null;

function loadServiceSettings(){
fetch('https://ewnynyazfkcyqakyuzcd.supabase.co/rest/v1/settings?id=eq.1&select=announcement,service_hours,service_info',{
headers:{'apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c'}
}).then(function(r){return r.json()}).then(function(res){
if(res&&res.length>0){
_svcSettings=res[0];
if(res[0].service_info){
var hrsEl=document.getElementById('h-hrs');
if(hrsEl)hrsEl.textContent=res[0].service_info;
}
}
}).catch(function(){});
}
function checkServiceNow(){
if(!_svcSettings)return true;
var s=_svcSettings;
if(s.announcement){
try{var ann=JSON.parse(s.announcement);
if(ann.enabled&&ann.message){showToast(ann.message);return false}}catch(e){}}
if(s.service_hours){
try{var hrs=JSON.parse(s.service_hours);
var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var now=new Date();var day=days[now.getDay()];var h=hrs[day];
if(h&&!h.enabled){showToast('Rydz is not available on '+day+'s. Please check back during service hours.');return false}
if(h&&h.open&&h.close){
var nowMin=now.getHours()*60+now.getMinutes();
var op=h.open.split(':'),cl=h.close.split(':');
var openMin=parseInt(op[0])*60+parseInt(op[1]);
var closeMin=parseInt(cl[0])*60+parseInt(cl[1]);
if(closeMin<=openMin)closeMin+=1440;
if(nowMin<openMin||nowMin>=closeMin){
var oH=parseInt(op[0])%12||12,oAP=parseInt(op[0])>=12?'PM':'AM';
var cH=parseInt(cl[0])%12||12,cAP=parseInt(cl[0])>=12?'PM':'AM';
showToast('Rydz is currently closed. Hours for '+day+': '+oH+':'+op[1]+' '+oAP+' - '+cH+':'+cl[1]+' '+cAP);
return false}}}catch(e){}}
return true;
}
function formatTime(t){if(!t)return'';var p=t.split(':');var h=parseInt(p[0]);var m=p[1];var ampm=h>=12?'PM':'AM';h=h%12||12;return h+':'+m+' '+ampm}

setTimeout(loadServiceSettings,1000);
setInterval(loadServiceSettings,30000);

// Global overrides (loaded last)

// GLOBAL tryGo - loaded last, overrides hoisted functions
window.tryGo=function(){
try{
if(typeof puSel!=='undefined'&&puSel&&puSel.lat&&typeof isInArea==='function'&&!isInArea(puSel.lat,puSel.lng)){
if(typeof showToast==='function')showToast('Your pickup location is outside the Rydz service area.');return}
if(typeof doSel!=='undefined'&&doSel&&doSel.lat&&typeof isInArea==='function'&&!isInArea(doSel.lat,doSel.lng)){
if(typeof showToast==='function')showToast('Your drop-off location is outside the Rydz service area.');return}
if(typeof puSel!=='undefined'&&puSel&&typeof doSel!=='undefined'&&doSel&&puSel.n&&doSel.n&&puSel.n===doSel.n){
if(typeof showToast==='function')showToast('Pickup and drop-off cannot be the same location.');return}
fetch('https://ewnynyazfkcyqakyuzcd.supabase.co/rest/v1/settings?id=eq.1&select=announcement,service_hours,service_info',{
headers:{'apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c'}
}).then(function(r){return r.json()}).then(function(res){
var blocked=false;
if(res&&res[0]){var s=res[0];
if(s.announcement){try{var ann=JSON.parse(s.announcement);if(ann.enabled&&ann.message){showToast(ann.message);blocked=true}}catch(e){}}
if(!blocked&&s.service_hours){try{var hrs=JSON.parse(s.service_hours);
var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var est=new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
var day=days[est.getDay()];var h=hrs[day];
if(h&&!h.enabled){showToast('Rydz is not available on '+day+'s.');blocked=true}
else if(h&&h.open&&h.close){
var nm=est.getHours()*60+est.getMinutes();
var op=h.open.split(':'),cl=h.close.split(':');
var om=parseInt(op[0])*60+parseInt(op[1]),cm=parseInt(cl[0])*60+parseInt(cl[1]);
if(cm<=om)cm+=1440;
if(nm<om||nm>=cm){var oH=parseInt(op[0])%12||12,oAP=parseInt(op[0])>=12?'PM':'AM';var cH=parseInt(cl[0])%12||12,cAP=parseInt(cl[0])>=12?'PM':'AM';showToast('Rydz is closed. '+day+' hours: '+oH+':'+op[1]+' '+oAP+' - '+cH+':'+cl[1]+' '+cAP);blocked=true}
}}catch(e){}}}
if(!blocked&&typeof _tryGoOrig==='function')_tryGoOrig();
}).catch(function(){if(typeof _tryGoOrig==='function')_tryGoOrig()});
}catch(e){if(typeof _tryGoOrig==='function')_tryGoOrig()}};
window.reqRide=async function(){if(typeof _reqRideOrig==='function')return _reqRideOrig()};
