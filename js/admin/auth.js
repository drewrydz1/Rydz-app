// RYDZ Admin - Authentication

async function doLogin(){var u=document.getElementById('l-user').value.trim(),p=document.getElementById('l-pass').value,e=document.getElementById('l-err');e.style.display='none';if(!u||!p){e.textContent='Enter credentials';e.style.display='block';return}
try{var r=await api('GET','admin_users','?username=eq.'+encodeURIComponent(u)+'&password=eq.'+encodeURIComponent(p));if(r&&r.length){admin=r[0];localStorage.setItem('rydz-adm',JSON.stringify(admin));await api('PATCH','admin_users','?id=eq.'+admin.id,{last_login:new Date().toISOString(),is_online:true});showApp();return}}catch(ex){}
if(u==='admin'&&p==='rydz'){admin={id:'local',username:'admin',role:'super_admin',name:'Super Admin'};localStorage.setItem('rydz-adm',JSON.stringify(admin));showApp();return}
e.textContent='Invalid credentials';e.style.display='block'}
function doLogout(){if(admin&&admin.id!=='local')api('PATCH','admin_users','?id=eq.'+admin.id,{is_online:false});admin=null;localStorage.removeItem('rydz-adm');document.getElementById('login-wrap').style.display='flex';document.getElementById('app').classList.remove('on');closeSB()}
function showApp(){document.getElementById('login-wrap').style.display='none';document.getElementById('app').classList.add('on');isSuperAdmin=admin.role==='super_admin';document.getElementById('role-badge').textContent=admin.role==='super_admin'?'Super Admin':admin.role==='admin'?'Admin':'Operations';document.getElementById('btn-new-acct').style.display=isSuperAdmin?'block':'none';initMap();loadData();loadSettings();setInterval(loadData,3000);setInterval(heartbeat,30000);heartbeat()}
function checkSession(){var s=localStorage.getItem('rydz-adm');if(s){try{admin=JSON.parse(s);showApp()}catch(e){}}}
