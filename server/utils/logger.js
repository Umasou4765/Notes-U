function log(...args) {
  console.log('[LOG]', ...args);
}
function warn(...args) {
  console.warn('[WARN]', ...args);
}
function error(...args) {
  console.error('[ERROR]', ...args);
}
module.exports = { log, warn, error };