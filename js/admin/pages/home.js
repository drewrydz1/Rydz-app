// RYDZ Admin - Home Page

function updateMetrics(){var drvs=users.filter(function(u){return u.role==='driver'});var on=drvs.filter(function(d){return d.status==='online'});var AS=['accepted','en_route','arrived','picked_up'];var act=rides.filter(function(r){return AS.indexOf(r.status)>=0});var pnd=rides.filter(function(r){return r.status==='requested'});var ds=getDayStart();var tR=rides.filter(function(r){return r.created_at&&new Date(r.created_at).getTime()>=ds});var tC=tR.filter(function(r){return r.status==='completed'});var tX=tR.filter(function(r){return r.status==='cancelled'});var pendingTix=tickets.filter(function(t){return!t.status||t.status==='pending'});
document.getElementById('mc-on').textContent=on.length;document.getElementById('mc-on-s').textContent='of '+drvs.length+' total';
document.getElementById('mc-act').textContent=act.length;document.getElementById('mc-pnd').textContent=pnd.length;
document.getElementById('mc-tix').textContent=pendingTix.length;
document.getElementById('mc-tod').textContent=tC.length;document.getElementById('mc-tod-s').textContent='since 5am';
document.getElementById('mc-can').textContent=tX.length}
