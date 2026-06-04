// User self-service: own profile, own password.

const router = require('express').Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const verifyToken = require('../middleware/auth');

// GET /api/users — list of all users (id, nom, email, role). Used by the
// admin users page and the site form's chef picker.
router.get('/', verifyToken, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nom, email, role FROM users ORDER BY nom'
    );
    res.json(r.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/users/profile — update the connected user's own profile.
// The telephone is stored on the `agents` row (not on `users`), so when the
// caller is an agent we update both tables. COALESCE keeps the old value if
// the field is omitted in the request body.
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { nom, email, telephone } = req.body;
    const userId = req.user.id;

    const userUpdate = await pool.query(
      'UPDATE users SET nom = COALESCE($1, nom), email = COALESCE($2, email) WHERE id = $3 RETURNING id, nom, email, role',
      [nom || null, email || null, userId]
    );

    if (userUpdate.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const agentCheck = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1',
      [userId]
    );
    const agentId = agentCheck.rows[0]?.agent_id;
    if (agentId && telephone) {
      await pool.query(
        'UPDATE agents SET telephone = COALESCE($1, telephone) WHERE id = $2',
        [telephone, agentId]
      );
    }

    const updatedUser = userUpdate.rows[0];
    if (agentId) {
      const agentInfo = await pool.query(
        'SELECT telephone FROM agents WHERE id = $1',
        [agentId]
      );
      // Surface the (possibly updated) phone number in the response.
      updatedUser.telephone = agentInfo.rows[0]?.telephone || null;
    }

    res.json({ user: updatedUser });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/users/change-own-password — change the connected user's password.
// Requires the current password as a guard against CSRF / stolen token abuse.
router.put('/change-own-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    const userResult = await pool.query(
      'SELECT id, password FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
