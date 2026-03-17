const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /admin/review/:id - Approve/reject submission
router.post('/review/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { decision, comentario } = req.body;

    if (!decision || !['aprobado', 'cambios', 'rechazado'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be: aprobado, cambios, or rechazado' });
    }

    const result = await pool.query(`
      UPDATE submissions SET
        estado = $1,
        admin_decision = $1,
        admin_comentario = $2,
        admin_reviewed_at = NOW(),
        admin_reviewed_by = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [decision, comentario || null, req.user.id, req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

// GET /admin/pending - Get submissions waiting for review
router.get('/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(`
      SELECT s.*, u.name as submitted_by
      FROM submissions s JOIN users u ON s.user_id = u.id
      WHERE s.estado = 'evaluado'
      ORDER BY s.ai_score DESC, s.created_at ASC
    `);
    res.json({ submissions: result.rows });
  } catch (error) { next(error); }
});

// GET /admin/stats
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');

    const general = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'evaluado') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados,
        COUNT(*) FILTER (WHERE estado = 'rechazado') as rechazados,
        COUNT(*) FILTER (WHERE estado = 'cambios') as con_cambios,
        ROUND(AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL)) as score_promedio
      FROM submissions
    `);

    const byNegocio = await pool.query(`
      SELECT negocio, COUNT(*) as total,
        ROUND(AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL)) as score_promedio,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados
      FROM submissions GROUP BY negocio ORDER BY total DESC
    `);

    const byUser = await pool.query(`
      SELECT u.name, COUNT(*) as total,
        ROUND(AVG(s.ai_score) FILTER (WHERE s.ai_score IS NOT NULL)) as score_promedio,
        COUNT(*) FILTER (WHERE s.estado = 'aprobado') as aprobados
      FROM submissions s JOIN users u ON s.user_id = u.id
      GROUP BY u.name ORDER BY total DESC
    `);

    const recent = await pool.query(`
      SELECT s.*, u.name as submitted_by
      FROM submissions s JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC LIMIT 10
    `);

    res.json({
      stats: general.rows[0],
      byNegocio: byNegocio.rows,
      byUser: byUser.rows,
      recent: recent.rows
    });
  } catch (error) { next(error); }
});

module.exports = router;
