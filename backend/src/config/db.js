require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  // Use the single connection string Render provides
  connectionString: process.env.DATABASE_URL,
  // This is the CRITICAL part for Render
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('DB connection failed:', err.stack);
  } else {
    console.log('Database connected successfully!');
    release();
  }
});

module.exports = pool;