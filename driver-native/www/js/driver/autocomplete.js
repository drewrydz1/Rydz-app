// RYDZ Driver - Address Autocomplete
// Autocomplete for pickup/dropoff in create ride menu

document.addEventListener('click', function(e) {
  if (!e.target.closest('.cr-fw')) {
    document.querySelectorAll('.cr-acl').forEach(function(d) { d.classList.remove('show') });
  }
});
