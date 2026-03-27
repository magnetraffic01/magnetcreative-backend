const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    const pool = req.app.get('db');

    pool.query('SELECT id, email, name, role, negocio, negocios, tenant_id FROM users WHERE id = $1', [decoded.userId])
      .then(result => {
        if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
        req.user = result.rows[0];
        next();
      })
      .catch(() => res.status(500).json({ error: 'Server error' }));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!['admin', 'super_admin', 'tenant_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

function requireManager(req, res, next) {
  if (!['super_admin', 'tenant_admin', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireManager };
