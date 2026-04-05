// RYDZ Rider - Support Tickets v3
// Dark-theme compatible, blue exclamation icon

var tktType = null;

function renSupport() {
  tktType = null;
  document.getElementById('ms-support').innerHTML = mTop('Support') +
  '<div style="padding:20px">' +

    // Header card — blue exclamation icon, readable on dark
    '<div style="display:flex;align-items:center;gap:14px;padding:18px;background:rgba(30,144,255,.08);border:1px solid rgba(30,144,255,.2);border-radius:18px;margin-bottom:20px">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:var(--bl);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
        '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEJ0lEQVR4nO2aS4gVRxSGq5QMOiCDMgjiK5CFEiMiihvRRUDEJERcKMogupCIRERxMytxRAQxhCCKjIgh5MFAFoZZZKNgsteNceFGF75GRAKJiiMhfi7ubanpe6q7nvcO0j8M3Ok+9f//OdXV1V1dSjVo0KBBgwbZAHwEPMcfY8C8XvsPAjAXGA9I2oajwKxe51ULYEnCpCVcAQZ6nWcHgD7gRubkTZzudc7vAGxxNP0COAEsBz4QePqBjcAlj0J80oucTdM/1Ri8C6yP4N/pUIQDKXPyMfe0wtQ4sCih1mrgnwq986m0XA1VYW1G3W0Vuj/m0i2bsPX8BbowVQGDwD2Lh7O5xW1j/quswrKX77vqBfjMIrgzi6CbpzMWTytTC/VPl54XvF2WjKUWuSlojCYViQDwTPA3korc9njbn0QgAYB5Fo/xL1PA/wLxmgi+by1mAcYjeKUpsnZq1DWkc5VSf5cO/661/jzAYL9S6qVx6JxSakIpNaCUmlRKHTPOLdZaPwzQkMb+bK31pC9XQXhFqOqSQK4C2yuugN3Fj0CNNQLn4RCusukC9yN5Ro3ffZaYq5FF6EAIT7GSU8aGCFM/1BkydIYjCrCbEkJ4FDApFKDjNdaBZ7BsBthqHBotxZv4NNC7cwGsN0Gh4SuttffUF9wDbWitK2/ULppVHDM8eL+JNWJgqTaglLoewFGFvwLadAqX4P18XbrsAf5waLPfaPMopADAF65DwOcKuONrRMAbhxjT07NAnT9dA50LoLX+L8zLFMz0jPk4RERr/Tyk3RT43EldOVx4gNuptavifIaAN9o3uJ9t54HvDJ/FDLPCCHkcMgskQYpeKPFtbFNdtGmk1IzmEfxEr/cZXCPt/80r4LeExZ6fowDrYo1ZeJP1uqFxIEcBvNfesa/eSpiwHH8doDvlMd63fUES3DvAZqH5WPtP5CrF/SK03xfq3bVdmeRaCBEwVBdvUD7FGPtYXn6M87UfRREWcF18S0QLhV7Y7tDOSVTgXuYYX/lGCpz1KUDdklhH46p5uYh3nbtzxAue/9VaW/cU1D0IHRcEgh5PuwHgS+HwrhjCOcKl+qQiHmDMg99rjNJeT6zjK6HPFu8q2nEzBDZ7GEgOi/aIEHokKvk28aBADK0l82kBYJHFY5qPN8gfM24nIU8AS/LpPtrS2gQlobs7M2Rv0s6RmzmEVlmKcDK5mLunWxZPH+YSPGwR7PqXYuy7TzflFh61CD8A5mQVb+kvsOgD7MmtX5j4tcLE1oy6wxW6X+fStZmxXQkFkm1iRH67NLE3lZavsYM1xgCGIvhPOfDnHfMOJlc6mCxwg9Zmq44HFFo7zIeo3oBp4haBn+qzADjtUYhY7Oh1viKAAeTVnFQYZjpuly8DmAUcSpj4tl7n1KBBgwYNGryHeAv9YxgeETw36QAAAABJRU5ErkJggg==" width="24" height="24" style="display:block;object-fit:contain" alt="Support">' +
      '</div>' +
      '<div><p style="font-weight:700;font-size:15px;color:#fff">How can we help?</p>' +
      '<p style="font-size:12px;color:var(--g400);margin-top:2px;font-family:var(--font2)">Submit a ticket or call us directly.</p></div>' +
    '</div>' +

    // Topic selection
    '<h4 style="font-size:12px;font-weight:700;color:var(--g400);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;font-family:var(--font2)">Select a Topic</h4>' +
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
    '<textarea id="tkt-msg" rows="4" placeholder="Describe your issue or feedback..." style="width:100%;padding:12px 14px;border:1.5px solid rgba(255,255,255,.1);border-radius:14px;font-size:14px;font-family:var(--font);color:#fff;background:rgba(255,255,255,.04);outline:none;resize:vertical;transition:border-color .2s" onfocus="this.style.borderColor=\'var(--bl)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.1)\'"></textarea>' +
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
