const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for password reset
const resetRateLimitMap = new Map();
function resetRateLimit(email, maxPerHour = 3) {
  const key = email.toLowerCase();
  const now = Date.now();
  const hourAgo = now - 3600000;

  if (!resetRateLimitMap.has(key)) resetRateLimitMap.set(key, []);
  const timestamps = resetRateLimitMap.get(key).filter(t => t > hourAgo);
  resetRateLimitMap.set(key, timestamps);

  if (timestamps.length >= maxPerHour) return false;
  timestamps.push(now);
  return true;
}

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' });

    const token = jwt.sign({ userId: user.id, tenantId: user.tenant_id }, config.jwtSecret, { expiresIn: '7d' });
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Load tenant info for the user
    let tenantInfo = null;
    if (user.tenant_id) {
      const tenantResult = await pool.query('SELECT id, slug, name, logo_url, primary_color, secondary_color FROM tenants WHERE id = $1', [user.tenant_id]);
      if (tenantResult.rows.length > 0) tenantInfo = tenantResult.rows[0];
    }

    delete user.password_hash;
    res.json({ user, token, tenant: tenantInfo });
  } catch (error) { next(error); }
});

// POST /auth/register - Public registration (creates tenant + admin user + business)
router.post('/register', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, email, password, company_name, industry } = req.body;

    if (!name || !email || !password || !company_name) {
      return res.status(400).json({ error: 'Name, email, password and company name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check email doesn't exist
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered / Email ya registrado' });
    }

    // Create slug from company name
    const slug = company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 50);

    // Check slug doesn't exist
    const existingTenant = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existingTenant.rows.length > 0) {
      return res.status(409).json({ error: 'Company name already taken. Try a different name. / Nombre de empresa ya existe.' });
    }

    // 1. Create tenant
    const tenantResult = await pool.query(
      `INSERT INTO tenants (slug, name, plan, status)
       VALUES ($1, $2, 'starter', 'active') RETURNING *`,
      [slug, company_name]
    );
    const tenant = tenantResult.rows[0];

    // 2. Create user as tenant_admin
    const hash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, tenant_id)
       VALUES ($1, $2, $3, 'tenant_admin', $4) RETURNING id, email, name, role, tenant_id`,
      [email.toLowerCase(), hash, name, tenant.id]
    );
    const user = userResult.rows[0];

    // 3. Create default business from industry
    if (industry) {
      try {
        await pool.query(
          `INSERT INTO businesses (tenant_id, name, description)
           VALUES ($1, $2, $3)`,
          [tenant.id, company_name, industry]
        );
      } catch (e) { /* business creation is optional */ }
    }

    // 4. Generate JWT
    const token = jwt.sign({ userId: user.id, tenantId: tenant.id }, config.jwtSecret, { expiresIn: '7d' });

    console.log(`[Register] New tenant: ${company_name} (${slug}), user: ${email}, industry: ${industry || 'none'}`);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: tenant.id },
      token,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, primary_color: tenant.primary_color, secondary_color: tenant.secondary_color }
    });
  } catch (error) { next(error); }
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /auth/create-user (admin only)
router.post('/create-user', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email, password, name, role, negocio, negocios } = req.body;

    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name required' });

    const validRoles = ['creative', 'manager', 'admin', 'tenant_admin'];
    const finalRole = validRoles.includes(role) ? role : 'creative';

    // Role escalation prevention
    const allowedRoles = req.user.role === 'super_admin'
      ? ['creative', 'manager', 'admin', 'tenant_admin', 'super_admin']
      : ['creative', 'manager']; // tenant_admin can only create creative and manager
    if (finalRole && !allowedRoles.includes(finalRole)) {
      return res.status(403).json({ error: 'Cannot assign that role / No puedes asignar ese rol' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const negociosArray = negocios || (negocio ? [negocio] : []);
    const tenantId = req.body.tenant_id || req.user.tenant_id;

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, negocio, negocios, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, name, role, negocio, negocios, tenant_id',
      [email, hash, name, finalRole, negociosArray[0] || null, JSON.stringify(negociosArray), tenantId || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

// GET /auth/users (admin only)
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query('SELECT id, email, name, role, negocio, negocios, created_at, last_login_at FROM users ORDER BY created_at');
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});

// PUT /auth/users/:id (admin only - edit user)
router.put('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, email, password, role, negocio, negocios } = req.body;
    const userId = req.params.id;

    // Check user exists
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Check email uniqueness if changed
    if (email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) return res.status(409).json({ error: 'Email ya existe' });
    }

    // Role escalation prevention
    const allowedRoles = req.user.role === 'super_admin'
      ? ['creative', 'manager', 'admin', 'tenant_admin', 'super_admin']
      : ['creative', 'manager']; // tenant_admin can only create creative and manager
    if (role && !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Cannot assign that role / No puedes asignar ese rol' });
    }

    const negociosArray = negocios || (negocio ? [negocio] : []);

    // Build update query dynamically
    let query = 'UPDATE users SET name = $1, email = $2, role = $3, negocio = $4, negocios = $5';
    let params = [name, email, role || 'creative', negociosArray[0] || null, JSON.stringify(negociosArray)];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += ', password_hash = $6 WHERE id = $7';
      params.push(hash, userId);
    } else {
      query += ' WHERE id = $6';
      params.push(userId);
    }

    query += ' RETURNING id, email, name, role, negocio, negocios';

    const result = await pool.query(query, params);
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

// DELETE /auth/users/:id (admin only)
router.delete('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const userId = req.params.id;

    // Prevent self-deletion
    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ success: true });
  } catch (error) { next(error); }
});

// POST /auth/setup-admin (first time setup - only works if admin has no password set)
router.post('/setup-admin', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { password } = req.body;

    if (!password) return res.status(400).json({ error: 'Password required' });

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@magnetraffic.com';
    const admin = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [adminEmail]);
    if (admin.rows.length === 0) return res.status(404).json({ error: 'Admin user not found' });

    // Only allow setup if admin has no password (first-time setup)
    if (admin.rows[0].password_hash) {
      return res.status(403).json({ error: 'Admin already configured. Use login instead.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, adminEmail]);

    const token = jwt.sign({ userId: admin.rows[0].id }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ message: 'Admin password set', token });
  } catch (error) { next(error); }
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    if (!resetRateLimit(email)) {
      return res.status(429).json({ error: 'Too many reset attempts. Try again in 1 hour.' });
    }

    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const code = crypto.randomBytes(16).toString('hex');
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await pool.query(
        'UPDATE users SET reset_code = $1, reset_code_expires = $2 WHERE email = $3',
        [code, expires, email]
      );

      console.log(`[Password Reset] Code generated for ${email}: ${code}`);
    }

    res.json({ message: 'If the email exists, a code was generated' });
  } catch (error) { next(error); }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and newPassword required' });

    const result = await pool.query('SELECT id, reset_code, reset_code_expires FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Codigo invalido o expirado' });

    const user = result.rows[0];

    if (!user.reset_code || user.reset_code !== code) {
      return res.status(400).json({ error: 'Codigo invalido o expirado' });
    }

    if (new Date(user.reset_code_expires) < new Date()) {
      return res.status(400).json({ error: 'Codigo invalido o expirado' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
      [hash, user.id]
    );

    res.json({ message: 'Password actualizado correctamente' });
  } catch (error) { next(error); }
});

module.exports = router;
