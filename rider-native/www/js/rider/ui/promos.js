// RYDZ Rider - Promotions (synced from Supabase 10-slot system)

var astimer=null,touching=false;
var _supaPromos=null;

function getActivePromos(){
  // Supabase promos take priority if loaded
  if(_supaPromos&&_supaPromos.length){
    return _supaPromos.filter(function(p){return p.is_active&&p.title}).map(function(p){
      return{id:'p'+p.slot_index,name:p.title,addr:p.destination_address||'',desc:p.description||'',color:p.color||'#007AFF',img:p.image_url||''};
    });
  }
  // Fallback to built-in PROMOS
  if(typeof PROMOS!=='undefined'&&PROMOS.length) return PROMOS;
  return db.settings.promotions||[];
}

function loadSupaPromos(){
  fetch(SUPA_URL+'/rest/v1/promotions?order=slot_index.asc&is_active=eq.true',{
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
  }).then(function(r){return r.json()}).then(function(data){
    if(data&&Array.isArray(data)&&data.length){
      _supaPromos=data;
      renPromoScroll();
    }
  }).catch(function(){});
}

function renPromos(){
  var promos=getActivePromos();
  var h=mTop('Promotions');
  promos.forEach(function(p,i){
    var img=p.img||PIMG[i%PIMG.length];
    h+='<div class="pli" onclick="openPD('+i+')"><div class="pli-img" style="background:'+p.color+'"><img src="'+img+'" onerror="this.style.display=\'none\'"></div><div class="pli-text"><h4>'+esc(p.name)+'</h4><p>'+esc(p.addr)+'</p></div></div>';
  });
  document.getElementById('ms-promos').innerHTML=h;
}

function openPD(idx){
  closeAllM();
  var promos=getActivePromos();
  var p=promos[idx];if(!p)return;
  var img=p.img||PIMG[idx%PIMG.length];
  var addrBtn=p.addr?'<button class="btn btn-p btn-lg btn-w" style="margin-top:16px" onclick="window.open(\'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(p.addr)+'\',\'_blank\')">Take Me There</button>':'';
  document.getElementById('ms-promo-detail').innerHTML='<div class="mtop"><button class="btn btn-ghost" onclick="openM(\'promos\')"><svg width="20" height="20" fill="none" stroke="var(--g800)" stroke-width="2" stroke-linecap="round"><path d="M17 10H3M10 17l-7-7 7-7"/></svg></button><h2>Promotion</h2></div><div class="pd"><div class="pd-img" style="background:'+p.color+'"><img src="'+img+'" onerror="this.style.display=\'none\'"></div><h3>'+esc(p.name)+'</h3><p class="pd-a">'+esc(p.addr)+'</p><p class="pd-d">'+esc(p.desc)+'</p>'+addrBtn+'</div>';
  document.getElementById('ms-promo-detail').classList.add('on');
}

function openPDHome(idx){openM('promos');setTimeout(function(){openPD(idx)},100)}

function renPromoScroll(){
  var el=document.getElementById('promo-trk');if(!el)return;
  var promos=getActivePromos();
  if(!promos.length)return;
  var all=promos.concat(promos);
  el.innerHTML=all.map(function(p,i){
    var img=p.img||PIMG[i%PIMG.length];
    return'<div class="promo-cd" onclick="openPDHome('+(i%promos.length)+')" style="background:'+p.color+'"><img src="'+img+'" onerror="this.style.display=\'none\'"><div class="promo-ol"><span>'+esc(p.name)+'</span></div></div>';
  }).join('');
  startAutoScroll();
}

function startAutoScroll(){
  if(astimer)clearInterval(astimer);
  var w=document.querySelector('.promo-track-wrap');if(!w)return;
  w.ontouchstart=function(){touching=true};
  w.ontouchend=function(){touching=false};
  w.onmouseenter=function(){touching=true};
  w.onmouseleave=function(){touching=false};
  astimer=setInterval(function(){
    if(touching)return;
    w.scrollLeft+=1;
    if(w.scrollLeft>=w.scrollWidth/2)w.scrollLeft=0;
  },30);
}

// Periodic refresh of Supabase promos (initial load handled by init.js)
setInterval(loadSupaPromos,15000);
