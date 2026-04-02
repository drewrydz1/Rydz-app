// RYDZ Admin - Riders Page

function renderRiders(){var tb=document.getElementById('r-tbody');var q=(document.getElementById('r-search').value||'').toLowerCase();var rl=users.filter(function(u){return u.role!=='driver'&&u.role!=='admin'});if(q)rl=rl.filter(function(u){return(u.name||'').toLowerCase().indexOf(q)>=0||(u.email||'').toLowerCase().indexOf(q)>=0||(u.phone||'').indexOf(q)>=0});
tb.innerHTML=rl.map(function(u){var ur=rides.filter(function(r){return r.rider_id===u.id});var c=ur.filter(function(r){return r.status==='completed'}).length;var x=ur.filter(function(r){return r.status==='cancelled'}).length;var joined=u.signup_date?new Date(u.signup_date).toLocaleDateString():(u.created_at?new Date(u.created_at).toLocaleDateString():'--');var st=u.disabled?'<span class="badge dis">Disabled</span>':'<span class="badge on">Active</span>';
return'<tr data-xid="'+u.id+'" onclick="openRdrPN(this.dataset.xid)"><td><strong>'+esc(u.name||'--')+'</strong></td><td style="color:var(--tx3)">'+esc(u.email||'-')+'</td><td>'+esc(u.phone||'-')+'</td><td style="color:var(--tx3);font-size:12px">'+joined+'</td><td>'+st+'</td></tr>'}).join('')}

function _fmtDt(d){if(!d)return'--';var dt=new Date(d);return dt.toLocaleDateString()+' '+dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}

function _buildRecentRides(ur){
var sorted=ur.filter(function(r){return r.status==='completed'||r.status==='cancelled'}).sort(function(a,b){return new Date(b.completed_at||b.created_at)-new Date(a.completed_at||a.created_at)});
if(!sorted.length)return'<div style="color:var(--tx3);font-size:12px;padding:8px 0">No rides yet</div>';
return'<div style="max-height:220px;overflow-y:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px">'+sorted.map(function(r){
var sc=r.status==='completed'?'var(--gn)':'var(--rd)';
var dt=r.completed_at||r.created_at;
var dateStr=dt?new Date(dt).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'--';
return'<div onclick="openRiderRideDetail(\''+r.id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;background:var(--bg);border:1px solid var(--bdr);border-radius:10px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor=\'var(--bl)\'" onmouseout="this.style.borderColor=\'var(--bdr)\'">'
+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(r.dropoff||'--')+'</div>'
+'<div style="font-size:11px;color:var(--tx3);margin-top:2px">'+dateStr+'</div></div>'
+'<span class="badge" style="background:'+sc+'22;color:'+sc+';flex-shrink:0;margin-left:10px">'+r.status+'</span>'
+'</div>'}).join('')+'</div>'}

