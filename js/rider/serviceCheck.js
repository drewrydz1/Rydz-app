// RYDZ Rider - Service Check

var _svcSettings=null;

// ── Toast/Popup for service announcements ──
window.showToast=function(msg){
if(!msg)return;
var existing=document.getElementById('rydz-popup-overlay');
if(existing)existing.remove();
var ov=document.createElement('div');
ov.id='rydz-popup-overlay';
ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .2s ease';
ov.innerHTML='<div style="background:#0F1F3A;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.4)">'
+'<div style="width:52px;height:52px;border-radius:50%;background:rgba(30,144,255,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px"><svg width="24" height="24" fill="none" stroke="#1E90FF" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>'
+'<h3 style="font-family:Poppins,sans-serif;font-size:17px;font-weight:700;color:#fff;margin-bottom:8px">Service Notice</h3>'
+'<p style="font-family:Nunito,sans-serif;font-size:14px;color:#8A96A8;line-height:1.6;margin-bottom:24px">'+msg.replace(/[<>]/g,function(c){return c==='<'?'&lt;':'&gt;'})+'</p>'
+'<button onclick="this.closest(\'#rydz-popup-overlay\').remove()" style="background:#1E90FF;color:#fff;border:none;border-radius:14px;padding:14px 32px;font-family:Poppins,sans-serif;font-size:15px;font-weight:700;cursor:pointer;width:100%;box-shadow:0 4px 14px rgba(30,144,255,.25)">Got it</button>'
+'</div>';
document.body.appendChild(ov);
ov.addEventListener('click',function(e){if(e.target===ov)ov.remove()});
};

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
showToast('Your pickup location is outside the Rydz service area.');return}
if(typeof doSel!=='undefined'&&doSel&&doSel.lat&&typeof isInArea==='function'&&!isInArea(doSel.lat,doSel.lng)){
showToast('Your drop-off location is outside the Rydz service area.');return}
if(typeof puSel!=='undefined'&&puSel&&typeof doSel!=='undefined'&&doSel&&puSel.n&&doSel.n&&puSel.n===doSel.n){
showToast('Pickup and drop-off cannot be the same location.');return}
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
window.reqRide=async function(){
// Fresh check for announcements/service hours before requesting ride
try{
var r=await fetch('https://ewnynyazfkcyqakyuzcd.supabase.co/rest/v1/settings?id=eq.1&select=announcement,service_hours',{
headers:{'apikey':'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnlueWF6ZmtjeXFha3l1emNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDQzNDIsImV4cCI6MjA4OTUyMDM0Mn0.Ns0do2aYhXfsi4SS_mfaJvuMy6caJNIYgUE_kxqkZ9c'}
});
var res=await r.json();
if(res&&res[0]){var s=res[0];
if(s.announcement){try{var ann=JSON.parse(s.announcement);if(ann.enabled&&ann.message){showToast(ann.message);return}}catch(e){}}
if(s.service_hours){try{var hrs=JSON.parse(s.service_hours);
var days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var est=new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
var day=days[est.getDay()];var h=hrs[day];
if(h&&!h.enabled){showToast('Rydz is not available on '+day+'s.');return}
if(h&&h.open&&h.close){
var nm=est.getHours()*60+est.getMinutes();
var op=h.open.split(':'),cl=h.close.split(':');
var om=parseInt(op[0])*60+parseInt(op[1]),cm=parseInt(cl[0])*60+parseInt(cl[1]);
if(cm<=om)cm+=1440;
if(nm<om||nm>=cm){var oH=parseInt(op[0])%12||12,oAP=parseInt(op[0])>=12?'PM':'AM';var cH=parseInt(cl[0])%12||12,cAP=parseInt(cl[0])>=12?'PM':'AM';showToast('Rydz is closed. '+day+' hours: '+oH+':'+op[1]+' '+oAP+' - '+cH+':'+cl[1]+' '+cAP);return}
}}catch(e){}}}
}catch(e){}
if(typeof _reqRideOrig==='function')return _reqRideOrig();
};
