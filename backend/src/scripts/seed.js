// Seed the database with initial data.
// Re-exports the seedSites and migrateDemandes scripts for convenience.
//
// Usage:  node src/scripts/seed.js

require('dotenv').config();
const pool = require('../config/db');
const { stbAgencies } = require('./seedSites');

async function seed() {
  console.log('=== STB Security — Seed ===\n');

  // 1. Seed STB branch sites
  console.log('Seeding sites...');
  let count = 0;
  for (const agency of stbAgencies) {
    const exists = await pool.query('SELECT id FROM sites WHERE nom=$1', [agency.nom]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO sites (nom, adresse, ville, statut) VALUES ($1,$2,$3,$4)',
        [agency.nom, agency.adresse, agency.ville, 'actif']
      );
      count++;
    }
  }
  console.log(`  ${count} sites added.\n`);

  // 2. Run the demandes migration (idempotent)
  console.log('Running demandes migration...');
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='demandes' AND column_name='chef_approved'
      ) THEN
        ALTER TABLE demandes ADD COLUMN chef_approved BOOLEAN DEFAULT false;
      END IF;
    END$$;
  `);
  console.log('  Done.\n');

  console.log('=== Seed complete ===');
  await pool.end();
}

seed().catch(e => { console.error('Error:', e); pool.end(); process.exit(1); });
