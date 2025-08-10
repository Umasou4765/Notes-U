const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(client => client
    .query('SELECT NOW()')
    .then(res => {
      console.log('✅ DB connected. Time:', res.rows[0].now);
      client.release();
    })
    .catch(err => {
      client.release();
      console.error('DB test query failed:', err);
    })
  )
  .catch(err => console.error('DB connection pool error:', err));

module.exports = pool;