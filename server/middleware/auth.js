const { fail } = require('../utils/responses');

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.accepts('json')) {
    return fail(res, 'Unauthorized: Please log in.', 401, 'AUTH_REQUIRED');
  }
  return res.redirect('/auth.html?mode=login');
}

module.exports = { isAuthenticated };