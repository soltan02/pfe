// Role-based access control middleware.
//
// We use a small numeric scale instead of a literal role match so that
// `role('agent')` accepts agents, chefs, AND admins (anyone at the agent
// "level" or above). The order is intentional:
//   agent      = 1
//   chef_equipe = 2   (manages a team)
//   admin      = 3   (does everything)
// So an admin automatically passes any `role('chef_equipe')` or `role('agent')`
// gate, and a chef passes any `role('agent')` gate. Routes that must be
// admin-only use `role('admin')` directly.

const ROLE_LEVELS = {
  agent: 1,
  chef_equipe: 2,
  admin: 3
};

module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Utilisateur non authentifié'
      });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    // Pass if the user is at or above ANY of the required roles.
    const allowed = roles.some(role => userLevel >= (ROLE_LEVELS[role] || 0));

    if (!allowed) {
      return res.status(403).json({
        error: 'Accès refusé'
      });
    }

    next();
  };
};
