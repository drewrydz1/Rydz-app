// RYDZ Admin - Panels

function openPN(){document.getElementById('pn-ov').classList.add('on');document.getElementById('pn').classList.add('on')}
function closePN(){document.getElementById('pn-ov').classList.remove('on');document.getElementById('pn').classList.remove('on')}
async function togDis(uid,v){await api('PATCH','users','?id=eq.'+encodeURIComponent(uid),{disabled:v});await logAct(v?'disable':'enable',uid);await loadData();closePN()}
async function addNote(uid){var inp=document.getElementById('nt-inp');var t=inp?inp.value.trim():'';if(!t)return;await api('POST','admin_notes','',{user_id:uid,note:t,admin_role:admin.role,admin_name:admin.name});inp.value='';var u=users.find(function(x){return x.id===uid});if(u&&u.role==='driver')openDrvPN(uid);else openRdrPN(uid)}
async function logAct(a,tid){await api('POST','admin_logs','',{action:a,target_id:tid,admin_role:admin.role,admin_name:admin.name})}
function openRidePN(rid){var r=rides.find(function(x){return x.id===rid});if(!r)return;var rider=users.find(function(u){return u.id===r.rider_id});var driver=r.driver_id?users.find(function(u){return u.id===r.driver_id}):null;var sc=r.status==='completed'?'var(--gn)':r.status==='cancelled'?'var(--rd)':r.status==='requested'?'var(--or)':'var(--bl)';
document.getElementById('pn-title').textContent='Ride Details';
var isDispatch=!r.rider_id&&r.note;var riderSect;if(rider){riderSect=sect('Rider',row('Name',rider.name)+row('Email',rider.email)+row('Phone',rider.phone))}else if(isDispatch){riderSect=sect('Rider',row('Name',esc(r.note)+' <svg width="14" height="14" fill="none" stroke="var(--bl)" stroke-width="2" style="vertical-align:middle;margin-left:4px"><path d="M1 2.5a1.5 1.5 0 011.5-1.5h1.6a.75.75 0 01.71.51l.53 1.58a.75.75 0 01-.2.77l-.67.67a6 6 0 002.4 2.4l.67-.67a.75.75 0 01.77-.2l1.58.53a.75.75 0 01.51.71V9.5a1.5 1.5 0 01-1.5 1.5A9 9 0 011 2.5z"/></svg>')+(r.phone?row('Phone',r.phone):''))}else{riderSect=sect('Rider','<span style="color:var(--tx3)">Unknown</span>')}
document.getElementById('pn-body').innerHTML=sect('Ride Info',row('Status','<span class="badge" style="background:'+sc+'22;color:'+sc+'">'+r.status+'</span>')+row('Pickup',r.pickup)+row('Drop-off',r.dropoff)+row('Passengers',r.passengers||1))+riderSect+(driver?sect('Driver',row('Name',driver.name)+row('Vehicle',driver.vehicle)):'');
document.getElementById('pn-acts').innerHTML='';openPN()}
