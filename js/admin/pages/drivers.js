// RYDZ Admin - Drivers Page

var _drvMap=null;
var _drvMarkers={};
var _pnMap=null;
var _pnMarker=null;

function renderDrivers(){var tb=document.getElementById('d-tbody');var q=(document.getElementById('d-search').value||'').toLowerCase();var dl=users.filter(function(u){return u.role==='driver'});if(q)dl=dl.filter(function(d){return(d.name||'').toLowerCase().indexOf(q)>=0||(d.vehicle||'').toLowerCase().indexOf(q)>=0||(d.email||'').toLowerCase().indexOf(q)>=0});
tb.innerHTML=dl.map(function(d){var dr=rides.filter(function(r){return r.driver_id===d.id});var c=dr.filter(function(r){return r.status==='completed'}).length;var rated=dr.filter(function(r){return r.rating});var avgR=rated.length?Math.round(rated.reduce(function(a,r){return a+r.rating},0)/rated.length*10)/10:0;var stars=avgR?avgR.toFixed(1)+' <span class="star">&#9733;</span>':'--';var st=d.status==='online'?'<span class="badge on">Online</span>':'<span class="badge off">Offline</span>';var ac=d.disabled?'<span class="badge dis">Disabled</span>':'<span class="badge on">Active</span>';
return'<tr data-xid="'+d.id+'" onclick="openDrvPN(this.dataset.xid)"><td><strong>'+esc(d.name||'--')+'</strong></td><td style="color:var(--tx3)">'+esc(d.email||'-')+'</td><td>'+esc(d.phone||'-')+'</td><td>'+esc(d.vehicle||'-')+'</td><td>'+stars+'</td><td>'+c+'</td><td>'+st+'</td><td>'+ac+'</td></tr>'}).join('');
initDrvMap();updateDrvMap()}

