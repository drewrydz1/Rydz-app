// RYDZ Rider - Menu System

function closeAllM(){document.querySelectorAll('.mscr').forEach(function(m){m.classList.remove('on')})}
function menuBack(){closeAllM()}
function openM(id){closeSB();closeAllM();if(id==='profile')renProfile();if(id==='history')renHistory();if(id==='promos')renPromos();if(id==='wallet')renWallet();if(id==='support')renSupport();document.getElementById('ms-'+id).classList.add('on')}
function mTop(t){return'<div class="mtop"><button class="btn btn-ghost" onclick="menuBack()"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>'+esc(t)+'</h2></div>'}
