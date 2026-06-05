// POST /api/support — authenticated, any role
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

// Agent/Chef sends support message
router.post('/', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message must be under 1000 characters' });
    }

    // Get agent_id if user is an agent
    let agentId = null;
    if (req.user.role === 'agent') {
      const userResult = await pool.query(
        'SELECT agent_id FROM users WHERE id = $1', [req.user.id]
      );
      agentId = userResult.rows[0]?.agent_id;
    }

    await pool.query(
      `INSERT INTO demandes (agent_id, type, motif, statut, chef_approved, created_at)
       VALUES ($1, 'support', $2, 'pending', FALSE, NOW())
       RETURNING *`,
      [agentId || req.user.id, message.trim()]
    );

    res.status(201).json({ success: true, message: 'Request sent.' });
  } catch (err) {
    console.error('Support error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/support — admin views all support requests
router.get('/', verifyToken, role('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.*,
              u.nom AS user_name,
              u.email AS user_email,
              u.role AS user_role
       FROM demandes d
       LEFT JOIN users u ON d.agent_id = u.id
       WHERE d.type = 'support'
       ORDER BY d.created_at DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Support get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
