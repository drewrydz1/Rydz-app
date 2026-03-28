// RYDZ Rider - Search & Places Autocomplete
// Naples-focused, modern dropdown UI

window.isInArea=function(lat,lng){
if(lat<26.087||lat>26.178||lng<-81.823||lng>-81.774)return false;
if(google.maps.geometry){try{return google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat,lng),new google.maps.Polygon({paths:SVC}))}catch(e){}}
return true;
}

// Naples bounds for strict location bias
var _naplesBounds = null;
function getNaplesBounds() {
  if (!_naplesBounds && typeof google !== 'undefined' && google.maps) {
    _naplesBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(26.08, -81.83),
      new google.maps.LatLng(26.22, -81.74)
    );
  }
  return _naplesBounds;
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

var opts = {
  input: q,
  componentRestrictions: { country: 'us' },
  locationRestriction: getNaplesBounds()
};

// If locationRestriction not supported, fall back to locationBias
if (!opts.locationRestriction) {
  delete opts.locationRestriction;
  opts.locationBias = new google.maps.Circle({center:{lat:26.1334,lng:-81.7935},radius:12000});
}

window._acs.getPlacePredictions(opts, function(predictions, status){
if(status!=='OK'||!predictions||!predictions.length){if(acl)acl.classList.remove('show');return}

// Filter to Naples/Collier County area
var filtered = predictions.filter(function(p) {
  var desc = (p.description || '').toLowerCase();
  return desc.indexOf('naples') > -1 || desc.indexOf('collier') > -1 ||
         desc.indexOf('marco island') > -1 || desc.indexOf('bonita') > -1 ||
         desc.indexOf('fl') > -1;
});
if (!filtered.length) filtered = predictions;

var items = filtered.slice(0, 6);

var html = '';
items.forEach(function(p, i) {
  var main = p.structured_formatting ? p.structured_formatting.main_text : p.description;
  var sec = p.structured_formatting ? p.structured_formatting.secondary_text : '';
  // Clean up secondary text - remove ", USA" and state for cleaner look
  sec = sec.replace(/, USA$/,'').replace(/, United States$/,'');

  // Determine icon type
  var types = p.types || [];
  var isFood = types.indexOf('restaurant') > -1 || types.indexOf('food') > -1 || types.indexOf('cafe') > -1 || types.indexOf('bar') > -1;
  var isLodging = types.indexOf('lodging') > -1;
  var isShopping = types.indexOf('shopping_mall') > -1 || types.indexOf('store') > -1;

  var iconBg, iconSvg;
  if (isFood) {
    iconBg = '#FFF3E0'; iconSvg = '<path d="M7 2v6.5c0 .83.67 1.5 1.5 1.5h1v6h2v-6h1c.83 0 1.5-.67 1.5-1.5V2h-2v5h-1V2h-2v5h-1V2H7zM17 2v8h-2v6h2.5c.28 0 .5-.22.5-.5V2h-1z" fill="#F57C00"/>';
  } else if (isLodging) {
    iconBg = '#E8F5E9'; iconSvg = '<path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" fill="#43A047"/>';
  } else if (isShopping) {
    iconBg = '#F3E5F5'; iconSvg = '<path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 14H6V8h2v2h2V8h4v2h2V8h2v10z" fill="#8E24AA"/>';
  } else {
    iconBg = 'var(--blp)'; iconSvg = '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="var(--bl)"/>';
  }

  html += '<div class="ac-item" onclick="selPlace(this)" data-pid="'+p.place_id+'" data-k="'+k+'">' +
    '<div class="ac-icon" style="background:'+iconBg+'"><svg width="18" height="18" viewBox="0 0 24 24">'+iconSvg+'</svg></div>' +
    '<div class="ac-text"><div class="ac-main">'+esc(main)+'</div>' +
    (sec ? '<div class="ac-sub">'+esc(sec)+'</div>' : '') +
    '</div>' +
    '<svg class="ac-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g300)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
  '</div>';
});

acl.innerHTML = html;
// Position dropdown anchored below the ACTIVE text field
var fwEl = fd.closest('.fw');
var rect = fwEl ? fwEl.getBoundingClientRect() : fd.getBoundingClientRect();
acl.style.position = 'fixed';
acl.style.top = (rect.bottom + 6) + 'px';
acl.style.left = rect.left + 'px';
acl.style.width = rect.width + 'px';
acl.style.right = 'auto';
acl.style.transform = 'none';
acl.style.maxWidth = 'none';
acl.style.margin = '0';
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
