// RYDZ Admin - Promotions (10 Fixed Slot Control Panel)

var _promoSlots = [];
var _promoDebounce = {};

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
  renderPromos();
}

function renderPromos() {
  var el = document.getElementById('promo-list');
  if (!el) return;

  var html = '';
  _promoSlots.forEach(function(slot) {
    var i = slot.slot_index;
    var isOn = slot.is_active;
    var hasImg = slot.image_url && slot.image_url.length > 10;
    var imgPreview = hasImg
      ? '<img src="' + esc(slot.image_url) + '" style="width:100%;height:140px;object-fit:cover;border-radius:8px" onerror="this.style.display=\'none\'">'
      : '<div style="width:100%;height:140px;border-radius:8px;background:' + (slot.color || '#007AFF') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px">' + (slot.title ? esc(slot.title) : 'Slot ' + i) + '</div>';

    html += '<div class="promo-slot-card" style="background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r2);padding:16px;position:relative">' +
      // Slot badge + active toggle
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="background:var(--bl);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px">SLOT ' + i + '</span>' +
          '<span style="font-size:11px;color:' + (isOn ? 'var(--gn)' : 'var(--tx3)') + ';font-weight:700">' + (isOn ? 'LIVE' : 'OFF') + '</span>' +
        '</div>' +
        '<label style="position:relative;width:44px;height:24px;cursor:pointer">' +
          '<input type="checkbox" data-slot="' + i + '" ' + (isOn ? 'checked' : '') + ' onchange="togglePromoSlot(' + i + ',this.checked)" style="opacity:0;width:0;height:0;position:absolute">' +
          '<div style="position:absolute;inset:0;border-radius:12px;background:' + (isOn ? 'var(--gn)' : 'var(--bg3)') + ';transition:background .2s"></div>' +
          '<div style="position:absolute;top:2px;left:' + (isOn ? '22px' : '2px') + ';width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:left .2s"></div>' +
        '</label>' +
      '</div>' +
      // Image preview
      imgPreview +
      // Image URL input
      '<div style="margin-top:10px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Image URL</label>' +
        '<input type="text" value="' + esc(slot.image_url || '') + '" data-slot="' + i + '" data-field="image_url" oninput="debouncePromo(' + i + ',\'image_url\',this.value)" placeholder="https://... or leave empty for color" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      // Title
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Title</label>' +
        '<input type="text" value="' + esc(slot.title || '') + '" data-slot="' + i + '" data-field="title" oninput="debouncePromo(' + i + ',\'title\',this.value)" placeholder="Business name" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:13px;font-weight:600;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      // Description
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Description</label>' +
        '<textarea data-slot="' + i + '" data-field="description" oninput="debouncePromo(' + i + ',\'description\',this.value)" placeholder="Promotion details..." rows="2" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px;resize:vertical">' + esc(slot.description || '') + '</textarea>' +
      '</div>' +
      // Destination Address
      '<div style="margin-top:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Destination Address</label>' +
        '<input type="text" value="' + esc(slot.destination_address || '') + '" data-slot="' + i + '" data-field="destination_address" oninput="debouncePromo(' + i + ',\'destination_address\',this.value)" placeholder="Full address for Take Me There" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tx);font-size:12px;font-family:var(--font);margin-top:4px">' +
      '</div>' +
      // Color
      '<div style="margin-top:8px;display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Color</label>' +
        '<input type="color" value="' + (slot.color || '#007AFF') + '" data-slot="' + i + '" data-field="color" onchange="savePromoField(' + i + ',\'color\',this.value)" style="width:32px;height:24px;border:1px solid var(--bdr);border-radius:4px;cursor:pointer;background:none">' +
        '<span style="font-size:11px;color:var(--tx3);font-family:monospace">' + esc(slot.color || '#007AFF') + '</span>' +
      '</div>' +
    '</div>';
  });

  el.innerHTML = html;
}

function togglePromoSlot(slotIdx, val) {
  savePromoField(slotIdx, 'is_active', val);
}

function debouncePromo(slotIdx, field, val) {
  var key = slotIdx + '-' + field;
  if (_promoDebounce[key]) clearTimeout(_promoDebounce[key]);
  _promoDebounce[key] = setTimeout(function() {
    savePromoField(slotIdx, field, val);
  }, 800);
}

async function savePromoField(slotIdx, field, val) {
  var update = { updated_at: new Date().toISOString() };
  update[field] = val;

  var result = await api('PATCH', 'promotions', '?slot_index=eq.' + slotIdx, update);

  // Update local state
  var slot = _promoSlots.find(function(s) { return s.slot_index === slotIdx; });
  if (slot) slot[field] = val;

  // Re-render for toggle/color/image changes
  if (field === 'is_active' || field === 'color' || field === 'image_url') {
    renderPromos();
  }
}
