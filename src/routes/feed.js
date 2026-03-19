const express = require('express');
const router = express.Router();

// GET /feed - Public feed for ActuarialAds integration (no auth required)
// Returns submissions with AI scores for display in Pipeline Creativo
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { estado, negocio, limit } = req.query;

    let query = `
      SELECT s.id, s.titulo, s.tipo, s.negocio, s.plataforma, s.estado,
             s.ai_score, s.ai_resumen, s.ai_veredicto,
             s.ai_fortalezas, s.ai_problemas, s.ai_recomendaciones,
             s.gemini_file_uri, s.archivo_url,
             s.admin_decision, s.admin_comentario, s.admin_reviewed_at,
             u.name as submitted_by,
             s.created_at, s.updated_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.estado NOT IN ('analizando', 'error')
    `;
    const params = [];
    let idx = 1;

    if (estado) { query += ` AND s.estado = $${idx++}`; params.push(estado); }
    if (negocio) { query += ` AND s.negocio = $${idx++}`; params.push(negocio); }

    query += ' ORDER BY s.created_at DESC';
    query += ` LIMIT $${idx++}`;
    params.push(parseInt(limit) || 50);

    const result = await pool.query(query, params);

    // Stats summary
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'evaluado') as pendientes_admin,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados,
        COUNT(*) FILTER (WHERE estado = 'rechazado' OR estado = 'rechazado_ai') as rechazados,
        COUNT(*) FILTER (WHERE estado = 'cambios') as con_cambios,
        ROUND(AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL)) as score_promedio
      FROM submissions
    `);

    res.json({
      source: 'magnetcreative',
      stats: stats.rows[0],
      submissions: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /feed/pending - Only submissions waiting for Amed's approval
router.get('/pending', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(`
      SELECT s.id, s.titulo, s.tipo, s.negocio, s.estado,
             s.ai_score, s.ai_resumen, s.ai_veredicto,
             s.gemini_file_uri, s.archivo_url,
             u.name as submitted_by,
             s.created_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.estado = 'evaluado'
      ORDER BY s.ai_score DESC, s.created_at ASC
      LIMIT 20
    `);
    res.json({ total: result.rows.length, submissions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
