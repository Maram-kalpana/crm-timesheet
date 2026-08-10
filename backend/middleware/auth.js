const jwt = require('jsonwebtoken');
const { normalizeRole } = require('./rbac');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    decoded.role = normalizeRole(decoded.role);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  const normalized = roles.map((r) => (r === 'manager' ? 'team_lead' : r));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const userRole = normalizeRole(req.user.role);
    if (!normalized.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
