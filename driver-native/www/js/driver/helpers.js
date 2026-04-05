// RYDZ Driver - Helper Utilities
// Formatters, escape, common functions

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function fmtRelative(ts){var now=Date.now(),d2=now-ts,m=Math.floor(d2/60000);if(m<1)return'Just now';if(m<60)return m+'m ago';var h=Math.floor(m/60);if(h<24)return'Today, '+new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});if(h<48)return'Yesterday';return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function fmt(t){return new Date(t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function drawMap(el,opts){if(!el)return;if(!gmapLoaded){el.innerHTML='<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#e9eff7;color:#8e9196;font-size:12px">Loading map...</div>';loadGMaps(function(){drawMap(el,opts)});return}var mapId=el.id||'map-'+Date.now();if(!gmaps[mapId]){gmaps[mapId]=createMap(el,{zoom:13})}var map=gmaps[mapId];var markers=gmaps[mapId+'_m']||[];markers.forEach(function(m){m.setMap(null)});markers=[];if(opts&&opts.pu){var pm=addMarker(map,opts.pu.lat,opts.pu.lng,{type:'pickup'});markers.push(pm)}if(opts&&opts.d){var dm=addMarker(map,opts.d.lat,opts.d.lng,{type:'dropoff'});markers.push(dm)}if(opts&&opts.pu&&opts.d){fitBounds(map,[{lat:opts.pu.lat,lng:opts.pu.lng},{lat:opts.d.lat,lng:opts.d.lng}])}gmaps[mapId+'_m']=markers}

// Navigation
function go(id){document.querySelectorAll('.scr').forEach(function(s){s.classList.remove('on')});var el=document.getElementById('s-'+id);if(el)el.classList.add('on');cur=id;if(id==='vehicle')renVeh();if(id==='main')ren()}


// Open phone maps app with directions to pickup or dropoff
function openDirections() {
  var mr = typeof gMR === 'function' ? gMR() : null;
  if (!mr) { showToast('No active ride'); return; }

  var destLat, destLng, destLabel;

  if (mr.status === 'picked_up') {
    // Heading to drop-off
    destLat = parseFloat(mr.doX);
    destLng = parseFloat(mr.doY);
    destLabel = mr.dropoff || 'Drop-off';
  } else {
    // Heading to pickup
    destLat = parseFloat(mr.puX);
    destLng = parseFloat(mr.puY);
    destLabel = mr.pickup || 'Pickup';
  }

  if (!destLat || !destLng) { showToast('No destination coordinates'); return; }

  // Detect iOS (iPhone/iPad)
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isIOS) {
    // Apple Maps - uses current location automatically as origin
    window.open('maps://maps.apple.com/?daddr=' + destLat + ',' + destLng + '&dirflg=d', '_blank');
  } else {
    // Google Maps - works on Android and desktop
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + destLat + ',' + destLng + '&travelmode=driving', '_blank');
  }
}
