const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

// GET - Agent's own requests
router.get('/my-requests', verifyToken, role('agent'), async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
    );
    const agentId = userResult.rows[0]?.agent_id;
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// POST - Agent creates a request
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

    // Validate type
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// GET - Chef views requests from agents at their sites (only pending ones needing chef approval)
router.get('/team-requests', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    // sites du chef
    const sitesResult = await pool.query(
      'SELECT id, nom FROM sites WHERE chef_id = $1',
      [req.user.id]
    );
    const siteIds = sitesResult.rows.map(r => r.id);

    if (siteIds.length === 0) return res.json([]);

    // agents affectés à ces sites
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// GET - Admin views all requests that are chef-approved (waiting for admin approval) + all processed
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

    // Chef sees their team's requests
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// PUT - Chef approves a request (sets chef_approved = true)
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// PUT - Chef rejects a request
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// PUT - Admin approves a request (final approval)
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// PUT - Admin rejects a request
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// DELETE - Delete a request (admin only or agent's own pending request)
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

    // Agent can only delete their own pending requests (not yet chef-approved)
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
  } catch(e) { 
    res.status(500).json({ error: e.message }); 
  }
});

module.exports = router;