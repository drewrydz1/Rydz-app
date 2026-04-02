// RYDZ Admin - Zones Page
// Manage service area zones (polygons on Google Maps)

var _zones=[];
var _zMap=null;
var _zPolys=[];
var _zDrawPts=[];
var _zDrawMks=[];
var _zDrawPoly=null;
var _zEditIdx=-1;

// Default Naples zone (uses SVC from config.js)
var _zDefaultZone={id:'naples-main',name:'Naples - Main Service Area',active:true,polygon:SVC,color:'#1E90FF',isDefault:true};

function initZonesPage(){
_loadZones();
}

function _loadZones(){
api('GET','settings','?id=eq.1&select=zones').then(function(res){
if(res&&res[0]&&res[0].zones){
try{_zones=typeof res[0].zones==='string'?JSON.parse(res[0].zones):res[0].zones}catch(e){_zones=[]}
}else{_zones=[]}
var hasDefault=false;
for(var i=0;i<_zones.length;i++){if(_zones[i].id==='naples-main'){hasDefault=true;break}}
if(!hasDefault){_zones.unshift(JSON.parse(JSON.stringify(_zDefaultZone)));_saveZones()}
_renderZones();
});
}

function _saveZones(){
return api('PATCH','settings','?id=eq.1',{zones:_zones}).then(function(r){
// Refresh admin dashboard map zones
if(typeof _drawAdminZones==='function'&&fmap)_drawAdminZones();
return r;
});
}

function _renderZones(){
var el=document.getElementById('zones-list');
if(!el)return;
var h='';
for(var i=0;i<_zones.length;i++){
var z=_zones[i];
var sc=z.active?'var(--gn)':'var(--tx3)';
var pts=z.polygon?z.polygon.length:0;
h+='<div class="z-card'+(z.active?'':' z-off')+'">';
h+='<div class="z-color" style="background:'+(z.color||'var(--bl)')+'"></div>';
h+='<div class="z-info"><div class="z-name">'+esc(z.name)+'</div>';
h+='<div class="z-meta"><span class="z-badge" style="background:'+sc+'22;color:'+sc+'">'+(z.active?'Active':'Inactive')+'</span>';
h+=' &middot; '+pts+' points</div></div>';
h+='<div class="z-acts">';
h+='<button class="btn-z" onclick="_zToggle('+i+')">'+(z.active?'Disable':'Enable')+'</button>';
h+='<button class="btn-z btn-z-p" onclick="_zEdit('+i+')">Edit</button>';
if(!z.isDefault)h+='<button class="btn-z btn-z-d" onclick="_zDelete('+i+')">Delete</button>';
h+='</div></div>';
}
el.innerHTML=h;
_renderZoneMap();
}

function _renderZoneMap(){
var el=document.getElementById('zones-map');
if(!el)return;
if(!_zMap){
_zMap=new google.maps.Map(el,{
center:NC,zoom:12.5,
disableDefaultUI:true,zoomControl:true,
styles:MS
});
}
// Clear old polys
for(var i=0;i<_zPolys.length;i++)_zPolys[i].setMap(null);
_zPolys=[];
// Draw each zone
for(var j=0;j<_zones.length;j++){
var z=_zones[j];
if(!z.polygon||!z.polygon.length)continue;
var col=z.color||'#1E90FF';
var p=new google.maps.Polygon({
paths:z.polygon,
strokeColor:col,strokeOpacity:z.active?0.9:0.3,strokeWeight:2,
fillColor:col,fillOpacity:z.active?0.15:0.05,
map:_zMap
});
_zPolys.push(p);
}
}

function _zToggle(i){
_zones[i].active=!_zones[i].active;
_saveZones().then(function(){_renderZones()});
}

function _zDelete(i){
if(_zones[i].isDefault)return;
if(!confirm('Delete zone "'+_zones[i].name+'"?'))return;
_zones.splice(i,1);
_saveZones().then(function(){_renderZones()});
}

function _zEdit(i){
_zEditIdx=i;
_openZoneModal(_zones[i]);
}

function _zAddNew(){
_zEditIdx=-1;
_openZoneModal(null);
}

