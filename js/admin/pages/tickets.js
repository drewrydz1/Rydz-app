// RYDZ Admin - Support Tickets v2
// Full ticket management with rider profiles and admin replies

function renderTickets() {
  var tb = document.getElementById('tix-tbody');
  if (!tb) return;

  var filter = document.getElementById('tix-filter').value;
  var search = (document.getElementById('tix-search').value || '').toLowerCase();
  var list = tickets.slice();

  // Filter by status
  if (filter !== 'all') list = list.filter(function(t) { return (t.status || 'pending') === filter; });

  // Search by rider name, message, or type
  if (search) list = list.filter(function(t) {
    return (t.user_name || '').toLowerCase().indexOf(search) >= 0 ||
      (t.message || '').toLowerCase().indexOf(search) >= 0 ||
      (t.type || '').toLowerCase().indexOf(search) >= 0;
  });

  // Sort: pending first, then by date newest first
  var statusOrder = { pending: 0, investigate: 1, replied: 2, resolved: 3 };
  list.sort(function(a, b) {
    var sa = statusOrder[a.status || 'pending'] || 0;
    var sb = statusOrder[b.status || 'pending'] || 0;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // Stats badges
  var stats = { pending: 0, investigate: 0, replied: 0, resolved: 0 };
  tickets.forEach(function(t) {
    var s = t.status || 'pending';
    if (stats[s] !== undefined) stats[s]++;
  });
  document.getElementById('tix-stats').innerHTML =
    '<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--orl);color:var(--or)">Pending: ' + stats.pending + '</div>' +
    '<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--bld);color:var(--bl)">Investigating: ' + stats.investigate + '</div>' +
    '<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--ppl);color:var(--pp)">Replied: ' + stats.replied + '</div>' +
    '<div style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;background:var(--gnl);color:var(--gn)">Resolved: ' + stats.resolved + '</div>';

  // Render table rows
  tb.innerHTML = list.map(function(t) {
    var st = t.status || 'pending';
    var badge = st === 'pending' ? '<span class="badge wrn">Pending</span>'
      : st === 'investigate' ? '<span class="badge act">Investigating</span>'
      : st === 'replied' ? '<span class="badge sa">Replied</span>'
      : '<span class="badge on">Resolved</span>';

    var typeLabels = { bug: 'Bug', suggestion: 'Suggestion', lost: 'Lost & Found', billing: 'Billing', safety: 'Safety', general: 'General' };
    var typeColors = { bug: 'var(--rd)', suggestion: 'var(--or)', lost: 'var(--gn)', billing: '#8b5cf6', safety: '#ef4444', general: 'var(--bl)' };
    var typeBadge = '<span style="color:' + (typeColors[t.type] || 'var(--bl)') + '">' + (typeLabels[t.type] || 'General') + '</span>';

    var msg = (t.message || '').length > 50 ? (t.message || '').substring(0, 50) + '...' : t.message || '';
    var time = t.created_at ? ago(new Date(t.created_at)) : '--';
    var riderName = t.user_name || 'Unknown';

    return '<tr data-xid="' + t.id + '" onclick="openTicketPN(this.dataset.xid)" style="cursor:pointer">' +
      '<td>' + badge + '</td>' +
      '<td>' + typeBadge + '</td>' +
      '<td><strong>' + esc(riderName) + '</strong></td>' +
      '<td style="color:var(--tx2);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(msg) + '</td>' +
      '<td style="color:var(--tx3);font-size:12px">' + time + '</td>' +
      '<td>' +
        '<select data-xid="' + t.id + '" onclick="event.stopPropagation()" onchange="updateTicketStatus(this.dataset.xid,this.value)" style="padding:4px 8px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:11px;font-family:var(--font)">' +
          '<option value="pending"' + (st === 'pending' ? ' selected' : '') + '>Pending</option>' +
          '<option value="investigate"' + (st === 'investigate' ? ' selected' : '') + '>Investigate</option>' +
          '<option value="replied"' + (st === 'replied' ? ' selected' : '') + '>Replied</option>' +
          '<option value="resolved"' + (st === 'resolved' ? ' selected' : '') + '>Resolved</option>' +
        '</select>' +
      '</td>' +
    '</tr>';
  }).join('');

  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:30px">No tickets found</td></tr>';
  }
}

// Open ticket detail panel with full rider profile
async function openTicketPN(tid) {
  var t = tickets.find(function(x) { return x.id === tid; });
  if (!t) return;

  // Find rider in users
  var rider = users.find(function(u) { return u.id === t.user_id; });

  // Count rider's rides
  var riderRides = rider ? rides.filter(function(r) { return r.rider_id === rider.id; }) : [];
  var completedRides = riderRides.filter(function(r) { return r.status === 'completed'; }).length;
  var cancelledRides = riderRides.filter(function(r) { return r.status === 'cancelled'; }).length;

  var st = t.status || 'pending';
  var badge = st === 'pending' ? '<span class="badge wrn">Pending</span>'
    : st === 'investigate' ? '<span class="badge act">Investigating</span>'
    : st === 'replied' ? '<span class="badge sa">Replied</span>'
    : '<span class="badge on">Resolved</span>';

  var typeLabels = { bug: 'Bug Report', suggestion: 'Suggestion', lost: 'Lost & Found', billing: 'Billing Issue', safety: 'Safety Concern', general: 'General Inquiry' };
  var submitted = t.created_at ? new Date(t.created_at).toLocaleString() : '--';

  document.getElementById('pn-title').textContent = 'Ticket #' + t.id.slice(-6);
  document.getElementById('pn-body').innerHTML =
    // Status section
    sect('Ticket Info',
      row('Status', badge) +
      row('Category', typeLabels[t.type] || 'General') +
      row('Submitted', submitted) +
      row('Ticket ID', '<span style="font-family:monospace;font-size:11px">' + esc(t.id) + '</span>')
    ) +

    // Rider profile section
    sect('Rider Profile',
      row('Name', rider ? esc(rider.name) : esc(t.user_name || 'Unknown')) +
      row('Email', rider && rider.email ? '<a href="mailto:' + esc(rider.email) + '" style="color:var(--bl)">' + esc(rider.email) + '</a>' : '--') +
      row('Phone', rider && rider.phone ? '<a href="tel:' + esc(rider.phone) + '" style="color:var(--bl)">' + esc(rider.phone) + '</a>' : '--') +
      row('Total Rides', riderRides.length) +
      row('Completed', completedRides) +
      row('Cancelled', cancelledRides) +
      row('Member Since', rider && rider.created_at ? new Date(rider.created_at).toLocaleDateString() : '--') +
      row('Account', rider && rider.disabled ? '<span style="color:var(--rd)">Disabled</span>' : '<span style="color:var(--gn)">Active</span>')
    ) +

    // Message section
    sect('Message',
      '<div style="padding:14px;background:var(--bg3);border-radius:var(--r);font-size:13px;line-height:1.7;white-space:pre-wrap;border-left:3px solid var(--bl)">' +
        esc(t.message || 'No message') +
      '</div>'
    ) +

    // Admin reply section
    sect('Admin Reply',
      '<div style="margin-bottom:10px">' +
        (t.admin_reply ? '<div style="padding:12px;background:var(--gnl);border-radius:var(--r);font-size:13px;line-height:1.6;border-left:3px solid var(--gn);margin-bottom:10px">' + esc(t.admin_reply) + '</div>' : '') +
      '</div>' +
      '<textarea id="tix-reply" rows="3" placeholder="Type your reply to the rider..." style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-family:var(--font);resize:vertical;margin-bottom:10px"></textarea>' +
      '<button class="btn btn-p" style="width:100%" data-xid="' + t.id + '" onclick="saveReply(this.dataset.xid)">Save Reply</button>'
    ) +

    // Update status section
    sect('Update Status',
      '<select id="tix-status-sel" style="width:100%;padding:10px 12px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-family:var(--font);margin-bottom:10px">' +
        '<option value="pending"' + (st === 'pending' ? ' selected' : '') + '>Pending</option>' +
        '<option value="investigate"' + (st === 'investigate' ? ' selected' : '') + '>Investigating</option>' +
        '<option value="replied"' + (st === 'replied' ? ' selected' : '') + '>Replied</option>' +
        '<option value="resolved"' + (st === 'resolved' ? ' selected' : '') + '>Resolved</option>' +
      '</select>' +
      '<button class="btn btn-p" style="width:100%" data-xid="' + t.id + '" onclick="updateTicketFromPanel(this.dataset.xid)">Update Status</button>'
    );

  // Bottom actions
  document.getElementById('pn-acts').innerHTML =
    '<button class="btn-d" style="background:var(--rdl);color:var(--rd)" data-xid="' + t.id + '" onclick="deleteTicket(this.dataset.xid)">Delete Ticket</button>';

  openPN();
}

// Save admin reply to ticket
async function saveReply(tid) {
  var replyEl = document.getElementById('tix-reply');
  if (!replyEl || !replyEl.value.trim()) return;

  var reply = replyEl.value.trim();

  await api('PATCH', 'tickets', '?id=eq.' + encodeURIComponent(tid), {
    admin_reply: reply,
    status: 'replied'
  });
  await logAct('reply_ticket', tid);

  var t = tickets.find(function(x) { return x.id === tid; });
  if (t) {
    t.admin_reply = reply;
    t.status = 'replied';
  }

  renderTickets();
  updateMetrics();
  openTicketPN(tid); // Refresh the panel to show saved reply
}

// Update ticket status from table dropdown
async function updateTicketStatus(tid, status) {
  await api('PATCH', 'tickets', '?id=eq.' + encodeURIComponent(tid), { status: status });
  await logAct('ticket_' + status, tid);
  var t = tickets.find(function(x) { return x.id === tid; });
  if (t) t.status = status;
  renderTickets();
  updateMetrics();
}

// Update ticket status from detail panel
async function updateTicketFromPanel(tid) {
  var sel = document.getElementById('tix-status-sel');
  if (!sel) return;
  await updateTicketStatus(tid, sel.value);
  closePN();
}

// Delete ticket
async function deleteTicket(tid) {
  if (!confirm('Delete this ticket permanently?')) return;
  await api('DELETE', 'tickets', '?id=eq.' + encodeURIComponent(tid));
  await logAct('delete_ticket', tid);
  tickets = tickets.filter(function(t) { return t.id !== tid; });
  renderTickets();
  updateMetrics();
  closePN();
}
