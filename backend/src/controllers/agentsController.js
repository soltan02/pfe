const pool = require('../config/db');

const getAll = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM agents ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
};

const getOne = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM agents WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Agent non trouvé' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
};

const create = async (req, res) => {
  const { nom, prenom, matricule, telephone } = req.body;
  if (!nom || !prenom || !matricule)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  try {
    const r = await pool.query(
      'INSERT INTO agents (nom,prenom,matricule,telephone) VALUES ($1,$2,$3,$4) RETURNING *',
      [nom, prenom, matricule, telephone]
    );
    res.status(201).json(r.rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Matricule déjà utilisé' });
    res.status(500).json({ error: e.message });
  }
};

const update = async (req, res) => {
  const { nom, prenom, matricule, telephone, statut } = req.body;
  try {
    const r = await pool.query(
      'UPDATE agents SET nom=$1,prenom=$2,matricule=$3,telephone=$4,statut=$5 WHERE id=$6 RETURNING *',
      [nom, prenom, matricule, telephone, statut, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Agent non trouvé' });
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
};

const remove = async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM agents WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Agent non trouvé' });
    res.json({ message: 'Agent supprimé' });
  } catch(e) { res.status(500).json({ error: e.message }); }
};

module.exports = { getAll, getOne, create, update, remove };