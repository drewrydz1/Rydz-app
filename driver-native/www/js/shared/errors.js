// RYDZ Shared - Error Reporting
// Centralized error logging with optional user-visible toast

var _errorLog = [];

function logError(source, message) {
  var entry = {
    time: new Date().toISOString(),
    source: source,
    message: String(message).substring(0, 500),
    version: typeof RYDZ_VERSION !== 'undefined' ? RYDZ_VERSION : 'unknown'
  };
  _errorLog.push(entry);
  if (_errorLog.length > 50) _errorLog.shift();
  console.error('[RYDZ ' + entry.source + '] ' + entry.message);
}

function getErrorLog() {
  return _errorLog.slice();
}

function showError(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
  } else {
    console.error('[RYDZ UI] ' + msg);
  }
}
