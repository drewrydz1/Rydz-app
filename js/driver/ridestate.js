// RYDZ Driver - Ride State Machine
// Manages ride lifecycle: offline -> waiting -> active -> completed
// State transitions are handled by rideService.js
// This file provides state query helpers

function getRidePhase() {
  var mr = typeof gMR === 'function' ? gMR() : null;
  if (!mr) return 'idle';
  if (mr.status === 'accepted' || mr.status === 'en_route') return 'en_route';
  if (mr.status === 'arrived') return 'at_pickup';
  if (mr.status === 'picked_up') return 'in_transit';
  return 'idle';
}

function isDriverBusy() {
  return typeof gMR === 'function' && gMR() !== null;
}

function hasIncomingRequests() {
  return typeof gIn === 'function' && gIn().length > 0;
}
