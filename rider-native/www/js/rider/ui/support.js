// RYDZ Rider - Support Tickets v4
// Includes Report User/Driver flow for Apple App Store compliance (Guideline 1.2)

var tktType = null;

function renSupport() {
  tktType = null;
  document.getElementById('ms-support').innerHTML = mTop('Support') +
  '<div style="padding:20px">' +

    // Header card
    '<div style="display:flex;align-items:center;gap:14px;padding:18px;background:rgba(30,144,255,.08);border:1px solid rgba(30,144,255,.2);border-radius:18px;margin-bottom:20px">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:var(--bl);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
      '</div>' +
      '<div><p style="font-weight:700;font-size:15px;color:#fff">How can we help?</p>' +
      '<p style="font-size:12px;color:var(--g400);margin-top:2px;font-family:var(--font2)">Submit a ticket, report a concern, or call us.</p></div>' +
    '</div>' +

    // Topic selection
    '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">General Support</h4>' +
    '<div id="tkt-cats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
      _tktCatBtn('general', 'General', 'var(--bl)', '<circle cx="8" cy="8" r="6.5"/><path d="M8 10.5v-2M8 6h.01"/>') +
      _tktCatBtn('bug', 'App Bug', 'var(--rd)', '<path d="M4 4l8 8M12 4l-8 8"/>') +
      _tktCatBtn('suggestion', 'Suggestion', 'var(--or)', '<path d="M8 1v4M8 11v4M1 8h4M11 8h4"/>') +
      _tktCatBtn('billing', 'Billing', '#8b5cf6', '<rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 7h12"/>') +
      _tktCatBtn('safety', 'Safety', '#ef4444', '<path d="M8 1L1 14h14L8 1z"/><path d="M8 10V7M8 12h.01"/>') +
      _tktCatBtn('lost', 'Lost & Found', 'var(--gn)', '<path d="M5 3a6 6 0 016 6M8 12.5V15M5 15h6"/>') +
    '</div>' +

    '<div id="tkt-cat-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-bottom:8px">Please select a topic</div>' +

    // Message
    '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Your Message</h4>' +
    '<textarea id="tkt-msg" rows="4" placeholder="Describe your issue or feedback..." style="width:100%;padding:12px 14px;border:1.5px solid rgba(255,255,255,.1);border-radius:14px;font-size:14px;font-family:var(--font);color:#fff;background:rgba(255,255,255,.04);outline:none;resize:vertical;transition:border-color .2s;box-sizing:border-box" onfocus="this.style.borderColor=\'var(--bl)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.1)\'"></textarea>' +
    '<div id="tkt-msg-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-top:4px">Message must be at least 3 characters</div>' +

    '<div id="tkt-ok" style="display:none;padding:14px;border-radius:14px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:var(--gn);font-size:13px;font-weight:600;text-align:center;margin:12px 0"></div>' +

    '<button class="btn btn-p btn-lg btn-w" style="margin-top:12px" onclick="submitTkt()">Submit Ticket</button>' +

    // Phone support
    '<div style="margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.07)">' +
      '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Phone Support</h4>' +
      '<a href="tel:2395557993" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:16px;text-decoration:none;color:#fff;transition:background .12s">' +
        '<div style="width:42px;height:42px;border-radius:12px;background:rgba(34,197,94,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<svg width="18" height="18" fill="none" stroke="var(--gn)" stroke-width="2"><path d="M1 2.5A1.5 1.5 0 012.5 1h2.6a1 1 0 01.95.68l.9 2.7a1 1 0 01-.27 1l-1.2 1.2a10 10 0 005 5l1.2-1.2a1 1 0 011-.27l2.7.9a1 1 0 01.68.95v2.6A1.5 1.5 0 0114.5 16 13.5 13.5 0 011 2.5z"/></svg>' +
        '</div>' +
        '<div style="flex:1"><p style="font-weight:700;font-size:14px;color:#fff">(239) 555-RYDZ</p>' +
        '<p style="font-size:12px;color:var(--g400);margin-top:1px;font-family:var(--font2)">Available during service hours</p></div>' +
        '<svg width="16" height="16" fill="none" stroke="var(--g400)" stroke-width="2" stroke-linecap="round"><path d="M6 3l5 5-5 5"/></svg>' +
      '</a>' +
    '</div>' +
  '</div>';
}

