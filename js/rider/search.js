// RYDZ Rider - Search & Places Autocomplete

window.isInArea=function(lat,lng){
if(lat<26.087||lat>26.178||lng<-81.823||lng>-81.774)return false;
if(google.maps.geometry){try{return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat,lng),new google.maps.Polygon({paths:SVC}))}catch(e){}}
return true;
}
window.onTyp=function(k){
var inp=document.getElementById(k==='pu'?'f-pu':'f-do');
var fd=document.getElementById(k==='pu'?'pu-fd':'do-fd');
var acl=document.getElementById(k==='pu'?'ac-pu':'ac-do');
fd.classList.toggle('hv',inp.value.length>0);
fd.classList.remove('valid');
if(k==='pu')puSel=null;else doSel=null;
chkBtn();
var q=inp.value.trim();
if(q.length<2){if(acl)acl.classList.remove('show');return}
if(typeof google!=='undefined'&&google.maps&&google.maps.places){
if(!window._acs)window._acs=new google.maps.places.AutocompleteService();
window._acs.getPlacePredictions({
input:q,
locationBias:new google.maps.Circle({center:{lat:26.1334,lng:-81.7935},radius:15000}),
componentRestrictions:{country:'us'}
},function(predictions,status){
if(status!=='OK'||!predictions||!predictions.length){if(acl)acl.classList.remove('show');return}
acl.innerHTML=predictions.slice(0,5).map(function(p,i){
var main=p.structured_formatting?p.structured_formatting.main_text:p.description;
var sec=p.structured_formatting?p.structured_formatting.secondary_text:'';
return'<div class="ac-i" data-pid="'+p.place_id+'" data-k="'+k+'" data-idx="'+i+'" onclick="selPlace(this)" style="display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--g100)"><div style="width:32px;height:32px;border-radius:50%;background:var(--g100);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" fill="none" stroke="var(--g500)" stroke-width="2"><path d="M10 5.5c0 3-3 5-3 5s-3-2-3-5a3 3 0 016 0z"/><circle cx="7" cy="5.5" r="1"/></svg></div><div style="min-width:0"><div style="font-size:14px;font-weight:600;color:var(--g800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+main+'</div>'+(sec?'<div style="font-size:12px;color:var(--g400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--font2)">'+sec+'</div>':'')+'</div></div>'
}).join('');
acl.classList.add('show');
})}
}
window.clr=function(k){
var inp=document.getElementById(k==='pu'?'f-pu':'f-do');
var fd=document.getElementById(k==='pu'?'pu-fd':'do-fd');
var acl=document.getElementById(k==='pu'?'ac-pu':'ac-do');
inp.value='';fd.classList.remove('hv','valid');
if(acl)acl.classList.remove('show');
if(k==='pu')puSel=null;else doSel=null;
chkBtn();inp.focus();
}
window.sel=function(){}
window.selPlace=function(el){
var pid=el.dataset.pid;
var k=el.dataset.k;
var inp=document.getElementById(k==='pu'?'f-pu':'f-do');
var fd=document.getElementById(k==='pu'?'pu-fd':'do-fd');
var acl=document.getElementById(k==='pu'?'ac-pu':'ac-do');
acl.classList.remove('show');
if(!window._plSvc){var div=document.createElement('div');window._plSvc=new google.maps.places.PlacesService(div)}
window._plSvc.getDetails({placeId:pid,fields:['name','formatted_address','geometry']},function(place,status){
if(status!=='OK'||!place||!place.geometry)return;
var loc=place.geometry.location;
var name=place.name||place.formatted_address||inp.value;
inp.value=name;
var obj={n:name,a:place.formatted_address||name,x:0,y:0,lat:loc.lat(),lng:loc.lng()};
if(k==='pu'){puSel=obj}else{doSel=obj}
fd.classList.add('hv','valid');
chkBtn();
})}
window.chkBtn=function(){var b=document.getElementById('h-btn'),ok=puSel&&doSel&&db&&db.settings.serviceStatus;b.disabled=!ok;b.textContent=ok?'Continue':(!puSel&&!doSel?'Select pickup & drop-off to continue':!puSel?'Select a pickup location':'Select a drop-off location')}

window.showToast=function(msg){
var ov=document.getElementById('sa-ov');if(ov)ov.remove();
var md=document.getElementById('sa-md');if(md)md.remove();
ov=document.createElement('div');ov.id='sa-ov';
ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:99998;animation:fi .2s ease';
md=document.createElement('div');md.id='sa-md';
md.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:28px 24px;border-radius:20px;font-size:15px;font-weight:600;font-family:Poppins,sans-serif;z-index:99999;box-shadow:0 16px 50px rgba(0,0,0,.25);max-width:300px;text-align:center;line-height:1.5;animation:fi .25s ease';
var icon='<div style="width:48px;height:48px;border-radius:50%;background:#ffe5e5;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><svg width="22" height="22" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="9"/><path d="M11 7v5M11 14.5h.01"/></svg></div>';
md.innerHTML=icon+'<p style="margin-bottom:16px;color:#1d1d1f">'+msg+'</p><button id="sa-btn" style="width:100%;padding:13px;background:#007AFF;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Poppins,sans-serif">Got it</button>';
ov.onclick=function(){ov.remove();md.remove()};
document.body.appendChild(ov);document.body.appendChild(md);
document.getElementById('sa-btn').onclick=function(){document.getElementById('sa-ov').remove();document.getElementById('sa-md').remove()};
}
