// RYDZ Rider - Support Tickets v2
// Ticket submission with category selection and validation

var tktType = null; // Must select a category

function renSupport() {
  tktType = null; // Reset on open
  document.getElementById('ms-support').innerHTML = mTop('Support') +
  '<div style="padding:20px">' +
    // Header card
    '<div style="display:flex;align-items:center;gap:12px;padding:16px;background:linear-gradient(135deg,var(--nv),var(--nv2));border-radius:var(--r2);margin-bottom:18px;color:var(--w)">' +
      '<svg width="20" height="20" fill="none" stroke="var(--cy)" stroke-width="2"><circle cx="10" cy="10" r="8.5"/><path d="M10 13v-2M10 8h.01"/></svg>' +
      '<div><p style="font-weight:700;font-size:14px">How can we help?</p>' +
      '<p style="font-size:12px;opacity:.5;margin-top:1px;font-family:var(--font2)">Submit a ticket or call us directly.</p></div>' +
    '</div>' +

    // Topic selection
    '<h4 style="font-size:13px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Select a Topic</h4>' +
    '<div id="tkt-cats" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
      _tktCatBtn('general', 'General', 'var(--bl)', '<circle cx="8" cy="8" r="6.5"/><path d="M8 10.5v-2M8 6h.01"/>') +
      _tktCatBtn('bug', 'App Bug', 'var(--rd)', '<path d="M4 4l8 8M12 4l-8 8"/>') +
      _tktCatBtn('suggestion', 'Suggestion', 'var(--or)', '<path d="M8 1v4M8 11v4M1 8h4M11 8h4"/>') +
      _tktCatBtn('billing', 'Billing', '#8b5cf6', '<rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M2 7h12"/>') +
      _tktCatBtn('safety', 'Safety', '#ef4444', '<path d="M8 1L1 14h14L8 1z"/><path d="M8 10V7M8 12h.01"/>') +
      _tktCatBtn('lost', 'Lost & Found', 'var(--gn)', '<path d="M5 3a6 6 0 016 6M8 12.5V15M5 15h6"/>') +
    '</div>' +

    // Error for no category selected
    '<div id="tkt-cat-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-bottom:8px">Please select a topic</div>' +

    // Message
    '<h4 style="font-size:13px;font-weight:700;color:var(--g400);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Your Message</h4>' +
    '<textarea id="tkt-msg" rows="4" placeholder="Describe your issue or feedback (min 3 characters)..." style="width:100%;padding:12px 14px;border:1.5px solid var(--g200);border-radius:var(--r);font-size:14px;font-family:var(--font);color:var(--g800);outline:none;resize:vertical;transition:border-color .2s" onfocus="this.style.borderColor=\'var(--bl)\'" onblur="this.style.borderColor=\'var(--g200)\'"></textarea>' +
    '<div id="tkt-msg-err" style="display:none;color:var(--rd);font-size:12px;font-weight:600;margin-top:4px">Message must be at least 3 characters</div>' +

    // Success message
    '<div id="tkt-ok" style="display:none;padding:14px;border-radius:var(--r);background:var(--gnl);color:var(--gn);font-size:13px;font-weight:600;text-align:center;margin:12px 0"></div>' +

    // Submit button
    '<button class="btn btn-p btn-lg btn-w" style="margin-top:12px" onclick="submitTkt()">Submit Ticket</button>' +

    // Phone support
    '<div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--g150)">' +
      '<h4 style="font-size:13px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Phone Support</h4>' +
      '<a href="tel:2395557993" style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--g50);border:1px solid var(--g150);border-radius:var(--r2);text-decoration:none;color:var(--g800);transition:background .12s">' +
        '<div style="width:42px;height:42px;border-radius:12px;background:var(--gnl);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          '<svg width="18" height="18" fill="none" stroke="var(--gn)" stroke-width="2"><path d="M1 2.5A1.5 1.5 0 012.5 1h2.6a1 1 0 01.95.68l.9 2.7a1 1 0 01-.27 1l-1.2 1.2a10 10 0 005 5l1.2-1.2a1 1 0 011-.27l2.7.9a1 1 0 01.68.95v2.6A1.5 1.5 0 0114.5 16 13.5 13.5 0 011 2.5z"/></svg>' +
        '</div>' +
        '<div style="flex:1"><p style="font-weight:700;font-size:14px">(239) 555-RYDZ</p>' +
        '<p style="font-size:12px;color:var(--g400);margin-top:1px;font-family:var(--font2)">Available during service hours</p></div>' +
        '<svg width="16" height="16" fill="none" stroke="var(--g400)" stroke-width="2" stroke-linecap="round"><path d="M6 3l5 5-5 5"/></svg>' +
      '</a>' +
    '</div>' +
  '</div>';
}

// Generate a category button
function _tktCatBtn(type, label, color, svgPath) {
  return '<button class="tkt-cat" data-type="' + type + '" onclick="pickTkt(this,\'' + type + '\')" style="display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;border:1.5px solid var(--g200);background:var(--w);cursor:pointer;font-family:var(--font);transition:all .15s">' +
    '<svg width="16" height="16" fill="none" stroke="' + color + '" stroke-width="2">' + svgPath + '</svg>' +
    '<span style="font-size:12px;font-weight:600;color:var(--g800)">' + label + '</span>' +
  '</button>';
}

// Select a category
function pickTkt(el, type) {
  tktType = type;
  document.querySelectorAll('.tkt-cat').forEach(function(b) {
    b.style.borderColor = 'var(--g200)';
    b.style.background = 'var(--w)';
  });
  el.style.borderColor = 'var(--bl)';
  el.style.background = 'var(--blp)';
  // Clear category error
  var catErr = document.getElementById('tkt-cat-err');
  if (catErr) catErr.style.display = 'none';
}

// Submit ticket with validation
async function submitTkt() {
  var catErr = document.getElementById('tkt-cat-err');
  var msgErr = document.getElementById('tkt-msg-err');
  var msg = document.getElementById('tkt-msg');
  var ok = document.getElementById('tkt-ok');

  // Reset errors
  if (catErr) catErr.style.display = 'none';
  if (msgErr) msgErr.style.display = 'none';
  if (msg) msg.style.borderColor = 'var(--g200)';

  // Validate: category required
  if (!tktType) {
    if (catErr) catErr.style.display = 'block';
    return;
  }

  // Validate: message minimum 3 characters
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

  // Clear form
  msg.value = '';
  tktType = null;
  document.querySelectorAll('.tkt-cat').forEach(function(b) {
    b.style.borderColor = 'var(--g200)';
    b.style.background = 'var(--w)';
  });

  // Show success
  if (ok) {
    ok.textContent = 'Your ticket has been submitted. Our team will reach out to you soon.';
    ok.style.display = 'block';
    setTimeout(function() { ok.style.display = 'none'; }, 4000);
  }
}
