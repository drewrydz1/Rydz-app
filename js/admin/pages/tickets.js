// RYDZ Admin - Tickets Page

function renderTickets(){
var tb=document.getElementById('tix-tbody');if(!tb)return;
var filter=document.getElementById('tix-filter').value;
var search=(document.getElementById('tix-search').value||'').toLowerCase();
var list=tickets.slice();
if(filter!=='all')list=list.filter(function(t){return(t.status||'pending')===filter});
if(search)list=list.filter(function(t){return(t.user_name||'').toLowerCase().indexOf(search)>=0||(t.message||'').toLowerCase().indexOf(search)>=0||(t.type||'').toLowerCase().indexOf(search)>=0});

var stats={pending:0,investigate:0,replied:0,resolved:0};
tickets.forEach(function(t){var s=t.status||'pending';if(stats[s]!==undefined)stats[s]++});
document.getElementById('tix-stats').innerHTML='<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--orl);color:var(--or)">Pending: '+stats.pending+'</div><div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--bld);color:var(--bl)">Investigate: '+stats.investigate+'</div><div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--ppl);color:var(--pp)">Replied: '+stats.replied+'</div><div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--gnl);color:var(--gn)">Resolved: '+stats.resolved+'</div>';

tb.innerHTML=list.map(function(t){
var st=t.status||'pending';
var badge=st==='pending'?'<span class="badge wrn">Pending</span>':st==='investigate'?'<span class="badge act">Investigate</span>':st==='replied'?'<span class="badge sa">Replied</span>':'<span class="badge on">Resolved</span>';
var typeBadge=t.type==='bug'?'<span style="color:var(--rd)">Bug</span>':t.type==='suggestion'?'<span style="color:var(--or)">Suggestion</span>':t.type==='lost'?'<span style="color:var(--gn)">Lost&Found</span>':'<span style="color:var(--bl)">General</span>';
var msg=(t.message||'').length>50?(t.message||'').substring(0,50)+'...':t.message||'';
var time=t.created_at?ago(new Date(t.created_at)):'--';
var rider=users.find(function(u){return u.id===t.user_id});
var riderName=t.user_name||'Unknown';
return'<tr data-xid="'+t.id+'" onclick="openTicketPN(this.dataset.xid)"><td>'+badge+'</td><td>'+typeBadge+'</td><td><strong>'+esc(riderName)+'</strong></td><td style="color:var(--tx2);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(msg)+'</td><td style="color:var(--tx3);font-size:12px">'+time+'</td><td><select data-xid="'+t.id+'" onclick="event.stopPropagation()" onchange="updateTicketStatus(this.dataset.xid,this.value)" style="padding:4px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:11px;font-family:var(--font)"><option value="pending"'+(st==='pending'?' selected':'')+'>Pending</option><option value="investigate"'+(st==='investigate'?' selected':'')+'>Investigate</option><option value="replied"'+(st==='replied'?' selected':'')+'>Replied</option><option value="resolved"'+(st==='resolved'?' selected':'')+'>Resolved</option></select></td></tr>'
}).join('');
if(!list.length)tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:30px">No tickets found</td></tr>';
}
async function openTicketPN(tid){
var t=tickets.find(function(x){return x.id===tid});if(!t)return;
var rider=users.find(function(u){return u.id===t.user_id});
var st=t.status||'pending';
var badge=st==='pending'?'<span class="badge wrn">Pending</span>':st==='investigate'?'<span class="badge act">Investigate</span>':st==='replied'?'<span class="badge sa">Replied</span>':'<span class="badge on">Resolved</span>';
var typeBadge=t.type==='bug'?'Bug Report':t.type==='suggestion'?'Suggestion':t.type==='lost'?'Lost & Found':'General Inquiry';
var submitted=t.created_at?new Date(t.created_at).toLocaleString():'--';

document.getElementById('pn-title').textContent='Ticket #'+t.id.slice(-6);
document.getElementById('pn-body').innerHTML=
sect('Status',row('Current Status',badge)+row('Type',typeBadge)+row('Submitted',submitted))+
sect('Rider Info',row('Name',rider?rider.name:t.user_name||'Unknown')+row('Email',rider?rider.email||'-':'-')+row('Phone',rider&&rider.phone?'<a href="tel:'+esc(rider.phone)+'" style="color:var(--bl)">'+esc(rider.phone)+'</a>':'-'))+
sect('Message','<div style="padding:12px;background:var(--bg3);border-radius:var(--r);font-size:13px;line-height:1.6;white-space:pre-wrap">'+esc(t.message||'No message')+'</div>')+
sect('Update Status','<select id="tix-status-sel" style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-family:var(--font);margin-bottom:10px"><option value="pending"'+(st==='pending'?' selected':'')+'>Pending</option><option value="investigate"'+(st==='investigate'?' selected':'')+'>Investigate</option><option value="replied"'+(st==='replied'?' selected':'')+'>Replied</option><option value="resolved"'+(st==='resolved'?' selected':'')+'>Resolved</option></select><button class="btn btn-p" style="width:100%" data-xid="'+t.id+'" onclick="updateTicketFromPanel(this.dataset.xid)">Update Status</button>');

document.getElementById('pn-acts').innerHTML='<button class="btn-d" style="background:var(--rdl);color:var(--rd)" data-xid="'+t.id+'" onclick="deleteTicket(this.dataset.xid)">Delete Ticket</button>';
openPN();
}
async function updateTicketStatus(tid,status){
await api('PATCH','tickets','?id=eq.'+encodeURIComponent(tid),{status:status});
await logAct('ticket_'+status,tid);
var t=tickets.find(function(x){return x.id===tid});
if(t)t.status=status;
renderTickets();
updateMetrics();
}
async function updateTicketFromPanel(tid){
var sel=document.getElementById('tix-status-sel');
if(!sel)return;
await updateTicketStatus(tid,sel.value);
closePN();
}
async function deleteTicket(tid){
if(!confirm('Delete this ticket permanently?'))return;
await api('DELETE','tickets','?id=eq.'+encodeURIComponent(tid));
await logAct('delete_ticket',tid);
tickets=tickets.filter(function(t){return t.id!==tid});
renderTickets();
updateMetrics();
closePN();
}

async function saveReply(tid){var replyEl=document.getElementById('tix-reply');if(!replyEl||!replyEl.value.trim())return;var reply=replyEl.value.trim();await api('PATCH','tickets','?id=eq.'+encodeURIComponent(tid),{admin_reply:reply,status:'replied'});await logAct('reply_ticket',tid);var t=tickets.find(function(x){return x.id===tid});if(t){t.admin_reply=reply;t.status='replied'}renderTickets();updateMetrics();openTicketPN(tid)}
