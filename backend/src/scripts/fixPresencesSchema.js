require('dotenv').config();
const pool = require('../config/db');

(async () => {
  try {
    console.log('=== Fixing presences table schema ===');

    // 1) Add UNIQUE constraint on (agent_id, date) if not present.
    //    We must first deduplicate any existing duplicates, otherwise
    //    the unique index creation will fail.
    const dups = await pool.query(`
      SELECT agent_id, date, MIN(id) AS keep_id, COUNT(*) AS c
      FROM presences
      GROUP BY agent_id, date
      HAVING COUNT(*) > 1
    `);
    if (dups.rows.length > 0) {
      console.log(`Found ${dups.rows.length} duplicate (agent_id, date) groups. Cleaning up...`);
      for (const row of dups.rows) {
        await pool.query(
          'DELETE FROM presences WHERE agent_id = $1 AND date = $2 AND id <> $3',
          [row.agent_id, row.date, row.keep_id]
        );
      }
      console.log('Duplicates removed.');
    } else {
      console.log('No duplicates found.');
    }

    // 2) Drop the old unnamed unique index if it exists with a different name
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'presences_agent_date_unique'
        ) THEN
          ALTER TABLE presences
            ADD CONSTRAINT presences_agent_date_unique UNIQUE (agent_id, date);
        END IF;
      END$$;
    `);
    console.log('UNIQUE constraint on (agent_id, date) is in place.');

    // 3) Update the statut CHECK constraint to include 'conge' (Leave)
    await pool.query(`
      ALTER TABLE presences DROP CONSTRAINT IF EXISTS presences_statut_check
    `);
    await pool.query(`
      ALTER TABLE presences
        ADD CONSTRAINT presences_statut_check
        CHECK (statut IN ('present', 'absent', 'retard', 'conge'))
    `);
    console.log('statut CHECK constraint updated to include conge.');

    // 4) Make sure the date column is plain DATE (no time) for clean equality
    //    and that the column is NOT NULL.
    const dateType = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'presences' AND column_name = 'date'
    `);
    console.log('date column type:', dateType.rows[0]?.data_type);

    console.log('\n=== Schema fix complete ===');
    pool.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    pool.end();
    process.exit(1);
  }
})();
