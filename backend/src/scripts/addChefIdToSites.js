require('dotenv').config();
const pool = require('../config/db');

async function addChefId() {
  try {
    console.log('Adding chef_id column to sites table...');
    await pool.query(`
      ALTER TABLE sites 
      ADD COLUMN IF NOT EXISTS chef_id INT REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('chef_id column added successfully!');
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
}

addChefId();