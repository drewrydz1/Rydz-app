// RYDZ Admin - Analytics Page

function renderAnalytics() {
  buildPassengerChart();
}

function buildPassengerChart() {
  var container = document.getElementById('ana-chart');
  if (!container) return;

  // Build last 30 days array
  var days = [];
  var now = new Date();
  for (var i = 29; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({
      date: d,
      label: (d.getMonth() + 1) + '/' + d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      fullLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      passengers: 0
    });
  }

  // Tally passengers from completed rides
  var completedRides = rides.filter(function(r) {
    return r.status === 'completed' && r.created_at;
  });

  completedRides.forEach(function(r) {
    var rd = new Date(r.created_at);
    var rKey = rd.getFullYear() + '-' + rd.getMonth() + '-' + rd.getDate();
    for (var i = 0; i < days.length; i++) {
      var dk = days[i].date.getFullYear() + '-' + days[i].date.getMonth() + '-' + days[i].date.getDate();
      if (rKey === dk) {
        days[i].passengers += (parseInt(r.passengers) || 1);
        break;
      }
    }
  });

  // Find max for scaling
  var maxVal = 0;
  var total = 0;
  for (var i = 0; i < days.length; i++) {
    if (days[i].passengers > maxVal) maxVal = days[i].passengers;
    total += days[i].passengers;
  }
  if (maxVal === 0) maxVal = 1; // prevent division by zero

  var avg = (total / 30).toFixed(1);

  // Y-axis labels (5 ticks)
  var yTicks = [];
  var step = Math.ceil(maxVal / 4);
  if (step < 1) step = 1;
  for (var t = 0; t <= 4; t++) {
    yTicks.push(t * step);
  }
  var yMax = yTicks[4];
  if (yMax < maxVal) yMax = maxVal;

  // Build HTML
  var html = '';

  // Summary cards
  html += '<div class="ana-summary">';
  html += '<div class="ana-stat"><div class="ana-stat-val" style="color:var(--bl)">' + total + '</div><div class="ana-stat-lbl">Total Passengers</div></div>';
  html += '<div class="ana-stat"><div class="ana-stat-val" style="color:var(--cy)">' + avg + '</div><div class="ana-stat-lbl">Daily Average</div></div>';
  html += '<div class="ana-stat"><div class="ana-stat-val" style="color:var(--gn)">' + maxVal + '</div><div class="ana-stat-lbl">Peak Day</div></div>';
  html += '<div class="ana-stat"><div class="ana-stat-val" style="color:var(--pp)">' + completedRides.length + '</div><div class="ana-stat-lbl">Completed Rides</div></div>';
  html += '</div>';

  // Chart
  html += '<div class="ana-chart-wrap">';

  // Y-axis
  html += '<div class="ana-y-axis">';
  for (var y = yTicks.length - 1; y >= 0; y--) {
    html += '<div class="ana-y-label">' + yTicks[y] + '</div>';
  }
  html += '</div>';

  // Bars area
  html += '<div class="ana-bars-area">';

  // Gridlines
  for (var y = 0; y < yTicks.length; y++) {
    var gPos = yMax > 0 ? ((yTicks[y] / yMax) * 100) : 0;
    html += '<div class="ana-gridline" style="bottom:' + gPos + '%"></div>';
  }

  // Bars
  html += '<div class="ana-bars">';
  for (var i = 0; i < days.length; i++) {
    var pct = yMax > 0 ? ((days[i].passengers / yMax) * 100) : 0;
    var isToday = i === 29;
    var barClass = 'ana-bar' + (isToday ? ' today' : '') + (days[i].passengers === 0 ? ' empty' : '');

    html += '<div class="ana-bar-col" data-idx="' + i + '">';
    html += '<div class="ana-tooltip">';
    html += '<div class="ana-tt-date">' + days[i].fullLabel + '</div>';
    html += '<div class="ana-tt-val">' + days[i].passengers + ' passenger' + (days[i].passengers !== 1 ? 's' : '') + '</div>';
    html += '</div>';
    html += '<div class="' + barClass + '" style="height:' + pct + '%"></div>';
    html += '<div class="ana-bar-lbl">' + days[i].label + '</div>';
    html += '</div>';
  }
  html += '</div>'; // ana-bars

  html += '</div>'; // ana-bars-area
  html += '</div>'; // ana-chart-wrap

  container.innerHTML = html;

  // Click handler for mobile tap
  container.addEventListener('click', function(e) {
    var col = e.target.closest('.ana-bar-col');
    if (!col) return;
    // Remove active from all
    container.querySelectorAll('.ana-bar-col').forEach(function(c) { c.classList.remove('active'); });
    col.classList.add('active');
  });
}
