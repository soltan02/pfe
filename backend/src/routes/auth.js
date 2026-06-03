const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!r.rows.length)
      return res.status(401).json({ error: 'Incorrect email or password' });
    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect email or password' });
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, nom: user.nom, role: user.role } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', async (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const r = await pool.query(
      `SELECT u.id, u.nom, u.email, u.role, u.agent_id,
              a.telephone, a.adresse
       FROM users u
       LEFT JOIN agents a ON a.id = u.agent_id
       WHERE u.id=$1`,
      [decoded.id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(403).json({ error: 'Invalid token' }); }
});
const verifyToken = require('../middleware/auth');

// Admin changes any user's password
router.put('/change-password/:userId', verifyToken, async (req, res) => {
  // Only admin can change passwords
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied' });

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4)
    return res.status(400).json({ error: 'Password too short (minimum 4 characters)' });

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, nom, email',
      [hash, req.params.userId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password changed successfully', user: result.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin changes user role
router.put('/change-role/:userId', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied' });

  const { role } = req.body;
  if (!['agent', 'chef_equipe', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, nom, email, role',
      [role, req.params.userId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Role changed successfully', user: result.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/users-list', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied' });
  try {
    const r = await pool.query(
      `SELECT u.id, u.nom, u.email, u.role, u.agent_id,
              COALESCE(s.nom, cs.nom) AS site_nom
       FROM users u
       LEFT JOIN affectations af ON af.agent_id = u.agent_id
       LEFT JOIN sites s ON s.id = af.site_id
       LEFT JOIN sites cs ON cs.chef_id = u.id
       GROUP BY u.id, u.nom, u.email, u.role, u.agent_id, s.nom, cs.nom
       ORDER BY u.id`
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// Change password by agent_id (finds the user linked to that agent)
router.put('/change-password-agent/:agentId', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Access denied' });

  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4)
    return res.status(400).json({ error: 'Minimum 4 characters' });

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE agent_id = $2 RETURNING id, nom, email',
      [hash, req.params.agentId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: 'No user account found for this agent' });
    res.json({ message: 'Password changed', user: result.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;