// JWT verification middleware.
// Reads the `Authorization: Bearer <token>` header, validates the token with
// JWT_SECRET, and attaches the decoded payload to `req.user`.
//
// Downstream handlers (and the `role()` middleware) read `req.user.role` to
// decide what the caller is allowed to do.

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token manquant'
    });
  }

  try {
    // jwt.verify throws if the token is expired, malformed, or signed with a
    // different secret. Either way we surface a 401 to the caller.
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(401).json({
      error: 'Token invalide'
    });
  }
};
