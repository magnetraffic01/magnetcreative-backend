async function resolveTenant(req, res, next) {
  // Super admins can access without tenant
  if (req.user && req.user.role === 'super_admin') {
    req.tenant = null; // super_admin sees all
    return next();
  }

  // Resolve from user's tenant_id (set during auth)
  if (req.user && req.user.tenant_id) {
    try {
      const pool = req.app.get('db');
      const result = await pool.query('SELECT * FROM tenants WHERE id = $1 AND status = $2', [req.user.tenant_id, 'active']);
      if (result.rows.length > 0) {
        req.tenant = result.rows[0];
        return next();
      }
    } catch (e) {}
  }

  // No tenant found - allow request but without tenant context
  // This maintains backward compatibility
  req.tenant = null;
  next();
}

module.exports = { resolveTenant };
