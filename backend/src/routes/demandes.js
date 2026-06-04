// Demandes (tickets) endpoints.
// A demande is a request an agent submits (leave, attendance cert, work cert).
// Workflow:
//   agent creates -> pending  ->  chef approves (chef_approved=true)  ->
//   admin gives the final stamp (statut='approved' or 'rejected').
// So an admin only sees demandes that have already cleared the chef stage.

const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

// GET /api/demandes/my-requests — agent lists their own demandes.
router.get('/my-requests', verifyToken, role('agent'), async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
    );
    const agentId = userResult.rows[0]?.agent_id;
    // No linked agent record (e.g. an admin-only user) -> return empty list.
    if (!agentId) return res.json([]);

    const r = await pool.query(
      `SELECT d.*, u.nom AS validated_by_name
       FROM demandes d
       LEFT JOIN users u ON d.valide_par = u.id
       WHERE d.agent_id = $1
       ORDER BY d.created_at DESC`,
      [agentId]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/demandes/my-requests — agent creates a new demande.
router.post('/my-requests', verifyToken, role('agent'), async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
    );
    const agentId = userResult.rows[0]?.agent_id;
    if (!agentId) return res.status(400).json({ error: 'Agent not found' });

    const { type, date_debut, date_fin, motif } = req.body;
    if (!type || !date_debut || !motif) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Restrict `type` to a known set so downstream reports can group by it.
    const validTypes = ['conge', 'attestation_presence', 'attestation_travail'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid demand type' });
    }

    const r = await pool.query(
      `INSERT INTO demandes (agent_id, type, date_debut, date_fin, motif, statut, chef_approved, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', FALSE, NOW())
       RETURNING *`,
      [agentId, type, date_debut, date_fin || null, motif]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/demandes/team-requests — chef sees the demandes from agents
// assigned to one of their sites.
router.get('/team-requests', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const sitesResult = await pool.query(
      'SELECT id, nom FROM sites WHERE chef_id = $1',
      [req.user.id]
    );
    const siteIds = sitesResult.rows.map(r => r.id);
    if (siteIds.length === 0) return res.json([]);

    const agentsResult = await pool.query(
      `SELECT DISTINCT agent_id FROM affectations WHERE site_id = ANY($1)`,
      [siteIds]
    );
    const agentIds = agentsResult.rows.map(r => r.agent_id);
    if (agentIds.length === 0) return res.json([]);

    const r = await pool.query(
      `SELECT d.*,
              ag.nom || ' ' || ag.prenom AS agent_name,
              ag.matricule AS agent_matricule
       FROM demandes d
       JOIN agents ag ON d.agent_id = ag.id
       WHERE d.agent_id = ANY($1)
       ORDER BY d.created_at DESC`,
      [agentIds]
    );

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/demandes — admin sees everything; chefs see their team (same logic as
// /team-requests but for both pending and processed items).
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const r = await pool.query(
        `SELECT d.*,
                ag.nom || ' ' || ag.prenom AS agent_name,
                ag.matricule AS agent_matricule,
                u.nom AS validated_by_name
         FROM demandes d
         JOIN agents ag ON d.agent_id = ag.id
         LEFT JOIN users u ON d.valide_par = u.id
         ORDER BY d.created_at DESC`
      );
      return res.json(r.rows);
    }

    const sitesResult = await pool.query(
      'SELECT id FROM sites WHERE chef_id = $1',
      [req.user.id]
    );
    const siteIds = sitesResult.rows.map(r => r.id);
    if (siteIds.length === 0) return res.json([]);

    const agentsResult = await pool.query(
      `SELECT DISTINCT agent_id FROM affectations WHERE site_id = ANY($1)`,
      [siteIds]
    );
    const agentIds = agentsResult.rows.map(r => r.agent_id);
    if (agentIds.length === 0) return res.json([]);

    const r = await pool.query(
      `SELECT d.*,
              ag.nom || ' ' || ag.prenom AS agent_name,
              ag.matricule AS agent_matricule,
              u.nom AS validated_by_name
       FROM demandes d
       JOIN agents ag ON d.agent_id = ag.id
       LEFT JOIN users u ON d.valide_par = u.id
       WHERE d.agent_id = ANY($1)
       ORDER BY d.created_at DESC`,
      [agentIds]
    );

    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/demandes/:id/chef-approve — first step of approval.
router.put('/:id/chef-approve', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE demandes SET chef_approved = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/demandes/:id/chef-reject — chef rejects; status moves to 'rejected'
// and chef_approved is reset so the admin side stays consistent.
router.put('/:id/chef-reject', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE demandes SET statut = $1, chef_approved = FALSE WHERE id = $2 RETURNING *',
      ['rejected', req.params.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/demandes/:id/admin-approve — final approval. The chef_approved
// precondition enforces the two-step workflow.
router.put('/:id/admin-approve', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE demandes SET statut = $1, valide_par = $2 WHERE id = $3 AND chef_approved = TRUE RETURNING *',
      ['approved', req.user.id, req.params.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not yet approved by team leader' });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/demandes/:id/admin-reject — admin can reject at any stage.
router.put('/:id/admin-reject', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE demandes SET statut = $1, valide_par = $2 WHERE id = $3 RETURNING *',
      ['rejected', req.user.id, req.params.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/demandes/:id — admins can delete anything; agents can only delete
// their own demandes that are still pending (not yet seen by the chef).
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const r = await pool.query(
        'DELETE FROM demandes WHERE id=$1 RETURNING id',
        [req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Request not found' });
      return res.json({ message: 'Request deleted' });
    }

    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
    );
    const agentId = userResult.rows[0]?.agent_id;

    const r = await pool.query(
      'DELETE FROM demandes WHERE id=$1 AND agent_id=$2 AND statut=$3 AND chef_approved=FALSE RETURNING id',
      [req.params.id, agentId, 'pending']
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: 'Request not found or cannot be deleted' });
    }

    res.json({ message: 'Request deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