// ── Report User/Driver Flow (Apple Guideline 1.2 compliance) ──

var _reportReason = null;

function openReportUser() {
  var el = document.getElementById('ms-support');
  el.innerHTML = mTop('Report a User') +
  '<div style="padding:20px">' +

    // Warning header
    '<div style="display:flex;align-items:center;gap:14px;padding:18px;background:rgba(255,69,58,.06);border:1px solid rgba(255,69,58,.15);border-radius:18px;margin-bottom:24px">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,69,58,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
      '</div>' +
      '<div><p style="font-weight:700;font-size:15px;color:#fff">Report Inappropriate Behavior</p>' +
      '<p style="font-size:12px;color:var(--g400);margin-top:2px;font-family:var(--font2)">All reports are reviewed by our safety team within 24 hours. The reported user will not know who filed the report.</p></div>' +
    '</div>' +

    // Reason selection
    '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Reason for Report</h4>' +
    '<div id="rpt-reasons" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' +
      _rptReasonBtn('harassment', 'Harassment or Intimidation', 'Verbal abuse, threats, or aggressive behavior') +
      _rptReasonBtn('unsafe_driving', 'Unsafe Driving', 'Reckless driving, speeding, or distracted driving') +
      _rptReasonBtn('inappropriate', 'Inappropriate Conduct', 'Unwanted contact, inappropriate comments, or gestures') +
      _rptReasonBtn('discrimination', 'Discrimination', 'Discriminatory behavior based on race, gender, etc.') +
      _rptReasonBtn('intoxication', 'Intoxicated Driver', 'Driver appeared to be under the influence') +
      _rptReasonBtn('other', 'Other Safety Concern', 'Any other issue that made you feel unsafe') +
    '</div>' +

    '<div id="rpt-reason-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-bottom:8px">Please select a reason</div>' +

    // Details
    '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Details</h4>' +
    '<textarea id="rpt-details" rows="4" placeholder="Please describe what happened..." style="width:100%;padding:12px 14px;border:1.5px solid rgba(255,255,255,.1);border-radius:14px;font-size:14px;font-family:var(--font);color:#fff;background:rgba(255,255,255,.04);outline:none;resize:vertical;transition:border-color .2s;box-sizing:border-box" onfocus="this.style.borderColor=\'var(--rd)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.1)\'"></textarea>' +
    '<div id="rpt-detail-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-top:4px">Please provide details (at least 10 characters)</div>' +

    // Block user toggle
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;margin-top:16px">' +
      '<div><p style="font-size:14px;font-weight:600;color:#fff">Block this user</p>' +
      '<p style="font-size:12px;color:var(--g400);margin-top:2px;font-family:var(--font2)">Prevent being matched in the future</p></div>' +
      '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0">' +
        '<input type="checkbox" id="rpt-block" checked style="opacity:0;width:0;height:0">' +
        '<span onclick="this.previousElementSibling.checked=!this.previousElementSibling.checked;this.style.background=this.previousElementSibling.checked?\'var(--bl)\':\'rgba(255,255,255,.15)\'" style="position:absolute;cursor:pointer;inset:0;background:var(--bl);border-radius:28px;transition:background .2s"><span style="position:absolute;height:22px;width:22px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:transform .2s"></span></span>' +
      '</label>' +
    '</div>' +

    '<div id="rpt-ok" style="display:none;padding:14px;border-radius:14px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:var(--gn);font-size:13px;font-weight:600;text-align:center;margin:16px 0"></div>' +

    '<button class="btn btn-w" style="margin-top:16px;padding:16px;border-radius:14px;font-size:15px;font-weight:700;background:#ff453a;color:#fff;border:none" onclick="submitReport()">Submit Report</button>' +

    '<p style="font-size:11px;color:var(--g400);text-align:center;margin-top:12px;font-family:var(--font2)">If you are in immediate danger, please call 911.</p>' +
  '</div>';
  _reportReason = null;
}

