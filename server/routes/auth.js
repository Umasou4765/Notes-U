const express = require('express');
const bcrypt = require('bcryptjs');
const { success, fail } = require('../utils/responses');
const { isValidEmail, passwordPolicy } = require('../utils/validators');
const { createUser, findUserByUsername, findUserById } = require('../services/userService');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, password, email } = req.body || {};
  if (!username || !password) {
    return fail(res, 'Username and password required.', 400, 'MISSING_FIELDS');
  }
  const pwErr = passwordPolicy(password);
  if (pwErr) return fail(res, pwErr, 400, 'WEAK_PASSWORD');
  if (email && !isValidEmail(email)) {
    return fail(res, 'Invalid email format.', 400, 'INVALID_EMAIL');
  }
  try {
    const existing = await findUserByUsername(username);
    if (existing) return fail(res, 'Username already taken.', 409, 'USERNAME_EXISTS');
    const hash = await bcrypt.hash(password, 10);
    const user = await createUser(username, hash, email || null);
    return success(res, { user }, 'Account created.', 201);
  } catch (err) {
    if (err.code === '23505') {
      return fail(res, 'User with email already exists.', 409, 'EMAIL_EXISTS');
    }
    return fail(res, 'Server error during signup.', 500, 'SERVER_ERROR');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 'Username and password required.', 400, 'MISSING_FIELDS');
  try {
    const user = await findUserByUsername(username);
    if (!user) return fail(res, 'Account not found.', 401, 'NOT_FOUND');
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return fail(res, 'Incorrect password.', 401, 'BAD_CREDENTIALS');
    req.session.userId = user.id;
    return success(res, { redirect: '/home.html' }, 'Login successful.');
  } catch {
    return fail(res, 'Server error during login.', 500, 'SERVER_ERROR');
  }
});

router.get('/user', isAuthenticated, async (req, res) => {
  try {
    const user = await findUserById(req.session.userId);
    if (!user) return fail(res, 'User not found.', 404, 'NOT_FOUND');
    return success(res, { user });
  } catch {
    return fail(res, 'Server error fetching user.', 500, 'SERVER_ERROR');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    return success(res, null, 'Logged out.');
  });
});

module.exports = router;