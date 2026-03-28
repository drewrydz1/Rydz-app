// RYDZ Admin - Panels & Actions

function openPN(){document.getElementById('pn-ov').classList.add('on');document.getElementById('pn').classList.add('on')}
function closePN(){document.getElementById('pn-ov').classList.remove('on');document.getElementById('pn').classList.remove('on')}
async function togDis(uid,v){await api('PATCH','users','?id=eq.'+encodeURIComponent(uid),{disabled:v});await logAct(v?'disable':'enable',uid);await loadData();closePN()}
async function addNote(uid){var inp=document.getElementById('nt-inp');var t=inp?inp.value.trim():'';if(!t)return;await api('POST','admin_notes','',{user_id:uid,note:t,admin_role:admin.role,admin_name:admin.name});inp.value='';var u=users.find(function(x){return x.id===uid});if(u&&u.role==='driver')openDrvPN(uid);else openRdrPN(uid)}
async function logAct(a,tid){await api('POST','admin_logs','',{action:a,target_id:tid,admin_role:admin.role,admin_name:admin.name})}
function openRidePN(rid){var r=rides.find(function(x){return x.id===rid});if(!r)return;var rider=users.find(function(u){return u.id===r.rider_id});var driver=r.driver_id?users.find(function(u){return u.id===r.driver_id}):null;var sc=r.status==='completed'?'var(--gn)':r.status==='cancelled'?'var(--rd)':r.status==='requested'?'var(--or)':'var(--bl)';
document.getElementById('pn-title').textContent='Ride Details';
document.getElementById('pn-body').innerHTML=sect('Ride Info',row('Status','<span class="badge" style="background:'+sc+'22;color:'+sc+'">'+r.status+'</span>')+row('Pickup',r.pickup)+row('Drop-off',r.dropoff)+row('Passengers',r.passengers||1))+(rider?sect('Rider',row('Name',rider.name)+row('Email',rider.email)+row('Phone',rider.phone)):sect('Rider','<span style="color:var(--tx3)">Unknown</span>'))+(driver?sect('Driver',row('Name',driver.name)+row('Vehicle',driver.vehicle)):'');
document.getElementById('pn-acts').innerHTML='';openPN()}
