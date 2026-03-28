// RYDZ Admin - Access Accounts

async function loadAccessAccounts(){var r=await api('GET','admin_users','?order=created_at.asc');if(r)adminAccts=r;renderAccessAccounts()}
function renderAccessAccounts(){var tb=document.getElementById('a-tbody');if(!tb)return;
tb.innerHTML=adminAccts.map(function(a){
var isOnline=a.last_seen&&(Date.now()-new Date(a.last_seen).getTime()<120000);
var dot='<span class="online-dot '+(isOnline?'on':'off')+'"></span>'+(isOnline?'Online':'Offline');
var roleBadge=a.role==='super_admin'?'<span class="badge sa">Super Admin</span>':a.role==='admin'?'<span class="badge act">Admin</span>':'<span class="badge off">Operations</span>';
var lastLogin=a.last_login?ago(new Date(a.last_login)):'Never';
var actions='';
if(isSuperAdmin&&a.role!=='super_admin'){actions='<select style="padding:4px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:11px;font-family:var(--font)" data-xid="'+a.id+'" onchange="changeRole(this.dataset.xid,this.value)"><option value="admin"'+(a.role==='admin'?' selected':'')+'>Admin</option><option value="operations"'+(a.role==='operations'?' selected':'')+'>Operations</option><option value="super_admin">Super Admin</option></select> <button class="btn btn-d" style="padding:4px 8px;font-size:10px;margin-left:4px" data-xid="'+a.id+'" onclick="event.stopPropagation();delAccount(this.dataset.xid)">Del</button>'}else if(a.role==='super_admin'){actions='<span style="color:var(--tx3);font-size:11px">Protected</span>'}
return'<tr><td>'+dot+'</td><td><strong>'+esc(a.name||'--')+'</strong></td><td style="font-family:var(--mono);font-size:12px">'+esc(a.username||'--')+'</td><td style="color:var(--tx3)">'+esc(a.email||'-')+'</td><td>'+esc(a.phone||'-')+'</td><td>'+roleBadge+'</td><td style="color:var(--tx3);font-size:12px">'+lastLogin+'</td><td>'+actions+'</td></tr>'}).join('')}
async function createAccount(){var nm=document.getElementById('ca-name').value.trim(),em=document.getElementById('ca-email').value.trim(),ph=document.getElementById('ca-phone').value.trim(),un=document.getElementById('ca-user').value.trim(),pw=document.getElementById('ca-pass').value,rl=document.getElementById('ca-role').value;
if(!un){alert('Username required');return}if(!pw){alert('Password required');return}
var existing=await api('GET','admin_users','?username=eq.'+encodeURIComponent(un));if(existing&&existing.length){alert('Username already taken');return}
await api('POST','admin_users','',{username:un,password:pw,name:nm||un,email:em,phone:ph,role:rl});await logAct('create_account',un);closeMod('ca');['ca-name','ca-email','ca-phone','ca-user','ca-pass'].forEach(function(x){document.getElementById(x).value=''});loadAccessAccounts()}
async function changeRole(id,role){await api('PATCH','admin_users','?id=eq.'+id,{role:role});await logAct('change_role',id);loadAccessAccounts()}
async function delAccount(id){if(!confirm('Remove this account?'))return;await api('DELETE','admin_users','?id=eq.'+id);await logAct('delete_account',id);loadAccessAccounts()}
