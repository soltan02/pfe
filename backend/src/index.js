// API entry. CORS + routes.

require('./config/db');
const express = require('express');
const cors = require('cors');
const app = express();

const allowedOrigins = [
  'http://localhost:4200',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // no origin = curl / same-origin, always allow
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Origin not allowed'));
  },
  credentials: true
}));

app.use(express.json());
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'STB API running' });
});

// /api/* routes — one per entity, see routes/
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/affectations', require('./routes/affectations'));
app.use('/api/presences', require('./routes/presences'));
app.use('/api/rapports', require('./routes/rapports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/demandes', require('./routes/demandes'));
app.use('/api/support', require('./routes/support'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/analytics', require('./routes/analytics'));

// dashboard counters — kept here because it touches many tables
const verifyToken = require('./middleware/auth');
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    const pool = require('./config/db');
    const agentsResult = await pool.query("SELECT COUNT(*) FROM agents WHERE statut='actif'");
    const sitesResult = await pool.query("SELECT COUNT(*) FROM sites WHERE statut='actif'");
    const affectationsResult = await pool.query("SELECT COUNT(*) FROM affectations WHERE statut='en cours'");
    const usersResult = await pool.query("SELECT COUNT(*) FROM users");
    res.json({
      agents: parseInt(agentsResult.rows[0].count),
      sites: parseInt(sitesResult.rows[0].count),
      affectations: parseInt(affectationsResult.rows[0].count),
      users: parseInt(usersResult.rows[0].count)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
