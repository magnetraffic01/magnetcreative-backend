const express = require('express');
const config = require('../config');

const router = express.Router();

const ADMIN_REVIEW_THRESHOLD = 70;

// POST /submissions/analysis-callback - n8n sends analysis results here
router.post('/analysis-callback', async (req, res, next) => {
  try {
    // Verify webhook secret
    const secret = req.headers['x-webhook-secret'];
    if (config.n8nApiKey && secret !== config.n8nApiKey) {
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }

    const pool = req.app.get('db');
    const {
      submission_id, score, resumen, veredicto,
      hook_presente, hook_descripcion,
      cta_presente, cta_descripcion,
      fortalezas, problemas, recomendaciones,
      uso_recomendado
    } = req.body;

    if (!submission_id) {
      return res.status(400).json({ error: 'submission_id is required' });
    }

    const finalScore = score || 50;
    const estado = finalScore >= ADMIN_REVIEW_THRESHOLD ? 'evaluado' : 'rechazado_ai';

    await pool.query(`
      UPDATE submissions SET
        estado = $13,
        ai_score = $1, ai_resumen = $2, ai_veredicto = $3,
        ai_hook_presente = $4, ai_hook_descripcion = $5,
        ai_cta_presente = $6, ai_cta_descripcion = $7,
        ai_fortalezas = $8, ai_problemas = $9, ai_recomendaciones = $10,
        ai_uso_recomendado = $11, ai_analyzed_at = NOW(), updated_at = NOW()
      WHERE id = $12
    `, [
      finalScore, resumen || 'Sin resumen', veredicto || 'cambios',
      hook_presente ?? null, hook_descripcion || null,
      cta_presente ?? null, cta_descripcion || null,
      JSON.stringify(fortalezas || []), JSON.stringify(problemas || []),
      JSON.stringify(recomendaciones || []), uso_recomendado || null,
      submission_id, estado
    ]);

    console.log(`[Callback] Submission #${submission_id} updated: score=${finalScore}, estado=${estado}`);
    res.json({ success: true });
  } catch (error) { next(error); }
});

module.exports = router;
