// RYDZ Rider - Local Storage
// Read/write localStorage, default data factory

async function ld() {
  try {
    var v = localStorage.getItem('rydz-db');
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

async function sv() {
  try {
    localStorage.setItem('rydz-db', JSON.stringify(db));
  } catch (e) {
    logError('sv', 'localStorage save failed: ' + e);
  }
}

function ddb() {
  return {
    users: [
      typeof TEST_ACCT !== 'undefined' ? TEST_ACCT : { id: 'r-test', role: 'rider', name: 'Test User', email: 'test', password: '1' },
      { id: 'd1', role: 'driver', name: 'Mike Thompson', status: 'offline', vehicle: 'Gem Electric Shuttle', plate: 'RYDZ-001' },
      { id: 'd2', role: 'driver', name: 'Sarah Chen', status: 'offline', vehicle: 'Gem Electric Shuttle', plate: 'RYDZ-002' },
      { id: 'd3', role: 'driver', name: 'Carlos Ruiz', status: 'offline', vehicle: 'Gem Electric Shuttle', plate: 'RYDZ-003' },
      { id: 'a1', role: 'admin', name: 'Admin' }
    ],
    rides: [],
    settings: {
      serviceStatus: true,
      hours: {
        sun: { open: '12:00', close: '21:00' },
        mon: { open: '12:00', close: '21:00' },
        tue: { open: '12:00', close: '21:00' },
        wed: { open: '12:00', close: '21:00' },
        thu: { open: '12:00', close: '21:00' },
        fri: { open: '12:00', close: '22:00' },
        sat: { open: '12:00', close: '22:00' }
      },
      maxPassengers: 5,
      announcements: [],
      serviceArea: 'Naples, FL',
      promotions: typeof PROMOS !== 'undefined' ? PROMOS.map(function(p) { return Object.assign({}, p); }) : []
    },
    tickets: []
  };
}
