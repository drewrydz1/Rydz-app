// RYDZ Rider - Maps & Service Area

// Service area polygon
var SVC=[{lat:26.17319345750562,lng:-81.81783943525166},{lat:26.093442909425136,lng:-81.80448104553827},{lat:26.092372283380186,lng:-81.80077692007605},{lat:26.09926039070288,lng:-81.78703595420656},{lat:26.104399080347548,lng:-81.78643988281546},{lat:26.115518792417305,lng:-81.78735693740616},{lat:26.126509216803697,lng:-81.77854499304347},{lat:26.138794565452926,lng:-81.77869523447562},{lat:26.142762589023363,lng:-81.7848211566605},{lat:26.169933772476142,lng:-81.78606141667692},{lat:26.171154572849133,lng:-81.79207471929068},{lat:26.17319345750562,lng:-81.81783943525166}];
var NC=NC={lat:26.1334,lng:-81.7935};
var MS=[{elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{elementType:'labels.text.fill',stylers:[{color:'#9e9e9e'}]},{elementType:'labels.text.stroke',stylers:[{color:'#ffffff'}]},{featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#ebebeb'}]},{featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#b0b0b0'}]},{featureType:'road.highway',elementType:'geometry',stylers:[{color:'#eeeeee'}]},{featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#e0e0e0'}]},{featureType:'road.arterial',elementType:'geometry',stylers:[{color:'#f5f5f5'}]},{featureType:'road.local',elementType:'geometry',stylers:[{color:'#ffffff'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#dce8f2'}]},{featureType:'water',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'landscape',elementType:'geometry.fill',stylers:[{color:'#f0f1f4'}]}];
var _gm={};

// Service area check

window.drawMap=function(el,opts){
if(!el||typeof google==='undefined'||!google.maps){if(typeof _origDraw==='function')_origDraw(el,opts);else if(typeof window._origDraw==='function')window._origDraw(el,opts);return}
var mid=el.id||'m';
if(!_gm[mid]){
_gm[mid]={map:new google.maps.Map(el,{center:NC,zoom:12.8,disableDefaultUI:true,zoomControl:false,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'greedy',styles:MS}),mk:[],rl:null};
_gm[mid].map._saPoly=new google.maps.Polygon({paths:SVC,strokeColor:'#007AFF',strokeOpacity:0.55,strokeWeight:2.5,fillColor:'#007AFF',fillOpacity:0.05,map:_gm[mid].map,clickable:false});
}
var g=_gm[mid];
g.mk.forEach(function(m){m.setMap(null)});g.mk=[];
if(g.rl){g.rl.setMap(null);g.rl=null}
if(opts&&opts.pu&&opts.pu.lat){
g.mk.push(new google.maps.Marker({position:{lat:opts.pu.lat,lng:opts.pu.lng},map:g.map,icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:'#34c759',fillOpacity:1,strokeColor:'#fff',strokeWeight:2.5,scale:8}}));
}
if(opts&&opts.d&&opts.d.lat){
g.mk.push(new google.maps.Marker({position:{lat:opts.d.lat,lng:opts.d.lng},map:g.map,icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:'#ff453a',fillOpacity:1,strokeColor:'#fff',strokeWeight:2.5,scale:8}}));
}
if(opts&&opts.pu&&opts.pu.lat&&opts.d&&opts.d.lat){
var bounds=new google.maps.LatLngBounds();
bounds.extend({lat:opts.pu.lat,lng:opts.pu.lng});
bounds.extend({lat:opts.d.lat,lng:opts.d.lng});
g.map.fitBounds(bounds,{top:50,bottom:50,left:40,right:40});
var mLat=(opts.pu.lat+opts.d.lat)/2,mLng=(opts.pu.lng+opts.d.lng)/2;
var dL=opts.d.lat-opts.pu.lat,dN=opts.d.lng-opts.pu.lng;
var off=Math.sqrt(dL*dL+dN*dN)*0.25;
mLat+=off*0.4;mLng-=off*0.25;
var cp=[];
for(var i=0;i<=30;i++){var t=i/30,u=1-t;cp.push({lat:u*u*opts.pu.lat+2*u*t*mLat+t*t*opts.d.lat,lng:u*u*opts.pu.lng+2*u*t*mLng+t*t*opts.d.lng})}
g.rl=new google.maps.Polyline({path:cp,geodesic:false,strokeColor:'#007AFF',strokeOpacity:0,map:g.map,icons:[{icon:{path:'M 0,-1 0,1',strokeColor:'#007AFF',strokeOpacity:0.7,strokeWeight:3,scale:2},offset:'0',repeat:'8px'}]});
}else if(opts&&opts.pu&&opts.pu.lat){
g.map.setCenter({lat:opts.pu.lat,lng:opts.pu.lng});g.map.setZoom(15);
}
}
window.updateDriverOnMap=function(){
try{
if(typeof google==='undefined'||!google.maps||!db||!arId)return;
var ride=db.rides.find(function(ri){return ri.id===arId});
if(!ride||!ride.driverId)return;
if(ride.status==='requested')return;
var drv=db.users.find(function(u){return u.id===ride.driverId});
if(!drv)return;
var dlat=drv.lat?parseFloat(drv.lat):null;
var dlng=drv.lng?parseFloat(drv.lng):null;
if(!dlat||!dlng){
supaFetch('GET','users','?id=eq.'+encodeURIComponent(ride.driverId)).then(function(res){
if(res&&res[0]&&res[0].lat&&res[0].lng){
drv.lat=res[0].lat;drv.lng=res[0].lng;
try{sv()}catch(e2){}
setTimeout(updateDriverOnMap,500);
}
}).catch(function(){});
return;
}
var mapEl=document.getElementById('w-map');
if(!mapEl||mapEl.offsetHeight<10)return;
var mid='w-map';var g=_gm[mid];
if(!g||!g.map){
drawMap(mapEl,{pu:{lat:parseFloat(ride.puX),lng:parseFloat(ride.puY)}});
g=_gm[mid];
if(!g||!g.map)return;
g.map.setOptions({gestureHandling:'greedy',zoomControl:true});
// Hide service area polygon during active ride
if(g.map._saPoly){g.map._saPoly.setMap(null)}
// Track user interaction to disable auto-follow
g._userPanned=false;
google.maps.event.addListenerOnce(g.map,'dragstart',function(){g._userPanned=true});
google.maps.event.addListenerOnce(g.map,'zoom_changed',function(){g._userPanned=true});
}
// Hide service area polygon if exists
if(g.map._saPoly&&g.map._saPoly.getMap()){g.map._saPoly.setMap(null)}
// Create or move driver marker
if(!g.drvMk){
g.drvMk=new google.maps.Marker({
position:{lat:dlat,lng:dlng},map:g.map,
icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,fillColor:'#007AFF',fillOpacity:1,strokeColor:'#fff',strokeWeight:2.5,scale:7},
zIndex:999,title:'Your Driver'
});
}else{
g.drvMk.setPosition({lat:dlat,lng:dlng});
}
// Ensure pickup marker exists
var puLat=parseFloat(ride.puX),puLng=parseFloat(ride.puY);
var doLat=parseFloat(ride.doX),doLng=parseFloat(ride.doY);
if(!g._puMk&&puLat&&puLng){
g._puMk=new google.maps.Marker({
position:{lat:puLat,lng:puLng},map:g.map,
icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:'#34c759',fillOpacity:1,strokeColor:'#fff',strokeWeight:2.5,scale:8},
zIndex:998,title:'Pickup'
});
}
// Auto-follow unless user has panned
if(!g._userPanned){
var bounds=new google.maps.LatLngBounds();
bounds.extend({lat:dlat,lng:dlng});
var dest=(ride.status==='picked_up'&&doLat&&doLng)?{lat:doLat,lng:doLng}:{lat:puLat,lng:puLng};
if(dest.lat&&dest.lng)bounds.extend(dest);
g.map.fitBounds(bounds,{top:80,bottom:80,left:60,right:60});
if(g.map.getZoom()>16)g.map.setZoom(16);
}
// Route line - throttle to every 10 seconds
var now=Date.now();
if(g._lastRoute&&now-g._lastRoute<10000)return;
g._lastRoute=now;
var routeDest=(ride.status==='picked_up'&&doLat&&doLng)?{lat:doLat,lng:doLng}:{lat:puLat,lng:puLng};
if(!routeDest.lat||!routeDest.lng)return;
var ds=new google.maps.DirectionsService();
ds.route({origin:{lat:dlat,lng:dlng},destination:routeDest,travelMode:'DRIVING'},function(res,st){
if(st==='OK'){
if(!g.drvRt){
g.drvRt=new google.maps.DirectionsRenderer({map:g.map,suppressMarkers:true,
polylineOptions:{strokeColor:ride.status==='picked_up'?'#34c759':'#007AFF',strokeWeight:5,strokeOpacity:0.7}});
}
g.drvRt.setDirections(res);
var mins=Math.max(1,Math.ceil(res.routes[0].legs[0].duration.value/60));
var mnEl=document.getElementById('w-mn');if(mnEl)mnEl.textContent=mins;
var stEl=document.getElementById('w-st');
if(stEl){
if(ride.status==='picked_up')stEl.textContent=mins+' min to drop-off';
else if(ride.status==='arrived')stEl.textContent='Your driver is at the pickup';
else stEl.textContent='Your driver is '+mins+' min away';
}
}
});
}catch(e){}
}
