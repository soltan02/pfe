// ETL script — creates / refreshes the analytics materialized views.
//
// The views are defined in analytics_schema.sql. On first run, this script
// executes the full SQL to create them. On subsequent runs it refreshes the
// data concurrently (no lock on reads).
//
// Usage:  npm run etl   (or: node src/scripts/runEtl.js)

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../config/db');

const VIEWS = [
  'mv_attendance_daily',
  'mv_absenteeism_monthly',
  'mv_incidents_monthly',
  'mv_agent_workload',
  'mv_site_coverage',
];

async function run() {
  const t0 = Date.now();
  console.log('=== STB Security — ETL / Analytics Refresh ===\n');

  // 1. Ensure materialized views exist (idempotent CREATE … IF NOT EXISTS)
  const schemaPath = path.join(__dirname, 'analytics_schema.sql');
  const schemaSql  = fs.readFileSync(schemaPath, 'utf8');
  console.log('Creating materialized views (if not exist)...');
  await pool.query(schemaSql);
  console.log('  Views ensured.\n');

  // 2. Refresh each view
  for (const view of VIEWS) {
    const vt = Date.now();
    process.stdout.write(`Refreshing ${view}...`);
    try {
      await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
    } catch (e) {
      // CONCURRENTLY requires a unique index (should exist). Fall back to
      // a non-concurrent refresh if it's missing for some reason.
      if (e.message.includes('unique')) {
        await pool.query(`REFRESH MATERIALIZED VIEW ${view}`);
      } else {
        throw e;
      }
    }
    const rows = (await pool.query(`SELECT COUNT(*) FROM ${view}`)).rows[0].count;
    console.log(` ${rows} rows (${((Date.now() - vt) / 1000).toFixed(1)}s)`);
  }

  console.log(`\n=== ETL complete in ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  await pool.end();
}

run().catch(e => { console.error('ETL failed:', e); pool.end(); process.exit(1); });
