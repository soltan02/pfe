// PostgreSQL connection pool.
// Two supported configurations:
//   1. Single DATABASE_URL (typical of hosted environments like Render/Heroku).
//   2. Individual DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME vars (typical local dev).
// Set DB_SSL=true when connecting to a hosted Postgres that requires SSL.
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

// Eagerly verify the connection at startup so misconfiguration fails fast
// instead of failing on the first incoming request.
pool.connect((err, client, release) => {
  if (err) {
    console.error('DB connection failed:', err.stack);
  } else {
    console.log('Database connected successfully!');
    release();
  }
});

module.exports = pool;
