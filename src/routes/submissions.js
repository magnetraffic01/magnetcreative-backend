const express = require('express');
const { authenticate } = require('../middleware/auth');
const { analyzeContent, getApiKey } = require('../services/gemini');

const router = express.Router();

// GET /submissions/gemini-key - Frontend gets key to upload directly to Gemini
router.get('/gemini-key', authenticate, (req, res) => {
  res.json({ key: getApiKey() });
});

// POST /submissions - Submit creative (frontend already uploaded to Gemini)
router.post('/', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || 'video';

    // Insert submission with Gemini URI from frontend
    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', formato, descripcion, archivo_url, gemini_file_uri, contenido_email]);

    const submission = result.rows[0];
    console.log(`[Submission] Created #${submission.id}: ${titulo} (${finalTipo}), Gemini URI: ${gemini_file_uri || 'none'}`);

    // Analyze with AI
    try {
      const analysis = await analyzeContent(submission);

      await pool.query(`
        UPDATE submissions SET
          estado = 'evaluado',
          ai_score = $1, ai_resumen = $2, ai_veredicto = $3,
          ai_hook_presente = $4, ai_hook_descripcion = $5,
          ai_cta_presente = $6, ai_cta_descripcion = $7,
          ai_fortalezas = $8, ai_problemas = $9, ai_recomendaciones = $10,
          ai_uso_recomendado = $11, ai_analyzed_at = NOW(), updated_at = NOW()
        WHERE id = $12
      `, [
        analysis.score || 50, analysis.resumen || 'Sin resumen', analysis.veredicto || 'cambios',
        analysis.hook_presente ?? analysis.hook_primeros_3s ?? null, analysis.hook_descripcion || null,
        analysis.cta_presente ?? null, analysis.cta_descripcion || null,
        JSON.stringify(analysis.fortalezas || []), JSON.stringify(analysis.problemas || []),
        JSON.stringify(analysis.recomendaciones || []), analysis.uso_recomendado || null,
        submission.id
      ]);

      const updated = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
      res.json({ submission: updated.rows[0] });

    } catch (aiErr) {
      console.error('AI analysis error:', aiErr.message);
      await pool.query("UPDATE submissions SET estado = 'error' WHERE id = $1", [submission.id]);
      res.status(500).json({ error: 'AI analysis failed', details: aiErr.message });
    }

  } catch (error) { next(error); }
});

// POST /submissions/email - Analyze email (text only)
router.post('/email', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, negocio, contenido_email, descripcion } = req.body;

    if (!titulo || !negocio || !contenido_email) {
      return res.status(400).json({ error: 'Titulo, negocio and contenido_email are required' });
    }

    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, descripcion, contenido_email, estado)
      VALUES ($1, $2, 'email', $3, $4, $5, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, negocio, descripcion, contenido_email]);

    const submission = result.rows[0];
    const analysis = await analyzeContent(submission);

    await pool.query(`
      UPDATE submissions SET
        estado = 'evaluado',
        ai_score = $1, ai_resumen = $2, ai_veredicto = $3,
        ai_cta_presente = $4, ai_cta_descripcion = $5,
        ai_fortalezas = $6, ai_problemas = $7, ai_recomendaciones = $8,
        ai_analyzed_at = NOW(), updated_at = NOW()
      WHERE id = $9
    `, [
      analysis.score || 50, analysis.resumen || 'Sin resumen', analysis.veredicto || 'cambios',
      analysis.cta_presente ?? null, analysis.cta_descripcion || null,
      JSON.stringify(analysis.fortalezas || []), JSON.stringify(analysis.problemas || []),
      JSON.stringify(analysis.recomendaciones || []), submission.id
    ]);

    const updated = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
    res.json({ submission: updated.rows[0] });

  } catch (error) { next(error); }
});

// GET /submissions - List
router.get('/', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { tipo, negocio, estado } = req.query;

    let query = 'SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id WHERE 1=1';
    const params = [];

    if (req.user.role === 'creative') {
      params.push(req.user.id);
      query += ` AND s.user_id = $${params.length}`;
    }

    if (tipo) { params.push(tipo); query += ` AND s.tipo = $${params.length}`; }
    if (negocio) { params.push(negocio); query += ` AND s.negocio = $${params.length}`; }
    if (estado) { params.push(estado); query += ` AND s.estado = $${params.length}`; }

    query += ' ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ submissions: result.rows });
  } catch (error) { next(error); }
});

// GET /submissions/stats/dashboard
router.get('/stats/dashboard', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const stats = await pool.query(`
      SELECT COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'evaluado') as pendientes_revision,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados,
        COUNT(*) FILTER (WHERE estado = 'rechazado') as rechazados,
        ROUND(AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL)) as score_promedio
      FROM submissions
    `);
    res.json({ stats: stats.rows[0] });
  } catch (error) { next(error); }
});

// GET /submissions/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(
      'SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id WHERE s.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
