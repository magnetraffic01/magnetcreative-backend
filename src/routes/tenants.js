const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /tenants - List all tenants
router.get('/', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json({ tenants: result.rows });
  } catch (error) { next(error); }
});

// POST /tenants - Create tenant
router.post('/', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, slug, domain, logo_url, primary_color, secondary_color, plan, max_users, max_evaluations_month } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });

    const result = await pool.query(
      `INSERT INTO tenants (name, slug, domain, logo_url, primary_color, secondary_color, plan, max_users, max_evaluations_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, slug, domain || null, logo_url || null, primary_color || '#D4AF37', secondary_color || '#1a365d', plan || 'starter', max_users || 10, max_evaluations_month || 100]
    );
    res.json({ tenant: result.rows[0] });
  } catch (error) { next(error); }
});

// PUT /tenants/:id - Update tenant
router.put('/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, domain, logo_url, primary_color, secondary_color, plan, status, max_users, max_evaluations_month } = req.body;
    const result = await pool.query(
      `UPDATE tenants SET name = COALESCE($1, name), domain = COALESCE($2, domain), logo_url = COALESCE($3, logo_url),
       primary_color = COALESCE($4, primary_color), secondary_color = COALESCE($5, secondary_color),
       plan = COALESCE($6, plan), status = COALESCE($7, status),
       max_users = COALESCE($8, max_users), max_evaluations_month = COALESCE($9, max_evaluations_month)
       WHERE id = $10 RETURNING *`,
      [name, domain, logo_url, primary_color, secondary_color, plan, status, max_users, max_evaluations_month, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ tenant: result.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
