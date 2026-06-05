// POST /api/support — authenticated, any role
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');

router.post('/', verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message must be under 1000 characters' });
    }

    await pool.query(
      `INSERT INTO demandes (chef_id, type, description, date_creation)
       VALUES ($1, 'support', $2, NOW())`,
      [req.user.id, message.trim()]
    );

    res.status(201).json({ success: true, message: 'Request sent.' });
  } catch (err) {
    console.error('Support error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;