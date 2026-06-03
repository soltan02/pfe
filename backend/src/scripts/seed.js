require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('Starting seed...');
    const hash = await bcrypt.hash('admin123', 10);
    console.log('Password hashed:', hash);
    const result = await pool.query(
      'INSERT INTO users (nom, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *',
      ['Admin STB', 'admin@stb.tn', hash, 'admin']
    );
    console.log('User created:', result.rows[0]);
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
}

seed();