const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /businesses - List businesses for current tenant (or all for super_admin)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    let result;
    if (req.user.role === 'super_admin') {
      result = await pool.query('SELECT b.*, t.name as tenant_name FROM businesses b JOIN tenants t ON b.tenant_id = t.id ORDER BY b.name');
    } else if (req.user.tenant_id) {
      result = await pool.query('SELECT * FROM businesses WHERE tenant_id = $1 ORDER BY name', [req.user.tenant_id]);
    } else {
      result = { rows: [] };
    }
    res.json({ businesses: result.rows });
  } catch (error) { next(error); }
});

// POST /businesses - Create business
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, description, audience, tone, colors, visual_style, rules, products, urls } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const tenantId = req.body.tenant_id || req.user.tenant_id;
    if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

    const result = await pool.query(
      `INSERT INTO businesses (tenant_id, name, description, audience, tone, colors, visual_style, rules, products, urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [tenantId, name, description, audience, tone, colors, visual_style, rules, products, urls]
    );
    res.json({ business: result.rows[0] });
  } catch (error) { next(error); }
});

// PUT /businesses/:id - Update business
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { name, description, audience, tone, colors, visual_style, rules, products, urls } = req.body;

    // Verify ownership (tenant_admin can only edit their own)
    const check = await pool.query('SELECT tenant_id FROM businesses WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'super_admin' && check.rows[0].tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `UPDATE businesses SET name = COALESCE($1, name), description = COALESCE($2, description),
       audience = COALESCE($3, audience), tone = COALESCE($4, tone), colors = COALESCE($5, colors),
       visual_style = COALESCE($6, visual_style), rules = COALESCE($7, rules),
       products = COALESCE($8, products), urls = COALESCE($9, urls)
       WHERE id = $10 RETURNING *`,
      [name, description, audience, tone, colors, visual_style, rules, products, urls, req.params.id]
    );
    res.json({ business: result.rows[0] });
  } catch (error) { next(error); }
});

// DELETE /businesses/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const check = await pool.query('SELECT tenant_id FROM businesses WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'super_admin' && check.rows[0].tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query('DELETE FROM businesses WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { next(error); }
});

module.exports = router;
