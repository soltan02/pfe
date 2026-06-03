require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    // Check constraints - for PG 12+ use pg_get_constraintdef
    const r = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) as consrc 
       FROM pg_constraint 
       WHERE conrelid = 'demandes'::regclass 
       AND contype = 'c'`
    );
    console.log('Constraints:', JSON.stringify(r.rows, null, 2));
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
})();