function initDrvMap(){
if(_drvMap)return;
var el=document.getElementById('drv-fleet-map');
if(!el)return;
_drvMap=new google.maps.Map(el,{center:NC,zoom:13,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',styles:MS});
new google.maps.Polygon({paths:SVC,strokeColor:'#3b82f6',strokeOpacity:0.3,strokeWeight:2,fillColor:'#3b82f6',fillOpacity:0.03,map:_drvMap,clickable:false});
}

function updateDrvMap(){
if(!_drvMap)return;
var AS=['accepted','en_route','arrived','picked_up'];
var seen={};
users.filter(function(u){return u.role==='driver'}).forEach(function(d){
seen[d.id]=true;
var la=d.lat?parseFloat(d.lat):null,ln=d.lng?parseFloat(d.lng):null;
if(!la||!ln){if(_drvMarkers[d.id]){_drvMarkers[d.id].setMap(null);delete _drvMarkers[d.id]}return}
var hasRide=rides.find(function(r){return r.driver_id===d.id&&AS.indexOf(r.status)>=0});
var co=d.status==='online'?(hasRide?'#3b82f6':'#22c55e'):'#4b5563';
var label=esc(d.name||'Driver');
if(!_drvMarkers[d.id]){
_drvMarkers[d.id]=new google.maps.Marker({position:{lat:la,lng:ln},map:_drvMap,icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,fillColor:co,fillOpacity:1,strokeColor:'#fff',strokeWeight:1.5,scale:6},title:label,zIndex:d.status==='online'?100:10});
_drvMarkers[d.id].addListener('click',function(){openDrvPN(d.id)});
}else{
_drvMarkers[d.id].setPosition({lat:la,lng:ln});
_drvMarkers[d.id].setIcon({path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,fillColor:co,fillOpacity:1,strokeColor:'#fff',strokeWeight:1.5,scale:6});
_drvMarkers[d.id].setTitle(label);
}
});
Object.keys(_drvMarkers).forEach(function(id){if(!seen[id]){_drvMarkers[id].setMap(null);delete _drvMarkers[id]}});
}

async function openDrvPN(did){var d=users.find(function(x){return x.id===did});if(!d)return;var dr=rides.filter(function(r){return r.driver_id===did});var c=dr.filter(function(r){return r.status==='completed'}).length;var x=dr.filter(function(r){return r.status==='cancelled'}).length;var rated=dr.filter(function(r){return r.rating});var avgR=rated.length?(rated.reduce(function(a,r){return a+r.rating},0)/rated.length).toFixed(1):'--';var AS=['accepted','en_route','arrived','picked_up'];var ar=rides.find(function(r){return r.driver_id===did&&AS.indexOf(r.status)>=0});
var notes=await api('GET','admin_notes','?user_id=eq.'+encodeURIComponent(did)+'&order=created_at.desc');
document.getElementById('pn-title').textContent=d.name||'Driver';
var profileRows=row('Name',d.name)+row('Email',d.email)+row('Phone',d.phone)+row('Vehicle',d.vehicle)+row('Plate',d.plate);
if(isSuperAdmin)profileRows+=row('Username',d.username)+row('Password',d.password);
profileRows+=row('Status',d.status==='online'?'<span class="badge on">Online</span>':'<span class="badge off">Offline</span>')+row('GPS',d.lat?parseFloat(d.lat).toFixed(4)+', '+parseFloat(d.lng).toFixed(4):'<span style="color:var(--tx3)">No signal</span>');

var locationHtml='';
var la=d.lat?parseFloat(d.lat):null,ln=d.lng?parseFloat(d.lng):null;
if(la&&ln){
locationHtml=sect('Live Location','<div class="pn-map" id="pn-drv-map"></div>');
}else{
locationHtml=sect('Live Location','<div style="text-align:center;padding:20px 0;color:var(--tx3);font-size:12px">No GPS signal — driver is offline or location unavailable</div>');
}

document.getElementById('pn-body').innerHTML=sect('Profile',profileRows)+locationHtml+sect('Performance',row('Avg Rating',avgR+(avgR!=='--'?' <span class="star">&#9733;</span>':''))+row('Total Rides',dr.length)+row('Completed','<span style="color:var(--gn)">'+c+'</span>')+row('Cancelled','<span style="color:var(--rd)">'+x+'</span>'))+(ar?sect('Active Ride',row('Status','<span class="badge act">'+ar.status+'</span>')+row('Pickup',ar.pickup)+row('Dropoff',ar.dropoff)):'')+sect('Notes',noteBlock(did,notes));
document.getElementById('pn-acts').innerHTML=(d.disabled?'<button class="btn-p" data-xid="'+did+'" onclick="togDis(this.dataset.xid,false)">Enable</button>':'<button class="btn-d" data-xid="'+did+'" onclick="togDis(this.dataset.xid,true)">Disable</button>')+'<button style="background:var(--rdl);color:var(--rd)" data-xid="'+did+'" onclick="deleteDriver(this.dataset.xid)">Delete</button>';
openPN();

// Init mini-map after panel opens
if(la&&ln){
setTimeout(function(){
var mel=document.getElementById('pn-drv-map');
if(!mel)return;
_pnMap=new google.maps.Map(mel,{center:{lat:la,lng:ln},zoom:15,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',styles:MS});
_pnMarker=new google.maps.Marker({position:{lat:la,lng:ln},map:_pnMap,icon:{path:google.maps.SymbolPath.FORWARD_CLOSED_ARROW,fillColor:d.status==='online'?'#22c55e':'#4b5563',fillOpacity:1,strokeColor:'#fff',strokeWeight:1.5,scale:7},title:d.name||'Driver'});
},200);
}
}

async function deleteDriver(did){if(!confirm('Delete this driver? Their profile will be removed but ride history stats are preserved.'))return;await api('PATCH','rides','?driver_id=eq.'+encodeURIComponent(did),{driver_id:null});await api('DELETE','users','?id=eq.'+encodeURIComponent(did));await logAct('delete_driver',did);await loadData();closePN()}
function openMod(id){document.getElementById('mod-'+id).classList.add('on')}
function closeMod(id){document.getElementById('mod-'+id).classList.remove('on')}
async function createDriver(){var fn=document.getElementById('cd-fn').value.trim(),ln=document.getElementById('cd-ln').value.trim(),em=document.getElementById('cd-em').value.trim(),ph=document.getElementById('cd-ph').value.trim(),un=document.getElementById('cd-un').value.trim(),pw=document.getElementById('cd-pw').value,vh=document.getElementById('cd-vh').value.trim(),pl=document.getElementById('cd-pl').value.trim();if(!fn||!ln){alert('Name required');return}if(!un){alert('Username required');return}if(!pw){alert('Password required');return}var id='drv-'+Math.random().toString(36).slice(2,8)+Date.now().toString(36);var body={id:id,role:'driver',name:fn+' '+ln,first_name:fn,last_name:ln,email:em||null,phone:ph||null,username:un,password:pw,vehicle:vh||null,plate:pl||null,status:'offline',disabled:false};try{var res=await fetch(SUPA+'/rest/v1/users',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(body)});var txt=await res.text();if(!res.ok){alert('Error: '+txt);return}closeMod('cd');['cd-fn','cd-ln','cd-em','cd-ph','cd-un','cd-pw','cd-pl'].forEach(function(x){document.getElementById(x).value=''});alert('Driver created!');await loadData()}catch(e){alert('Network error: '+e.message)}}
