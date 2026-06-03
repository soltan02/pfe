const pool = require('../config/db');

const getAll = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT af.*,
        ag.nom || ' ' || ag.prenom AS agent_nom,
        s.nom AS site_nom
      FROM affectations af
      JOIN agents ag ON af.agent_id = ag.id
      JOIN sites s ON af.site_id = s.id
      ORDER BY af.id DESC
    `);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
};

const create = async (req, res) => {
  const { agent_id, site_id, date_debut, date_fin } = req.body;
  if (!agent_id || !site_id || !date_debut)
    return res.status(400).json({ error: 'Champs manquants' });
  try {
    const r = await pool.query(
      'INSERT INTO affectations (agent_id,site_id,date_debut,date_fin) VALUES ($1,$2,$3,$4) RETURNING *',
      [agent_id, site_id, date_debut, date_fin]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
};

const remove = async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM affectations WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Affectation non trouvée' });
    res.json({ message: 'Affectation supprimée' });
  } catch(e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getAll, create, remove };
