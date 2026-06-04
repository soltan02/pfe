// Affectations endpoints.
// An affectation links an agent to a site for a date range. It's the join
// table that drives who can show up where (and is the source for the
// pointage page's per-site filter).

const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

// GET /api/affectations/mes-affectations — the connected agent's own assignments.
router.get('/mes-affectations', verifyToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
    );
    const agentId = userResult.rows[0]?.agent_id;
    if (!agentId) return res.json([]);
    const r = await pool.query(
      `SELECT af.*,
        ag.nom || ' ' || ag.prenom AS agent_nom,
        s.nom AS site_nom
      FROM affectations af
      JOIN agents ag ON af.agent_id = ag.id
      JOIN sites s ON af.site_id = s.id
      WHERE af.agent_id = $1
      ORDER BY af.date_debut DESC`,
      [agentId]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/affectations — full list (chef_equipe or above).
router.get('/', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT af.*,
        ag.nom || ' ' || ag.prenom AS agent_nom,
        s.nom AS site_nom
      FROM affectations af
      JOIN agents ag ON af.agent_id = ag.id
      JOIN sites s ON af.site_id = s.id
      ORDER BY af.id DESC`
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyToken, role('chef_equipe'), async (req, res) => {
  const { agent_id, site_id, date_debut, date_fin } = req.body;
  if (!agent_id || !site_id || !date_debut)
    return res.status(400).json({ error: 'Missing fields' });
  try {
    const r = await pool.query(
      'INSERT INTO affectations (agent_id,site_id,date_debut,date_fin) VALUES ($1,$2,$3,$4) RETURNING *',
      [agent_id, site_id, date_debut, date_fin]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM affectations WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment deleted' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
