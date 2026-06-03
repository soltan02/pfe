require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name='presences'
      ORDER BY ordinal_position
    `);
    console.log('COLUMNS:', JSON.stringify(cols.rows, null, 2));

    const cons = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'presences'::regclass
    `);
    console.log('CONSTRAINTS:', JSON.stringify(cons.rows, null, 2));

    const idx = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes WHERE tablename = 'presences'
    `);
    console.log('INDEXES:', JSON.stringify(idx.rows, null, 2));

    const sample = await pool.query('SELECT * FROM presences LIMIT 3');
    console.log('SAMPLE:', JSON.stringify(sample.rows, null, 2));

    pool.end();
  } catch (e) {
    console.error('ERROR:', e.message);
    pool.end();
  }
})();
