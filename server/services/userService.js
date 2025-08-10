const pool = require('../db/pool');

async function findUserByUsername(username) {
  const r = await pool.query(
    'SELECT id, username, email, password_hash FROM users WHERE username=$1',
    [username]
  );
  return r.rows[0] || null;
}

async function createUser(username, passwordHash, email = null) {
  const r = await pool.query(
    'INSERT INTO users (username, password_hash, email) VALUES ($1,$2,$3) RETURNING id, username, email',
    [username, passwordHash, email]
  );
  return r.rows[0];
}

async function findUserById(id) {
  const r = await pool.query(
    'SELECT id, username, email FROM users WHERE id=$1',
    [id]
  );
  return r.rows[0] || null;
}

module.exports = { findUserByUsername, createUser, findUserById };