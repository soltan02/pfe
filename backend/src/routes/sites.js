// Sites endpoints.
// A "site" is a bank branch (or any place where agents are deployed). Each
// site has one chef_equipe (users.id) and any number of agents assigned via
// the affectations table.

const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM sites ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sites/my-sites — sites the current user has access to.
// Admin sees everything; an agent sees the site they're assigned to.
router.get('/my-sites', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const r = await pool.query('SELECT * FROM sites ORDER BY id');
      return res.json(r.rows);
    }

    const r = await pool.query(
      `SELECT DISTINCT s.*
       FROM sites s
       JOIN affectations af ON af.site_id = s.id
       JOIN users u ON u.agent_id = af.agent_id
       WHERE u.id = $1
       ORDER BY s.id`,
      [req.user.id]
    );

    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sites/assigned-chefs — IDs of users who are already managing a site.
// Used by the site form to prevent assigning the same chef to two sites.
router.get('/assigned-chefs', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT chef_id FROM sites WHERE chef_id IS NOT NULL'
    );
    res.json(r.rows.map(row => row.chef_id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM sites WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Site not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', verifyToken, role('admin'), async (req, res) => {
  const { nom, adresse, ville, chef_id } = req.body;
  if (!nom) return res.status(400).json({ error: 'Name is required' });
  try {
    // Business rule: a chef can only manage one site at a time. If `chef_id`
    // is set, we make sure no other site already uses that user.
    if (chef_id) {
      const existing = await pool.query(
        'SELECT id, nom FROM sites WHERE chef_id = $1',
        [chef_id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: `This team leader is already assigned to site "${existing.rows[0].nom}". Remove them from that site first.`
        });
      }
    }
    const r = await pool.query(
      'INSERT INTO sites (nom, adresse, ville, chef_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [nom, adresse, ville, chef_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', verifyToken, role('admin'), async (req, res) => {
  const { nom, adresse, ville, statut, chef_id } = req.body;
  try {
    // Same one-chef-per-site rule as POST, but excluding the current row
    // so editing a site without changing the chef doesn't self-conflict.
    if (chef_id) {
      const existing = await pool.query(
        'SELECT id, nom FROM sites WHERE chef_id = $1 AND id != $2',
        [chef_id, req.params.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: `This team leader is already assigned to site "${existing.rows[0].nom}". Remove them from that site first.`
        });
      }
    }
    const r = await pool.query(
      'UPDATE sites SET nom=$1, adresse=$2, ville=$3, statut=$4, chef_id=$5 WHERE id=$6 RETURNING *',
      [nom, adresse, ville, statut, chef_id || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Site not found' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM sites WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Site not found' });
    res.json({ message: 'Site deleted' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