function _rptReasonBtn(type, title, desc) {
  return '<button class="rpt-reason" data-type="' + type + '" onclick="pickRptReason(this,\'' + type + '\')" style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:14px;border:1.5px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;font-family:var(--font);transition:all .15s;text-align:left;width:100%">' +
    '<div style="width:8px;height:8px;border-radius:50%;border:2px solid rgba(255,255,255,.2);flex-shrink:0;transition:all .15s" class="rpt-dot"></div>' +
    '<div><span style="font-size:14px;font-weight:600;color:#fff;display:block">' + title + '</span>' +
    '<span style="font-size:11px;color:var(--g400);font-family:var(--font2)">' + desc + '</span></div>' +
  '</button>';
}

function pickRptReason(el, type) {
  _reportReason = type;
  document.querySelectorAll('.rpt-reason').forEach(function(b) {
    b.style.borderColor = 'rgba(255,255,255,.08)';
    b.style.background = 'rgba(255,255,255,.03)';
    var dot = b.querySelector('.rpt-dot');
    if (dot) { dot.style.borderColor = 'rgba(255,255,255,.2)'; dot.style.background = 'transparent'; }
  });
  el.style.borderColor = 'rgba(255,69,58,.4)';
  el.style.background = 'rgba(255,69,58,.06)';
  var dot = el.querySelector('.rpt-dot');
  if (dot) { dot.style.borderColor = '#ff453a'; dot.style.background = '#ff453a'; }
  var err = document.getElementById('rpt-reason-err');
  if (err) err.style.display = 'none';
}

async function submitReport() {
  var reasonErr = document.getElementById('rpt-reason-err');
  var detailErr = document.getElementById('rpt-detail-err');
  var details = document.getElementById('rpt-details');
  var ok = document.getElementById('rpt-ok');
  var blockEl = document.getElementById('rpt-block');

  if (reasonErr) reasonErr.style.display = 'none';
  if (detailErr) detailErr.style.display = 'none';
  if (details) details.style.borderColor = 'rgba(255,255,255,.1)';

  if (!_reportReason) {
    if (reasonErr) reasonErr.style.display = 'block';
    return;
  }
  if (!details || details.value.trim().length < 10) {
    if (detailErr) detailErr.style.display = 'block';
    if (details) details.style.borderColor = 'var(--rd)';
    return;
  }

  var shouldBlock = blockEl ? blockEl.checked : false;

  // Build the report ticket
  var ticket = {
    id: 'rpt-' + Date.now(),
    type: 'report_user',
    reason: _reportReason,
    message: '[REPORT: ' + _reportReason.toUpperCase() + '] ' + details.value.trim(),
    blocked: shouldBlock,
    userId: curUser ? curUser.id : '',
    userName: curUser ? curUser.name : '',
    userEmail: curUser ? curUser.email : '',
    userPhone: curUser ? curUser.phone : '',
    rideId: (typeof arId !== 'undefined' && arId) ? arId : '',
    createdAt: Date.now()
  };

  if (!db.tickets) db.tickets = [];
  db.tickets.push(ticket);
  try { await sv(); } catch (e) {}
  supaSaveTicket(ticket);

  // If block requested, save to blocked list
  if (shouldBlock && curUser) {
    if (!curUser.blockedUsers) curUser.blockedUsers = [];
    // Find the driver from the most recent ride
    var recentRide = db.rides.find(function(r) { return r.riderId === curUser.id && r.driverId; });
    if (recentRide && recentRide.driverId && curUser.blockedUsers.indexOf(recentRide.driverId) === -1) {
      curUser.blockedUsers.push(recentRide.driverId);
      var u = db.users.find(function(x) { return x.id === curUser.id; });
      if (u) u.blockedUsers = curUser.blockedUsers;
      try { await sv(); } catch (e) {}
      if (typeof supaUpdateUser === 'function') supaUpdateUser(curUser);
    }
  }

  details.value = '';
  _reportReason = null;
  document.querySelectorAll('.rpt-reason').forEach(function(b) {
    b.style.borderColor = 'rgba(255,255,255,.08)';
    b.style.background = 'rgba(255,255,255,.03)';
    var dot = b.querySelector('.rpt-dot');
    if (dot) { dot.style.borderColor = 'rgba(255,255,255,.2)'; dot.style.background = 'transparent'; }
  });

  if (ok) {
    ok.textContent = 'Report submitted. Our safety team will review this within 24 hours. Thank you for helping keep Rydz safe.';
    ok.style.display = 'block';
    setTimeout(function() { ok.style.display = 'none'; }, 5000);
  }
}

