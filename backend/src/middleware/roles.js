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
    const allowed = roles.some(role => userLevel >= (ROLE_LEVELS[role] || 0));

    if (!allowed) {
      return res.status(403).json({
        error: 'Accès refusé'
      });
    }

    next();
  };
};