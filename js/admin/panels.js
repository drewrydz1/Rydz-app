// RYDZ Admin - Panels

function openPN(){document.getElementById('pn-ov').classList.add('on');document.getElementById('pn').classList.add('on')}
function closePN(){document.getElementById('pn-ov').classList.remove('on');document.getElementById('pn').classList.remove('on')}
async function togDis(uid,v){await api('PATCH','users','?id=eq.'+encodeURIComponent(uid),{disabled:v});await logAct(v?'disable':'enable',uid);await loadData();closePN()}
async function addNote(uid){var inp=document.getElementById('nt-inp');var t=inp?inp.value.trim():'';if(!t)return;await api('POST','admin_notes','',{user_id:uid,note:t,admin_role:admin.role,admin_name:admin.name});inp.value='';var u=users.find(function(x){return x.id===uid});if(u&&u.role==='driver')openDrvPN(uid);else openRdrPN(uid)}
async function logAct(a,tid){await api('POST','admin_logs','',{action:a,target_id:tid,admin_role:admin.role,admin_name:admin.name})}
function openRidePN(rid){var r=rides.find(function(x){return x.id===rid});if(!r)return;var rider=users.find(function(u){return u.id===r.rider_id});var driver=r.driver_id?users.find(function(u){return u.id===r.driver_id}):null;var sc=r.status==='completed'?'var(--gn)':r.status==='cancelled'?'var(--rd)':r.status==='requested'?'var(--or)':'var(--bl)';
var isActive=['requested','accepted','en_route','arrived','picked_up'].indexOf(r.status)>=0;
var onlineDrivers=users.filter(function(u){return u.role==='driver'&&u.status==='online'});
var drvOpts=onlineDrivers.map(function(d){var sel=r.driver_id===d.id?' selected':'';return'<option value="'+d.id+'"'+sel+'>'+esc(d.name)+'</option>'}).join('');
document.getElementById('pn-title').textContent='Ride Details';
document.getElementById('pn-body').innerHTML=sect('Ride Info',row('Status','<span class="badge" style="background:'+sc+'22;color:'+sc+'">'+r.status+'</span>')+row('Ride ID','<span style="font-size:11px;opacity:.7">'+r.id+'</span>')+row('Pickup',esc(r.pickup))+row('Drop-off',esc(r.dropoff))+row('Passengers',r.passengers||1)+row('Created',r.created_at?new Date(r.created_at).toLocaleString():'--'))+(rider?sect('Rider',row('Name',esc(rider.name))+row('Email',rider.email)+row('Phone',rider.phone)):sect('Rider','<span style="color:var(--tx3)">Dispatch / Unknown</span>'))+(driver?sect('Driver',row('Name',esc(driver.name))+row('Vehicle',driver.vehicle)):isActive?sect('Driver','<span style="color:var(--tx3)">Unassigned</span>'):'')+(isActive?sect('Edit Ride','<div style="display:flex;flex-direction:column;gap:10px"><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Assign Driver</label><select id="re-drv" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font)"><option value="">Unassigned</option>'+drvOpts+'</select></div><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Passengers</label><input id="re-pass" type="number" min="1" max="5" value="'+(r.passengers||1)+'" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box"></div><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Note</label><input id="re-note" type="text" value="'+esc(r.note||'')+'" placeholder="Add or edit note" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box"></div></div>'):'');
var acts='';
if(isActive){acts='<button style="background:var(--bl);color:#fff" onclick="saveRideEdit(\''+r.id+'\')">Save Changes</button><button style="background:var(--rdl);color:var(--rd)" onclick="cancelAdminRide(\''+r.id+'\')">Cancel Ride</button>'}
document.getElementById('pn-acts').innerHTML=acts;openPN()}

async function saveRideEdit(rid){
var drvSel=document.getElementById('re-drv');
var passSel=document.getElementById('re-pass');
var noteSel=document.getElementById('re-note');
var patch={};
if(drvSel)patch.driver_id=drvSel.value||null;
if(passSel)patch.passengers=parseInt(passSel.value)||1;
if(noteSel)patch.note=noteSel.value.trim();
await api('PATCH','rides','?id=eq.'+encodeURIComponent(rid),patch);
await logAct('edit_ride',rid);
await loadData();
openRidePN(rid);
}

async function cancelAdminRide(rid){
if(!confirm('Cancel this ride? This cannot be undone.'))return;
await api('PATCH','rides','?id=eq.'+encodeURIComponent(rid),{status:'cancelled'});
await logAct('cancel_ride',rid);
await loadData();
closePN();
}
