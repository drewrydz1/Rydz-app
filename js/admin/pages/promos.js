// RYDZ Admin - Promotions (10 Fixed Slot Control Panel)

var _promoSlots = [];
var _promoDirty = {};

async function loadPromos() {
  var data = await api('GET', 'promotions', '?order=slot_index.asc');
  if (data && data.length) {
    _promoSlots = data;
  } else {
    _promoSlots = [];
    for (var i = 1; i <= 10; i++) {
      _promoSlots.push({ slot_index: i, title: '', description: '', image_url: '', destination_address: '', color: '#007AFF', is_active: false });
    }
  }
  _promoDirty = {};
  renderPromos();
}

function renderPromos() {
  var el = document.getElementById('promo-list');
  if (!el) return;

  var hasDirty = Object.keys(_promoDirty).length > 0;

  var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;grid-column:1/-1">' +
    '<div><span style="font-size:13px;color:var(--tx3)">Edit slots below. Changes push to the Rider app on save.</span></div>' +
    '<button onclick="saveAllPromos()" style="padding:10px 24px;background:' + (hasDirty ? 'var(--gn)' : 'var(--bg3)') + ';color:' + (hasDirty ? '#fff' : 'var(--tx3)') + ';border:none;border-radius:var(--r);font-size:13px;font-weight:700;font-family:var(--font);cursor:pointer;transition:all .2s">' +
      '<span id="promo-save-label">' + (hasDirty ? 'Save & Publish (' + Object.keys(_promoDirty).length + ')' : 'All Saved') + '</span>' +
    '</button>' +
  '</div>';

  var html = header;
  _promoSlots.forEach(function(slot) {
    var i = slot.slot_index;
    var isOn = slot.is_active;
    var isDirty = !!_promoDirty[i];
    var hasImg = slot.image_url && slot.image_url.length > 10;
    var imgPreview = hasImg
      ? '<img src="' + esc(slot.image_url) + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px" onerror="this.style.display=\'none\'">'
      : '<div style="width:100%;height:140px;border-radius:8px;background:' + (slot.color || '#007AFF') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + (slot.title ? esc(slot.title) : 'Slot ' + i) + '</div>';

    html += '<div style="background:var(--bg2);border:1px solid ' + (isDirty ? 'var(--or)' : 'var(--bdr)') + ';border-radius:var(--r2);padding:16px;position:relative">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="background:var(--bl);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px">SLOT ' + i + '</span>' +
          (isDirty ? '<span style="font-size:10px;color:var(--or);font-weight:700">UNSAVED</span>' : '') +
          '<span style="font-size:11px;color:' + (isOn ? 'var(--gn)' : 'var(--tx3)') + ';font-weight:700">' + (isOn ? 'LIVE' : 'OFF') + '</span>' +
        '</div>' +
        '<label style="position:relative;width:44px;height:24px;cursor:pointer;display:block">' +
          '<input type="checkbox" data-slot="' + i + '" ' + (isOn ? 'checked' : '') + ' onchange="markPromoDirty(' + i + ',\'is_active\',this.checked)" style="opacity:0;width:0;height:0;position:absolute">' +
          '<div style="position:absolute;inset:0;border-radius:12px;background:' + (isOn ? 'var(--gn)' : 'var(--bg3)') + ';transition:background .2s"></div>' +
          '<div style="position:absolute;top:2px;left:' + (isOn ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .2s"></div>' +
        '</label>' +
      '</div>' +
      imgPreview +
      '<div style="margin-top:10px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Image URL</label>' +
        '<input type="text" value="' + esc(slot.image_url || '') + '" oninput="markPromoDirty(' + i + ',\'image_url\',this.value)" placeholder="https://..." style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Title</label>' +
        '<input type="text" value="' + esc(slot.title || '') + '" oninput="markPromoDirty(' + i + ',\'title\',this.value)" placeholder="Business name" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-weight:600;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Description</label>' +
        '<textarea oninput="markPromoDirty(' + i + ',\'description\',this.value)" placeholder="Promotion details..." rows="2" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px;resize:vertical">' + esc(slot.description || '') + '</textarea>' +
      '</div>' +
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Destination Address</label>' +
        '<input type="text" value="' + esc(slot.destination_address || '') + '" oninput="markPromoDirty(' + i + ',\'destination_address\',this.value)" placeholder="Full address" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      '<div style="margin-top:8px;display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Color</label>' +
        '<input type="color" value="' + (slot.color || '#007AFF') + '" onchange="markPromoDirty(' + i + ',\'color\',this.value)" style="width:32px;height:24px;border:1px solid var(--bdr);border-radius:4px;cursor:pointer;background:none">' +
      '</div>' +
    '</div>';
  });

  el.innerHTML = html;
}

function markPromoDirty(slotIdx, field, val) {
  // Update local state
  var slot = _promoSlots.find(function(s) { return s.slot_index === slotIdx; });
  if (slot) slot[field] = val;

  // Track dirty
  if (!_promoDirty[slotIdx]) _promoDirty[slotIdx] = {};
  _promoDirty[slotIdx][field] = val;

  // Update save button label
  var btn = document.getElementById('promo-save-label');
  if (btn) btn.textContent = 'Save & Publish (' + Object.keys(_promoDirty).length + ')';

  // Re-render for toggle/image changes
  if (field === 'is_active' || field === 'image_url') renderPromos();
}

async function saveAllPromos() {
  var keys = Object.keys(_promoDirty);
  if (!keys.length) return;

  var btn = document.getElementById('promo-save-label');
  if (btn) btn.textContent = 'Saving...';

  for (var k = 0; k < keys.length; k++) {
    var slotIdx = parseInt(keys[k]);
    var slot = _promoSlots.find(function(s) { return s.slot_index === slotIdx; });
    if (!slot) continue;

    await api('PATCH', 'promotions', '?slot_index=eq.' + slotIdx, {
      title: slot.title || '',
      description: slot.description || '',
      image_url: slot.image_url || '',
      destination_address: slot.destination_address || '',
      color: slot.color || '#007AFF',
      is_active: !!slot.is_active,
      updated_at: new Date().toISOString()
    });
  }

  _promoDirty = {};
  if (btn) btn.textContent = 'Published!';
  setTimeout(function() { renderPromos(); }, 1500);
  await logAct('update_promotions', keys.length + ' slots');
}
