const pool = require('../config/db');

async function migrate() {
  try {
    // Add chef_approved column if not exists
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demandes' AND column_name='chef_approved') THEN
          ALTER TABLE demandes ADD COLUMN chef_approved BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);
    console.log('Migration complete: chef_approved column added');

    await pool.query(`UPDATE demandes SET chef_approved = FALSE WHERE chef_approved IS NULL`);
    console.log('Existing records updated');

    pool.end();
  } catch (e) {
    console.error('Migration error:', e.message);
    pool.end();
  }
}

migrate();