// Agents endpoints.
// Visibility: admin sees everything, chef_equipe sees their site only.

const router = require('express').Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const verifyToken = require('../middleware/auth');
const role = require('../middleware/roles');

router.get(
  '/',
  verifyToken,
  role('chef_equipe'),
  async (req, res) => {
    try {
      let r;
      if (req.user.role === 'admin') {
        r = await pool.query(
          `SELECT DISTINCT a.*,
                  s.nom AS site_nom, s.id AS site_id,
                  cu.nom AS chef_nom
           FROM agents a
           LEFT JOIN affectations af ON af.agent_id = a.id
           LEFT JOIN sites s ON s.id = af.site_id
           LEFT JOIN users cu ON cu.id = s.chef_id
           ORDER BY s.nom NULLS LAST, a.id`
        );
      } else {
        r = await pool.query(
          `SELECT DISTINCT a.*,
                  s.nom AS site_nom, s.id AS site_id,
                  cu.nom AS chef_nom
           FROM agents a
           INNER JOIN affectations af ON af.agent_id = a.id
           INNER JOIN sites s ON s.id = af.site_id
           LEFT JOIN users cu ON cu.id = s.chef_id
           WHERE s.chef_id = $1
           ORDER BY a.id`,
          [req.user.id]
        );
      }

      res.json(r.rows);

    } catch (e) {
      res.status(500).json({
        error: e.message
      });
    }
  }
);

// GET /api/agents/me/profile — returns the agents row for the connected user.
// Used by the agent profile page.
router.get(
  '/me/profile',
  verifyToken,
  role('agent'),
  async (req, res) => {

    try {

      const result = await pool.query(
        `
        SELECT
          a.*
        FROM agents a
        INNER JOIN users u
          ON u.agent_id = a.id
        WHERE u.id = $1
        `,
        [req.user.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          error: 'Profile not found'
        });
      }

      res.json(result.rows[0]);

    } catch (e) {
      res.status(500).json({
        error: e.message
      });
    }
  }
);

router.get(
  '/:id',
  verifyToken,
  role('chef_equipe'),
  async (req, res) => {
    try {

      const r = await pool.query(
        'SELECT * FROM agents WHERE id=$1',
        [req.params.id]
      );

      if (!r.rows.length) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      res.json(r.rows[0]);

    } catch (e) {
      res.status(500).json({
        error: e.message
      });
    }
  }
);

// POST /api/agents — create an agent + their user account in one shot.
// When the creator is an admin and they tick "chef_equipe" in the form, the
// new user is promoted to chef_equipe role.
router.post(
  '/',
  verifyToken,
  role('chef_equipe'),
  async (req, res) => {

    const {
      nom,
      prenom,
      matricule,
      telephone,
      account_role
    } = req.body;

    if (!nom || !prenom || !matricule) {
      return res.status(400).json({
        error: 'Required fields missing'
      });
    }

    try {

      const exists = await pool.query(
        'SELECT id FROM agents WHERE matricule = $1',
        [matricule]
      );

      if (exists.rows.length > 0) {
        return res.status(409).json({
          error: 'Badge number already in use'
        });
      }

      const agentResult = await pool.query(
        `
        INSERT INTO agents
        (nom, prenom, matricule, telephone)
        VALUES ($1,$2,$3,$4)
        RETURNING *
        `,
        [nom, prenom, matricule, telephone]
      );

      const agent = agentResult.rows[0];

      // Default password is the matricule — the agent can change it after login.
      const hash = await bcrypt.hash(
        matricule,
        10
      );

      const email =
        matricule + '@stb.tn';

      const userExists = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      const userRole = (req.user.role === 'admin' && account_role === 'chef_equipe') ? 'chef_equipe' : 'agent';

      if (userExists.rows.length === 0) {

        await pool.query(
          `
          INSERT INTO users
          (
            nom,
            email,
            password,
            role,
            agent_id
          )
          VALUES ($1,$2,$3,$4,$5)
          `,
          [
            nom + ' ' + prenom,
            email,
            hash,
            userRole,
            agent.id
          ]
        );
      }

      // If we just created a regular agent under a chef, automatically assign
      // them to every site that chef manages for the next 3 months. This
      // keeps the pointage page immediately useful.
      if (userRole === 'agent') {
        const chefSites = await pool.query(
          'SELECT id FROM sites WHERE chef_id = $1',
          [req.user.id]
        );

        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 3);
        for (const site of chefSites.rows) {
          await pool.query(
            `INSERT INTO affectations (agent_id, site_id, date_debut, date_fin)
             VALUES ($1, $2, $3, $4)`,
            [agent.id, site.id, today.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
          );
        }
      }

      // Return the credentials so the frontend can show them to the operator
      // who is creating the agent (they need to communicate them to the agent).
      res.status(201).json({
        ...agent,
        login_info: {
          email,
          password: matricule,
          role: userRole
        }
      });

    } catch (e) {

      res.status(500).json({
        error: e.message
      });
    }
  }
);

router.put(
  '/:id',
  verifyToken,
  role('admin'),
  async (req, res) => {

    const {
      nom,
      prenom,
      matricule,
      telephone,
      statut
    } = req.body;

    try {

      const r = await pool.query(
        `
        UPDATE agents
        SET
          nom=$1,
          prenom=$2,
          matricule=$3,
          telephone=$4,
          statut=$5
        WHERE id=$6
        RETURNING *
        `,
        [
          nom,
          prenom,
          matricule,
          telephone,
          statut,
          req.params.id
        ]
      );

      if (!r.rows.length) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      res.json(r.rows[0]);

    } catch (e) {

      res.status(500).json({
        error: e.message
      });
    }
  }
);

// DELETE /api/agents/:id — admin only. Cascades to the linked user account
// and clears any sites.chef_id that pointed at it, so the chef assignment
// doesn't end up referencing a deleted user.
router.delete(
  '/:id',
  verifyToken,
  role('admin'),
  async (req, res) => {

    try {
      const agentId = req.params.id;

      const userResult = await pool.query(
        'SELECT id FROM users WHERE agent_id = $1',
        [agentId]
      );
      const userId = userResult.rows[0]?.id;

      if (userId) {
        await pool.query('UPDATE sites SET chef_id = NULL WHERE chef_id = $1', [userId]);
      }

      await pool.query('DELETE FROM users WHERE agent_id = $1', [agentId]);
      await pool.query('DELETE FROM affectations WHERE agent_id = $1', [agentId]);
      await pool.query('DELETE FROM presences WHERE agent_id = $1', [agentId]);

      const r = await pool.query(
        'DELETE FROM agents WHERE id=$1 RETURNING id',
        [agentId]
      );

      if (!r.rows.length) {
        return res.status(404).json({
          error: 'Agent not found'
        });
      }

      res.json({
        message: 'Agent deleted'
      });

    } catch (e) {
      console.error('Delete agent error:', e.message);
      res.status(500).json({
        error: e.message
      });
    }
  }
);

module.exports = router;
