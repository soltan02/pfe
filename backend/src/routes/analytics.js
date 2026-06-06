// Analytics API — serves pre-computed KPIs from materialized views.
// All endpoints require admin authentication.
//
// Mounted at /api/analytics in index.js.

const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const auth    = require('../middleware/auth');
const role    = require('../middleware/roles');

// Helper: safely query a materialized view; returns [] if it doesn't exist yet
async function safeQuery(sql, params) {
  try {
    const result = await pool.query(sql, params || []);
    return result.rows;
  } catch (e) {
    if (e.message.includes('does not exist')) return [];
    throw e;
  }
}

// ---------- Summary KPIs ----------
router.get('/summary', auth, role('admin'), async (req, res) => {
  try {
    const [agents, sites, presences, rapports] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM agents'),
      pool.query('SELECT COUNT(*) FROM sites'),
      pool.query('SELECT COUNT(*) FROM presences'),
      pool.query('SELECT COUNT(*) FROM rapports'),
    ]);
    const attendance = await safeQuery(
      `SELECT ROUND(AVG(attendance_rate), 1) AS avg_rate FROM mv_attendance_daily`
    );
    res.json({
      total_agents:    parseInt(agents.rows[0].count),
      total_sites:     parseInt(sites.rows[0].count),
      total_presences: parseInt(presences.rows[0].count),
      total_rapports:  parseInt(rapports.rows[0].count),
      avg_attendance_rate: attendance[0]?.avg_rate || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Attendance trend (monthly) ----------
router.get('/attendance-trend', auth, role('admin'), async (req, res) => {
  try {
    const rows = await safeQuery(`
      SELECT
        DATE_TRUNC('month', date)::date AS month,
        SUM(total)     AS total,
        SUM(present)   AS present,
        SUM(late)      AS late,
        SUM(absent)    AS absent,
        SUM(on_leave)  AS on_leave,
        ROUND(SUM(present)::numeric / NULLIF(SUM(total), 0) * 100, 1) AS attendance_rate
      FROM mv_attendance_daily
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Absenteeism by branch (latest 12 months) ----------
router.get('/absenteeism-by-branch', auth, role('admin'), async (req, res) => {
  try {
    const rows = await safeQuery(`
      SELECT site_nom, site_ville,
        SUM(absences) AS total_absences,
        SUM(tardiness) AS total_tardiness,
        SUM(total_records) AS total_records,
        ROUND(SUM(absences)::numeric / NULLIF(SUM(total_records), 0) * 100, 1) AS absence_rate,
        ROUND(SUM(tardiness)::numeric / NULLIF(SUM(total_records), 0) * 100, 1) AS tardiness_rate
      FROM mv_absenteeism_monthly
      WHERE month >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY site_nom, site_ville
      ORDER BY absence_rate DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Incidents per month (by type) ----------
router.get('/incidents-monthly', auth, role('admin'), async (req, res) => {
  try {
    const rows = await safeQuery(`
      SELECT month, incident_type,
        SUM(total)    AS total,
        SUM(pending)  AS pending,
        SUM(approved) AS approved
      FROM mv_incidents_monthly
      GROUP BY month, incident_type
      ORDER BY month, incident_type
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Agent workload (top N / bottom N by attendance) ----------
router.get('/agent-workload', auth, role('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const rows = await safeQuery(`
      SELECT agent_nom, agent_prenom, matricule, agent_status,
        total_assignments, active_assignments,
        total_presence_days, present_days, absent_days, late_days,
        attendance_rate, total_reports
      FROM mv_agent_workload
      ORDER BY attendance_rate ${order}
      LIMIT $1
    `, [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Site coverage ----------
router.get('/coverage', auth, role('admin'), async (req, res) => {
  try {
    const rows = await safeQuery(`
      SELECT site_nom, site_ville,
        total_agents_ever, current_agents, total_assignments,
        total_reports, total_incidents
      FROM mv_site_coverage
      ORDER BY total_incidents DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
