// RYDZ Rider - Sidebar

function openSB(){document.getElementById('sb-ov').classList.add('on');document.getElementById('sb-m').classList.add('on');updSB()}
function closeSB(){document.getElementById('sb-ov').classList.remove('on');document.getElementById('sb-m').classList.remove('on')}
function updSB(){if(!curUser)return;document.getElementById('sb-av').textContent=(curUser.firstName||curUser.name||'U')[0].toUpperCase();document.getElementById('sb-nm').textContent=curUser.name||'';document.getElementById('sb-em').textContent=curUser.email||''}
