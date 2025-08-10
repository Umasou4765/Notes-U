function success(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}
function fail(res, message = 'Error', status = 400, code = null, extra = {}) {
  return res.status(status).json({ success: false, error: { message, code, ...extra } });
}
module.exports = { success, fail };