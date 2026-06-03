require('dotenv').config();
const pool = require('../src/config/db');

async function fixConstraints() {
  try {
    // Drop old constraints
    await pool.query('ALTER TABLE demandes DROP CONSTRAINT IF EXISTS demandes_statut_check');
    await pool.query('ALTER TABLE demandes DROP CONSTRAINT IF EXISTS demandes_type_check');
    console.log('Old constraints dropped');
    
    // Add new constraints matching the app values
    await pool.query(`
      ALTER TABLE demandes ADD CONSTRAINT demandes_statut_check 
      CHECK (statut IN ('pending', 'approved', 'rejected'))
    `);
    console.log('New statut constraint added');
    
    await pool.query(`
      ALTER TABLE demandes ADD CONSTRAINT demandes_type_check 
      CHECK (type IN ('conge', 'attestation_presence', 'attestation_travail'))
    `);
    console.log('New type constraint added');
    
    console.log('All constraints updated successfully!');
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
}

fixConstraints();