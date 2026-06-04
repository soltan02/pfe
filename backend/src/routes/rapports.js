// Rapports (incident/absence/health/other reports) endpoints.
// A rapport is created by a chef about an agent and validated by an admin.

const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

router.get('/', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*,
              COALESCE(ag.nom, 'Agent #' || r.agent_id) AS agent_nom,
              s.nom AS site_nom,
              u.nom AS valide_par_nom,
              COALESCE(cu.nom, 'Unknown') AS chef_nom,
              cs.nom AS chef_site_nom
       FROM rapports r
       LEFT JOIN agents ag ON r.agent_id = ag.id
       LEFT JOIN sites s ON r.site_id = s.id
       LEFT JOIN users u ON r.valide_par = u.id
       LEFT JOIN users cu ON r.created_by = cu.id
       LEFT JOIN sites cs ON cs.chef_id = r.created_by
       ORDER BY r.date DESC`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { agent_id, type, contenu, date } = req.body;
    if (!agent_id || !type || !contenu || !date) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // The rapport inherits the agent's current site (if any) so the report
    // is searchable by site even after the agent moves.
    const siteResult = await pool.query(
      `SELECT site_id FROM affectations
       WHERE agent_id = $1
       ORDER BY date_debut DESC LIMIT 1`,
      [agent_id]
    );

    const siteId = siteResult.rows[0]?.site_id || null;

    const r = await pool.query(
      `INSERT INTO rapports (agent_id, site_id, type, contenu, date, statut, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), $6)
       RETURNING *`,
      [agent_id, siteId, type, contenu, date, req.user.id]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rapports/admin/all — admin-only view of all rapports
// (kept separate from / to keep the access rules simple).
router.get('/admin/all', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*,
              COALESCE(ag.nom, 'Agent #' || r.agent_id) AS agent_nom,
              s.nom AS site_nom,
              COALESCE(u.nom, 'Unknown') AS chef_nom,
              cs.nom AS chef_site_nom
       FROM rapports r
       LEFT JOIN agents ag ON r.agent_id = ag.id
       LEFT JOIN sites s ON r.site_id = s.id
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN sites cs ON cs.chef_id = r.created_by
       ORDER BY r.date DESC`
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/rapports/admin/full-report — payload for the admin export (Excel/print).
// Returns rows + aggregated stats so the export can render summary sheets.
router.get('/admin/full-report', verifyToken, role('admin'), async (req, res) => {
  try {
    const rapports = await pool.query(
      `SELECT r.*,
              COALESCE(ag.nom, 'Agent #' || r.agent_id) AS agent_nom,
              s.nom AS site_nom,
              COALESCE(u.nom, 'Unknown') AS chef_nom,
              cs.nom AS chef_site_nom,
              vu.nom AS valide_par_nom
       FROM rapports r
       LEFT JOIN agents ag ON r.agent_id = ag.id
       LEFT JOIN sites s ON r.site_id = s.id
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN sites cs ON cs.chef_id = r.created_by
       LEFT JOIN users vu ON r.valide_par = vu.id
       ORDER BY r.date DESC`
    );

    // FILTER (...) lets us compute conditional counts in a single scan.
    const stats = await pool.query(
      `SELECT
        COUNT(*) AS total_reports,
        COUNT(*) FILTER (WHERE statut = 'pending') AS pending_reports,
        COUNT(*) FILTER (WHERE statut = 'approved') AS approved_reports,
        COUNT(*) FILTER (WHERE type = 'incident') AS incidents,
        COUNT(*) FILTER (WHERE type = 'absence') AS absences,
        COUNT(*) FILTER (WHERE type = 'sante') AS health_issues,
        COUNT(*) FILTER (WHERE type = 'autre') AS other_reports
       FROM rapports`
    );

    const perChef = await pool.query(
      `SELECT u.nom AS chef_nom, COUNT(*) AS report_count
       FROM rapports r
       LEFT JOIN users u ON r.created_by = u.id
       GROUP BY u.nom
       ORDER BY report_count DESC`
    );

    const perSite = await pool.query(
      `SELECT s.nom AS site_nom, COUNT(*) AS report_count
       FROM rapports r
       LEFT JOIN sites s ON r.site_id = s.id
       GROUP BY s.nom
       ORDER BY report_count DESC`
    );

    res.json({
      rapports: rapports.rows,
      stats: stats.rows[0],
      perChef: perChef.rows,
      perSite: perSite.rows,
      generatedAt: new Date()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rapports/:id/validate — admin approves a rapport.
router.put('/:id/validate', verifyToken, role('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      'UPDATE rapports SET statut = $1, valide_par = $2 WHERE id = $3 RETURNING *',
      ['approved', req.user.id, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
