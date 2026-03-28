// RYDZ Driver - Sidebar Navigation

function openSB(){document.getElementById('d-ov').classList.add('on');document.getElementById('d-sb').classList.add('on');var drv=gD();if(drv){document.getElementById('dsb-av').textContent=drv.name[0];document.getElementById('dsb-nm').textContent=drv.name;document.getElementById('dsb-em').textContent=drv.vehicle||''}}
function closeSB(){document.getElementById('d-ov').classList.remove('on');document.getElementById('d-sb').classList.remove('on')}