function _openZoneModal(zone){
var ov=document.getElementById('z-mod-ov');
if(!ov)return;
ov.classList.add('on');
document.getElementById('z-mod-name').value=zone?zone.name:'';
document.getElementById('z-mod-color').value=zone&&zone.color?zone.color:'#1E90FF';
// Init drawing map
_zDrawPts=[];
_zDrawMks=[];
_zDrawPoly=null;
setTimeout(function(){
var mel=document.getElementById('z-mod-map');
if(!mel)return;
var dmap=new google.maps.Map(mel,{
center:NC,zoom:12.5,
disableDefaultUI:true,zoomControl:true,
styles:MS
});
window._zDMap=dmap;
// If editing, load existing polygon
if(zone&&zone.polygon&&zone.polygon.length>0){
for(var i=0;i<zone.polygon.length;i++){
var pt=zone.polygon[i];
// Skip closing point (same as first)
if(i===zone.polygon.length-1&&zone.polygon.length>2&&pt.lat===zone.polygon[0].lat&&pt.lng===zone.polygon[0].lng)continue;
_zDrawPts.push({lat:pt.lat,lng:pt.lng});
var mk=new google.maps.Marker({
position:{lat:pt.lat,lng:pt.lng},
map:dmap,
draggable:true,
icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:zone.color||'#1E90FF',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}
});
(function(idx,marker){
marker.addListener('dragend',function(){
_zDrawPts[idx]={lat:marker.getPosition().lat(),lng:marker.getPosition().lng()};
_zUpdateDrawPoly();
});
})(i,mk);
_zDrawMks.push(mk);
}
_zUpdateDrawPoly();
// Fit bounds
var bounds=new google.maps.LatLngBounds();
for(var k=0;k<_zDrawPts.length;k++)bounds.extend(_zDrawPts[k]);
dmap.fitBounds(bounds,40);
}
// Click to add points
dmap.addListener('click',function(e){
var pt={lat:e.latLng.lat(),lng:e.latLng.lng()};
_zDrawPts.push(pt);
var mk=new google.maps.Marker({
position:pt,
map:dmap,
draggable:true,
icon:{path:google.maps.SymbolPath.CIRCLE,scale:7,fillColor:document.getElementById('z-mod-color').value||'#1E90FF',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}
});
var idx=_zDrawMks.length;
mk.addListener('dragend',function(){
_zDrawPts[idx]={lat:mk.getPosition().lat(),lng:mk.getPosition().lng()};
_zUpdateDrawPoly();
});
_zDrawMks.push(mk);
_zUpdateDrawPoly();
});
document.getElementById('z-mod-status').textContent=_zDrawPts.length>0?_zDrawPts.length+' points':'Click the map to draw zone boundary';
},200);
}

function _zUpdateDrawPoly(){
if(_zDrawPoly)_zDrawPoly.setMap(null);
if(_zDrawPts.length<3){
document.getElementById('z-mod-status').textContent=_zDrawPts.length+' point'+((_zDrawPts.length!==1)?'s':'')+' — need at least 3';
return;
}
var col=document.getElementById('z-mod-color').value||'#1E90FF';
_zDrawPoly=new google.maps.Polygon({
paths:_zDrawPts,
strokeColor:col,strokeOpacity:0.9,strokeWeight:2,
fillColor:col,fillOpacity:0.2,
map:window._zDMap
});
document.getElementById('z-mod-status').textContent=_zDrawPts.length+' points';
}

function _zUndoPoint(){
if(_zDrawPts.length===0)return;
_zDrawPts.pop();
var mk=_zDrawMks.pop();
if(mk)mk.setMap(null);
_zUpdateDrawPoly();
if(_zDrawPts.length<3&&_zDrawPoly){_zDrawPoly.setMap(null);_zDrawPoly=null}
document.getElementById('z-mod-status').textContent=_zDrawPts.length>0?_zDrawPts.length+' point'+((_zDrawPts.length!==1)?'s':''):' Click the map to draw zone boundary';
}

function _zClearPoints(){
for(var i=0;i<_zDrawMks.length;i++)_zDrawMks[i].setMap(null);
_zDrawMks=[];_zDrawPts=[];
if(_zDrawPoly){_zDrawPoly.setMap(null);_zDrawPoly=null}
document.getElementById('z-mod-status').textContent='Click the map to draw zone boundary';
}

function _zSaveZone(){
var name=document.getElementById('z-mod-name').value.trim();
var color=document.getElementById('z-mod-color').value||'#1E90FF';
if(!name){alert('Please enter a zone name.');return}
if(_zDrawPts.length<3){alert('Please draw at least 3 points on the map.');return}
// Close polygon (add first point at end)
var poly=_zDrawPts.slice();
poly.push({lat:poly[0].lat,lng:poly[0].lng});

if(_zEditIdx>=0){
// Editing existing
_zones[_zEditIdx].name=name;
_zones[_zEditIdx].color=color;
_zones[_zEditIdx].polygon=poly;
}else{
// New zone
_zones.push({
id:'zone-'+Date.now(),
name:name,
active:true,
polygon:poly,
color:color,
isDefault:false
});
}
_saveZones().then(function(){
_closeZoneModal();
_renderZones();
});
}

function _closeZoneModal(){
var ov=document.getElementById('z-mod-ov');
if(ov)ov.classList.remove('on');
// Cleanup
for(var i=0;i<_zDrawMks.length;i++)_zDrawMks[i].setMap(null);
_zDrawMks=[];_zDrawPts=[];
if(_zDrawPoly){_zDrawPoly.setMap(null);_zDrawPoly=null}
window._zDMap=null;
_zEditIdx=-1;
}

// ============================================================
// GLOBAL ZONE CHECK — used by all apps
// Returns true if lat/lng is in ANY active zone
// ============================================================
function _zoneCheckPoint(lat,lng,zones){
if(!zones||!zones.length)return true;
for(var i=0;i<zones.length;i++){
var z=zones[i];
if(!z.active||!z.polygon||z.polygon.length<3)continue;
if(typeof google!=='undefined'&&google.maps&&google.maps.geometry){
try{
if(google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat,lng),new google.maps.Polygon({paths:z.polygon})))return true;
}catch(e){}
}
}
return false;
}
