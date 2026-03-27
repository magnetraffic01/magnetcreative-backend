const express = require('express');
const router = express.Router();

// GET /feed - Public feed for ActuarialAds integration (no auth required)
// Returns submissions with AI scores for display in Pipeline Creativo
router.get('/', async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { estado, negocio, limit, tenant_id } = req.query;

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

    // Optional tenant scoping via query param
    if (tenant_id) { query += ` AND s.tenant_id = $${idx++}`; params.push(tenant_id); }
    if (estado) { query += ` AND s.estado = $${idx++}`; params.push(estado); }
    if (negocio) { query += ` AND s.negocio = $${idx++}`; params.push(negocio); }

    query += ' ORDER BY s.created_at DESC';
    query += ` LIMIT $${idx++}`;
    params.push(parseInt(limit) || 50);

    const result = await pool.query(query, params);

    // Stats summary (also tenant-scoped if provided)
    let statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE s.estado = 'evaluado') as pendientes_admin,
        COUNT(*) FILTER (WHERE s.estado = 'aprobado') as aprobados,
        COUNT(*) FILTER (WHERE s.estado = 'rechazado' OR s.estado = 'rechazado_ai') as rechazados,
        COUNT(*) FILTER (WHERE s.estado = 'cambios') as con_cambios,
        ROUND(AVG(s.ai_score) FILTER (WHERE s.ai_score IS NOT NULL)) as score_promedio
      FROM submissions s
    `;
    const statsParams = [];
    if (tenant_id) {
      statsQuery += ` WHERE s.tenant_id = $1`;
      statsParams.push(tenant_id);
    }
    const stats = await pool.query(statsQuery, statsParams);

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
    const { tenant_id } = req.query;
    const pendingParams = [];
    let pendingTenantFilter = '';
    if (tenant_id) {
      pendingParams.push(tenant_id);
      pendingTenantFilter = ` AND s.tenant_id = $1`;
    }
    const result = await pool.query(`
      SELECT s.id, s.titulo, s.tipo, s.negocio, s.estado,
             s.ai_score, s.ai_resumen, s.ai_veredicto,
             s.gemini_file_uri, s.archivo_url,
             u.name as submitted_by,
             s.created_at
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.estado = 'evaluado'${pendingTenantFilter}
      ORDER BY s.ai_score DESC, s.created_at ASC
      LIMIT 20
    `, pendingParams);
    res.json({ total: result.rows.length, submissions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
