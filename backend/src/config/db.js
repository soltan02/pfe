// PostgreSQL connection pool.
// Uses DATABASE_URL when set, otherwise the individual DB_* env vars.
// Set DB_SSL=true when the server requires SSL.
require('dotenv').config();
const { Pool } = require('pg');

const useSSL = process.env.DB_SSL === 'true';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSSL ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      }
);

pool.connect((err, client, release) => {
  if (err) {
    console.error('DB connection failed:', err.stack);
  } else {
    console.log('Database connected successfully!');
    release();
  }
});

module.exports = pool;
