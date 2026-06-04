// One-off schema migration: add the `chef_approved` column to the demandes
// table. The two-step approval workflow (chef -> admin) needs this column;
// it was added in a later iteration of the project.
//
// The DO $$ ... $$ block is Postgres' standard "if not exists" pattern for
// ALTER TABLE. Re-running the script is safe — the ALTER inside the IF NOT
// EXISTS guard is a no-op the second time.

const pool = require('../config/db');

async function migrate() {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demandes' AND column_name='chef_approved') THEN
          ALTER TABLE demandes ADD COLUMN chef_approved BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);
    console.log('Migration complete: chef_approved column added');

    // Backfill any legacy rows so chef_approved is never NULL downstream.
    await pool.query(`UPDATE demandes SET chef_approved = FALSE WHERE chef_approved IS NULL`);
    console.log('Existing records updated');

    pool.end();
  } catch (e) {
    console.error('Migration error:', e.message);
    pool.end();
  }
}

migrate();
