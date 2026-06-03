require('./config/db');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'STB API running' });
});

const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/agents', require('./routes/agents'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/affectations', require('./routes/affectations'));
app.use('/api/presences', require('./routes/presences'));
app.use('/api/rapports', require('./routes/rapports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/demandes', require('./routes/demandes'));
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
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.listen(3000, () => {
  console.log('Server running on port 3000');
});