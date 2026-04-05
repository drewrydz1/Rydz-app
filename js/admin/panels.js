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
var isDispatch=!r.rider_id&&r.note;var _dpn={caller:'',notes:''};if(isDispatch){try{var _pj=JSON.parse(r.note);if(_pj&&_pj.caller){_dpn=_pj;_dpn.notes=_dpn.notes||''}}catch(e){if(r.note.indexOf('DISPATCH:')===0){var _sp=r.note.replace('DISPATCH: ','').split(' | ');_dpn={caller:_sp[0],notes:_sp[1]||''}}else{_dpn={caller:r.note,notes:''}}}}var phoneIcon=' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bl)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:4px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>';
var riderSect;if(rider){riderSect=sect('Rider',row('Name',esc(rider.name))+row('Email',rider.email)+row('Phone',rider.phone))}else if(isDispatch){riderSect=sect('Caller',row('Name',esc(_dpn.caller)+phoneIcon)+(r.phone?row('Phone',r.phone):'')+row('Notes',esc(_dpn.notes)||'<span style="color:var(--tx3)">None</span>'))}else{riderSect=sect('Rider','<span style="color:var(--tx3)">Unknown</span>')}
var driverSect=driver?sect('Driver',row('Name',esc(driver.name))+row('Vehicle',driver.vehicle)):isActive?sect('Driver','<span style="color:var(--tx3)">Unassigned</span>'):'';
var editSect=isActive?sect('Edit Ride','<div style="display:flex;flex-direction:column;gap:10px"><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Assign Driver</label><select id="re-drv" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font)"><option value="">Unassigned</option>'+drvOpts+'</select></div><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Passengers</label><input id="re-pass" type="number" min="1" max="5" value="'+(r.passengers||1)+'" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box"></div><div><label style="font-size:11px;color:var(--tx3);display:block;margin-bottom:4px">Note</label><input id="re-note" type="text" value="'+esc(r.note||'')+'" placeholder="Add or edit note" style="width:100%;padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg2);color:var(--tx);font-size:13px;font-family:var(--font);box-sizing:border-box"></div></div>'):'';
document.getElementById('pn-body').innerHTML=sect('Ride Info',row('Status','<span class="badge" style="background:'+sc+'22;color:'+sc+'">'+r.status+'</span>')+row('Ride ID','<span style="font-size:11px;opacity:.7">'+r.id+'</span>')+row('Pickup',esc(r.pickup))+row('Drop-off',esc(r.dropoff))+row('Passengers',r.passengers||1)+row('Created',r.created_at?new Date(r.created_at).toLocaleString():'--'))+riderSect+driverSect+editSect;
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
