const express = require('express');
const { analyzeSubmission } = require('../services/ai-router');
const config = require('../config');

const router = express.Router();

const ADMIN_REVIEW_THRESHOLD = 70;

// POST /submissions/async-analyze - Called by n8n to run full analysis with all context
router.post('/async-analyze', async (req, res, next) => {
  try {
    // Verify webhook secret
    const secret = req.headers['x-webhook-secret'];
    if (config.n8nApiKey && secret !== config.n8nApiKey) {
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }

    const pool = req.app.get('db');
    const { submission_id } = req.body;

    if (!submission_id) {
      return res.status(400).json({ error: 'submission_id is required' });
    }

    // Get full submission from DB
    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission_id]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];
    submission._dbPool = pool;
    submission.objetivo = req.body.objetivo || submission.objetivo;

    console.log(`[Async] Analyzing submission #${submission_id}: ${submission.titulo} (${submission.tipo})`);

    // Run FULL analysis with all context (knowledge base, rubrics, StoryBrand, etc.)
    const analysis = await analyzeSubmission(submission, null, null);

    const finalScore = analysis.score || 50;
    const estado = finalScore >= ADMIN_REVIEW_THRESHOLD ? 'evaluado' : 'rechazado_ai';

    // Update submission with results
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
      finalScore, analysis.resumen || 'Sin resumen', analysis.veredicto || 'cambios',
      analysis.hook_presente ?? analysis.hook_primeros_3s ?? null, analysis.hook_descripcion || null,
      analysis.cta_presente ?? null, analysis.cta_descripcion || null,
      JSON.stringify(analysis.fortalezas || []), JSON.stringify(analysis.problemas || []),
      JSON.stringify(analysis.recomendaciones || []), analysis.uso_recomendado || null,
      submission_id, estado
    ]);

    console.log(`[Async] Submission #${submission_id} done: score=${finalScore}, estado=${estado}`);

    res.json({
      success: true,
      submission_id,
      score: finalScore,
      estado,
      veredicto: analysis.veredicto
    });
  } catch (error) {
    console.error(`[Async] Error:`, error.message);
    next(error);
  }
});

module.exports = router;
