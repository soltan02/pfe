// Presence (pointage) endpoints.
// Records the daily attendance of an agent: present / absent / retard (late) / conge.
// Two main consumers:
//   - The pointage page (chef_equipe) records and reviews team attendance.
//   - The agent dashboard reads the current agent's monthly summary.
//
// getChefSiteId() is a small helper that resolves the site a chef is in charge of.
// It looks at the sites.chef_id column first, then falls back to any site the
// chef-user happens to be assigned to as an agent (rare but supported).

const router = require('express').Router();
const pool = require('../config/db');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

async function getChefSiteId(userId) {
  let r = await pool.query(
    'SELECT id AS site_id FROM sites WHERE chef_id = $1 LIMIT 1',
    [userId]
  );
  if (r.rows.length > 0) return r.rows[0].site_id;

  r = await pool.query(
    `SELECT DISTINCT af.site_id
     FROM affectations af
     JOIN agents ag ON af.agent_id = ag.id
     WHERE af.agent_id IN (SELECT agent_id FROM users WHERE id = $1)
     LIMIT 1`,
    [userId]
  );
  return r.rows[0]?.site_id || null;
}

// GET /api/presences/team-agents — agents that the current chef can take attendance for.
// Falls back to *all* agents if the chef has no assigned site.
router.get('/team-agents', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const siteId = await getChefSiteId(req.user.id);

    let agents;
    if (siteId) {
      agents = await pool.query(
        `SELECT DISTINCT ag.id, ag.nom, ag.prenom,
                ag.nom || ' ' || ag.prenom AS agent_nom
         FROM agents ag
         JOIN affectations af ON ag.id = af.agent_id
         WHERE af.site_id = $1
         ORDER BY ag.nom, ag.prenom`,
        [siteId]
      );
    } else {
      agents = await pool.query(
        `SELECT id, nom, prenom, nom || ' ' || prenom AS agent_nom
         FROM agents
         ORDER BY nom, prenom`
      );
    }

    res.json(agents.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/presences/agents — same data as /team-agents but accessible to any role
// (used by the rapports form for the agent picker).
router.get('/agents', verifyToken, async (req, res) => {
  try {
    const siteId = await getChefSiteId(req.user.id);
    let agents;
    if (siteId) {
      agents = await pool.query(
        `SELECT DISTINCT ag.id, ag.nom, ag.prenom,
                ag.nom || ' ' || ag.prenom AS agent_nom
         FROM agents ag
         JOIN affectations af ON ag.id = af.agent_id
         WHERE af.site_id = $1
         ORDER BY ag.nom, ag.prenom`,
        [siteId]
      );
    } else {
      agents = await pool.query(
        `SELECT id, nom, prenom, nom || ' ' || prenom AS agent_nom
         FROM agents
         ORDER BY nom, prenom`
      );
    }
    res.json(agents.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/presences/me/monthly/:month — the current agent's attendance for a month.
// `:month` is YYYY-MM. Used by the agent dashboard.
router.get('/me/monthly/:month', verifyToken, async (req, res) => {
  try {
    const { month } = req.params;
    const userResult = await pool.query(
      'SELECT agent_id FROM users WHERE id = $1',
      [req.user.id]
    );

    const agentId = userResult.rows[0]?.agent_id;
    if (!agentId) {
      return res.json({ month, present: 0, absent: 0, presences: [] });
    }

    const presences = await pool.query(
      `SELECT date, statut, heure_arrivee, heure_depart
       FROM presences
       WHERE agent_id = $1
         AND DATE_TRUNC('month', date) = $2::date
       ORDER BY date DESC`,
      [agentId, `${month}-01`]
    );

    const summary = presences.rows.reduce((acc, presence) => {
      if (presence.statut === 'present') acc.present += 1;
      if (presence.statut === 'absent') acc.absent += 1;
      return acc;
    }, { present: 0, absent: 0 });

    res.json({
      month,
      ...summary,
      presences: presences.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/presences/yearly/:year?agent_id=...
// Returns a 12-month array of present/absent/tardy counts. Either a specific agent
// (via ?agent_id=) or the whole team at the chef's site.
router.get('/yearly/:year', verifyToken, async (req, res) => {
  try {
    const { year } = req.params;
    const agentId = req.query.agent_id;
    const siteId = await getChefSiteId(req.user.id);

    let agentsRes;
    if (agentId) {
      agentsRes = await pool.query(
        'SELECT id, nom, prenom, nom || \' \' || prenom AS agent_nom FROM agents WHERE id = $1',
        [agentId]
      );
    } else if (siteId) {
      agentsRes = await pool.query(
        `SELECT DISTINCT ag.id, ag.nom, ag.prenom,
                ag.nom || ' ' || ag.prenom AS agent_nom
         FROM agents ag
         JOIN affectations af ON ag.id = af.agent_id
         WHERE af.site_id = $1
         ORDER BY ag.nom, ag.prenom`,
        [siteId]
      );
    } else {
      agentsRes = await pool.query(
        `SELECT id, nom, prenom, nom || ' ' || prenom AS agent_nom
         FROM agents ORDER BY nom, prenom`
      );
    }

    const agents = agentsRes.rows;
    if (agents.length === 0) {
      return res.json({ months: [], totals: { present: 0, absent: 0, tardy: 0 } });
    }

    const agentIds = agents.map(a => a.id);

    // Single query for the whole year — much cheaper than 12 monthly queries.
    const presencesRes = await pool.query(
      `SELECT agent_id, date, statut
       FROM presences
       WHERE agent_id = ANY($1::int[])
         AND date >= $2::date
         AND date < ($3::date + INTERVAL '1 year')`,
      [agentIds, `${year}-01-01`, `${year}-01-01`]
    );

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const monthlyStats = monthNames.map((name, idx) => ({
      month: name,
      monthIndex: idx + 1,
      present: 0,
      absent: 0,
      tardy: 0,
      total: 0
    }));

    // When an agent is selected via ?agent_id= we only count rows for that one
    // agent; otherwise we aggregate over everyone in the site.
    const targetIds = agentId ? [parseInt(agentId)] : agentIds;

    for (const p of presencesRes.rows) {
      if (!targetIds.includes(p.agent_id)) continue;
      // pg returns DATE as a JS Date object; older versions return a string.
      const monthIdx = (p.date instanceof Date ? p.date.getMonth() : new Date(p.date).getMonth());
      const stat = monthlyStats[monthIdx];
      if (!stat) continue;

      if (p.statut === 'present') stat.present++;
      else if (p.statut === 'absent') stat.absent++;
      else if (p.statut === 'retard') stat.tardy++;
      stat.total++;
    }

    const totals = monthlyStats.reduce((acc, m) => ({
      present: acc.present + m.present,
      absent: acc.absent + m.absent,
      tardy: acc.tardy + m.tardy
    }), { present: 0, absent: 0, tardy: 0 });

    res.json({
      year: parseInt(year),
      agents: agents,
      selectedAgent: agentId ? agents[0] : null,
      months: monthlyStats,
      totals
    });
  } catch (e) {
    console.error('yearly error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/presences/monthly/:month — full grid (one cell per agent per day)
// for the pointage page. `:month` is YYYY-MM.
router.get('/monthly/:month', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { month } = req.params;
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
    }

    const siteId = await getChefSiteId(req.user.id);
    if (!siteId) return res.json({ agents: [], days: [], grid: {} });

    const agentsRes = await pool.query(
      `SELECT DISTINCT ag.id, ag.nom, ag.prenom,
              ag.nom || ' ' || ag.prenom AS agent_nom
       FROM agents ag
       JOIN affectations af ON ag.id = af.agent_id
       WHERE af.site_id = $1
       ORDER BY ag.nom, ag.prenom`,
      [siteId]
    );
    const agents = agentsRes.rows;
    if (agents.length === 0) {
      return res.json({ agents: [], days: [], grid: {} });
    }

    // Build the list of date strings for the month so the frontend can render
    // the column headers without computing them itself.
    const daysInMonth = new Date(year, m, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      days.push(`${yearStr}-${monthStr}-${dd}`);
    }

    const presencesRes = await pool.query(
      `SELECT agent_id, date, statut, heure_arrivee, heure_depart
       FROM presences
       WHERE agent_id = ANY($1::int[])
         AND date >= $2::date
         AND date < ($3::date + INTERVAL '1 month')`,
      [agents.map(a => a.id), `${yearStr}-${monthStr}-01`, `${yearStr}-${monthStr}-01`]
    );

    // Initialise every cell to null so the frontend can rely on a complete grid.
    const grid = {};
    for (const a of agents) grid[a.id] = {};
    for (const day of days) {
      for (const a of agents) grid[a.id][day] = null;
    }
    for (const p of presencesRes.rows) {
      const dateStr = p.date instanceof Date
        ? p.date.toISOString().slice(0, 10)
        : String(p.date).slice(0, 10);
      if (grid[p.agent_id] && Object.prototype.hasOwnProperty.call(grid[p.agent_id], dateStr)) {
        grid[p.agent_id][dateStr] = {
          statut: p.statut,
          heure_arrivee: p.heure_arrivee,
          heure_depart: p.heure_depart
        };
      }
    }

    res.json({ agents, days, grid });
  } catch (e) {
    console.error('monthly error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/presences — record (or update) one presence row.
// ON CONFLICT keeps the latest entry when a chef re-records the same agent on the
// same day, which is the desired behaviour for a pointage workflow.
router.post('/', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { agent_id, date, statut, heure_arrivee, heure_depart } = req.body;
    if (!agent_id || !date || !statut) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    if (!['present', 'absent', 'retard', 'conge'].includes(statut)) {
      return res.status(400).json({ error: 'Invalid statut' });
    }

    const r = await pool.query(
      `INSERT INTO presences (agent_id, date, statut, heure_arrivee, heure_depart, created_at)
       VALUES ($1, $2::date, $3, $4, $5, NOW())
       ON CONFLICT ON CONSTRAINT presences_agent_date_unique
       DO UPDATE SET
         statut        = EXCLUDED.statut,
         heure_arrivee = EXCLUDED.heure_arrivee,
         heure_depart  = EXCLUDED.heure_depart
       RETURNING *`,
      [agent_id, date, statut, heure_arrivee || null, heure_depart || null]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('record attendance error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/presences/bulk — record the same status for many agents in one call.
// Verifies that every requested agent is actually assigned to the chef's site
// so a chef can't accidentally mark attendance for agents they don't manage.
router.post('/bulk', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { date, statut, agent_ids, heure_arrivee, heure_depart } = req.body;
    if (!date || !statut || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return res.status(400).json({ error: 'Missing fields (need date, statut, agent_ids[])' });
    }
    if (!['present', 'absent', 'retard', 'conge'].includes(statut)) {
      return res.status(400).json({ error: 'Invalid statut' });
    }

    const siteId = await getChefSiteId(req.user.id);
    if (!siteId) return res.status(400).json({ error: 'No site assigned to this chef' });

    const allowed = await pool.query(
      `SELECT agent_id FROM affectations WHERE site_id = $1 AND agent_id = ANY($2::int[])`,
      [siteId, agent_ids]
    );
    const allowedIds = allowed.rows.map(r => r.agent_id);
    if (allowedIds.length === 0) {
      return res.status(400).json({ error: 'No valid agents in request' });
    }

    // Build the multi-row INSERT manually so the values list is parameterised
    // ($1, $2, ...). node-pg expands the array as a single argument.
    const values = [];
    const placeholders = [];
    let i = 1;
    for (const aid of allowedIds) {
      placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, NOW())`);
      values.push(aid, date, statut, heure_arrivee || null, heure_depart || null);
    }

    const sql = `
      INSERT INTO presences (agent_id, date, statut, heure_arrivee, heure_depart, created_at)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT ON CONSTRAINT presences_agent_date_unique
      DO UPDATE SET
        statut        = EXCLUDED.statut,
        heure_arrivee = EXCLUDED.heure_arrivee,
        heure_depart  = EXCLUDED.heure_depart
      RETURNING *`;

    const r = await pool.query(sql, values);
    res.status(201).json({ count: r.rows.length, records: r.rows });
  } catch (e) {
    console.error('bulk record error:', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/presences — remove a single presence record (chef only).
router.delete('/', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { agent_id, date } = req.body;
    if (!agent_id || !date) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    await pool.query(
      'DELETE FROM presences WHERE agent_id = $1 AND date = $2::date',
      [agent_id, date]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/presences/day/:date — daily attendance report for one specific date.
router.get('/day/:date', verifyToken, role('chef_equipe'), async (req, res) => {
  try {
    const { date } = req.params;
    const siteId = await getChefSiteId(req.user.id);
    if (!siteId) return res.json([]);

    const agentsRes = await pool.query(
      `SELECT ag.id, ag.nom, ag.prenom,
              ag.nom || ' ' || ag.prenom AS agent_nom
       FROM agents ag
       JOIN affectations af ON ag.id = af.agent_id
       WHERE af.site_id = $1
       ORDER BY ag.nom, ag.prenom`,
      [siteId]
    );

    const presencesRes = await pool.query(
      'SELECT * FROM presences WHERE agent_id = ANY($1::int[]) AND date = $2::date',
      [agentsRes.rows.map(a => a.id), date]
    );

    const presenceMap = {};
    for (const p of presencesRes.rows) presenceMap[p.agent_id] = p;

    // Each row in the response has the agent fields plus a nested `presence`
    // object (or null if no entry was recorded for that day).
    const result = agentsRes.rows.map(ag => ({
      ...ag,
      presence: presenceMap[ag.id] || null
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