function _tktCatBtn(type, label, color, svgPath) {
  return '<button class="tkt-cat" data-type="' + type + '" onclick="pickTkt(this,\'' + type + '\')" style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;font-family:var(--font);transition:all .15s">' +
    '<svg width="16" height="16" fill="none" stroke="' + color + '" stroke-width="2">' + svgPath + '</svg>' +
    '<span style="font-size:12px;font-weight:600;color:#fff">' + label + '</span>' +
  '</button>';
}

function pickTkt(el, type) {
  tktType = type;
  document.querySelectorAll('.tkt-cat').forEach(function(b) {
    b.style.borderColor = 'rgba(255,255,255,.1)';
    b.style.background = 'rgba(255,255,255,.04)';
  });
  el.style.borderColor = 'var(--bl)';
  el.style.background = 'rgba(30,144,255,.1)';
  var catErr = document.getElementById('tkt-cat-err');
  if (catErr) catErr.style.display = 'none';
}

async function submitTkt() {
  var catErr = document.getElementById('tkt-cat-err');
  var msgErr = document.getElementById('tkt-msg-err');
  var msg = document.getElementById('tkt-msg');
  var ok = document.getElementById('tkt-ok');

  if (catErr) catErr.style.display = 'none';
  if (msgErr) msgErr.style.display = 'none';
  if (msg) msg.style.borderColor = 'rgba(255,255,255,.1)';

  if (!tktType) {
    if (catErr) catErr.style.display = 'block';
    return;
  }
  if (!msg || msg.value.trim().length < 3) {
    if (msgErr) msgErr.style.display = 'block';
    if (msg) msg.style.borderColor = 'var(--rd)';
    return;
  }

  var ticket = {
    id: 'tkt-' + Date.now(),
    type: tktType,
    message: msg.value.trim(),
    userId: curUser ? curUser.id : '',
    userName: curUser ? curUser.name : '',
    userEmail: curUser ? curUser.email : '',
    userPhone: curUser ? curUser.phone : '',
    createdAt: Date.now()
  };

  if (!db.tickets) db.tickets = [];
  db.tickets.push(ticket);
  try { await sv(); } catch (e) {}
  supaSaveTicket(ticket);

  msg.value = '';
  tktType = null;
  document.querySelectorAll('.tkt-cat').forEach(function(b) {
    b.style.borderColor = 'rgba(255,255,255,.1)';
    b.style.background = 'rgba(255,255,255,.04)';
  });

  if (ok) {
    ok.textContent = 'Your ticket has been submitted. Our team will reach out to you soon.';
    ok.style.display = 'block';
    setTimeout(function() { ok.style.display = 'none'; }, 4000);
  }
}