function openRiderRideDetail(rid){
var r=rides.find(function(x){return x.id===rid});if(!r)return;
var driver=r.driver_id?users.find(function(u){return u.id===r.driver_id}):null;
var sc=r.status==='completed'?'var(--gn)':r.status==='cancelled'?'var(--rd)':r.status==='requested'?'var(--or)':'var(--bl)';
var html='<div id="rrd-ov" onclick="closeRiderRideDetail()" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .15s ease">'
+'<div onclick="event.stopPropagation()" style="background:var(--bg2);border-radius:16px;width:100%;max-width:380px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
+'<div style="padding:16px 18px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">'
+'<h3 style="font-size:15px;font-weight:800;margin:0">Ride Details</h3>'
+'<div onclick="closeRiderRideDetail()" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;color:var(--tx3);border:1px solid var(--bdr);font-size:14px">&#10005;</div>'
+'</div><div style="padding:18px">'
+'<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px"><span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;background:'+sc+'22;color:'+sc+'">'+r.status.toUpperCase()+'</span></div>'
+'<div style="margin-bottom:16px">'
+'<div style="display:flex;gap:10px;margin-bottom:10px"><div style="display:flex;flex-direction:column;align-items:center;padding-top:3px"><div style="width:10px;height:10px;border-radius:50%;background:var(--gn);flex-shrink:0"></div><div style="width:2px;flex:1;background:var(--bdr);margin:4px 0"></div><div style="width:10px;height:10px;border-radius:50%;background:var(--rd);flex-shrink:0"></div></div>'
+'<div style="flex:1"><div style="margin-bottom:12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);letter-spacing:.5px">Pickup</div><div style="font-size:13px;font-weight:600;margin-top:2px">'+esc(r.pickup||'--')+'</div></div>'
+'<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);letter-spacing:.5px">Drop-off</div><div style="font-size:13px;font-weight:600;margin-top:2px">'+esc(r.dropoff||'--')+'</div></div></div></div></div>'
+'<div style="background:var(--bg);border:1px solid var(--bdr);border-radius:10px;overflow:hidden">'
+'<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--bdr)"><span style="font-size:12px;color:var(--tx3)">Requested</span><span style="font-size:12px;font-weight:600">'+_fmtDt(r.created_at)+'</span></div>'
+'<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--bdr)"><span style="font-size:12px;color:var(--tx3)">Picked Up</span><span style="font-size:12px;font-weight:600">'+_fmtDt(r.picked_up_at)+'</span></div>'
+'<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--bdr)"><span style="font-size:12px;color:var(--tx3)">Dropped Off</span><span style="font-size:12px;font-weight:600">'+_fmtDt(r.completed_at)+'</span></div>'
+'<div style="display:flex;justify-content:space-between;padding:10px 14px"><span style="font-size:12px;color:var(--tx3)">Driver</span><span style="font-size:12px;font-weight:600">'+esc(driver?driver.name:'--')+'</span></div>'
+'</div></div></div></div>';
var el=document.createElement('div');el.id='rrd-wrap';el.innerHTML=html;document.body.appendChild(el)}

function closeRiderRideDetail(){var el=document.getElementById('rrd-wrap');if(el)el.remove()}

async function openRdrPN(uid){var u=users.find(function(x){return x.id===uid});if(!u)return;var ur=rides.filter(function(r){return r.rider_id===uid});var c=ur.filter(function(r){return r.status==='completed'}).length;var x=ur.filter(function(r){return r.status==='cancelled'}).length;var joined=u.signup_date?new Date(u.signup_date).toLocaleDateString():(u.created_at?new Date(u.created_at).toLocaleDateString():'--');
var notes=await api('GET','admin_notes','?user_id=eq.'+encodeURIComponent(uid)+'&order=created_at.desc');
document.getElementById('pn-title').textContent=u.name||'Rider';
document.getElementById('pn-body').innerHTML=sect('Profile',row('Name',u.name)+row('Email',u.email)+row('Phone',u.phone)+row('Joined',joined)+row('Account',u.disabled?'<span class="badge dis">Disabled</span>':'<span class="badge on">Active</span>'))+sect('Ride Stats',row('Total Rides',ur.length)+row('Completed','<span style="color:var(--gn)">'+c+'</span>')+row('Cancelled','<span style="color:var(--rd)">'+x+'</span>')+row('Cancel Rate',(ur.length?Math.round(x/ur.length*100):0)+'%'))+sect('Notes',noteBlock(uid,notes))+sect('Recent Rides',_buildRecentRides(ur));
document.getElementById('pn-acts').innerHTML=(u.disabled?'<button class="btn-p" data-xid="'+uid+'" onclick="togDis(this.dataset.xid,false)">Enable Account</button>':'<button class="btn-d" data-xid="'+uid+'" onclick="togDis(this.dataset.xid,true)">Disable Account</button>')+'<button class="btn-d" style="background:var(--rd)22;color:var(--rd);margin-top:8px" data-xid="'+uid+'" onclick="delRider(this.dataset.xid)">Delete Account Permanently</button>';
openPN()}

async function delRider(uid){var u=users.find(function(x){return x.id===uid});if(!u)return;if(!confirm('Are you sure you want to permanently delete '+esc(u.name||'this rider')+'? This cannot be undone.'))return;if(!confirm('This will delete the rider account and all their ride history. Continue?'))return;await api('DELETE','rides','?rider_id=eq.'+encodeURIComponent(uid));await api('DELETE','admin_notes','?user_id=eq.'+encodeURIComponent(uid));await api('DELETE','users','?id=eq.'+encodeURIComponent(uid));await logAct('delete_rider',uid);await loadData();closePN()}
