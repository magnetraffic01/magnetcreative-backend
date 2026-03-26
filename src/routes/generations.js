const express = require('express');
const { authenticate } = require('../middleware/auth');
const { generateImprovedImage, generateIteration } = require('../services/image-generator');

const router = express.Router();

// POST /submissions/:id/generate - Trigger GPT-4o generation from AI recommendations
router.post('/:id/generate', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const submissionId = req.params.id;
    const config = require('../config');

    // Pre-check: OpenAI API key
    if (!config.openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key no configurada en el servidor. Agrega OPENAI_API_KEY en las variables de entorno.' });
    }

    // Pre-check: submission_versions table exists
    try {
      await pool.query('SELECT 1 FROM submission_versions LIMIT 0');
    } catch (tableErr) {
      console.error('[Generation] Table submission_versions does not exist. Running migration...');
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS submission_versions (
            id SERIAL PRIMARY KEY,
            submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL DEFAULT 1,
            tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('original', 'generated', 'iteration')),
            image_url TEXT,
            generation_prompt TEXT,
            generation_model VARCHAR(50),
            ai_score INTEGER,
            ai_recomendaciones JSONB DEFAULT '[]',
            client_feedback TEXT,
            client_satisfied BOOLEAN,
            created_at TIMESTAMP DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_sv_submission ON submission_versions(submission_id);
        `);
        await pool.query(`
          ALTER TABLE submissions ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
          ALTER TABLE submissions ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT NULL;
        `);
        console.log('[Generation] Migration 007 applied inline');
      } catch (migErr) {
        return res.status(500).json({ error: 'Error creando tabla submission_versions: ' + migErr.message });
      }
    }

    // Get submission with AI analysis
    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];

    // Verify ownership or admin
    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }

    // Check that AI analysis exists
    if (!submission.ai_score) {
      return res.status(400).json({ error: 'Aun no analizada / Not analyzed yet' });
    }

    // Update status to generating
    await pool.query(
      "UPDATE submissions SET generation_status = 'generating', updated_at = NOW() WHERE id = $1",
      [submissionId]
    );

    console.log(`[Generation] Starting generation for submission #${submissionId}`);

    const recommendations = {
      fortalezas: safeParseJSON(submission.ai_fortalezas, []),
      problemas: safeParseJSON(submission.ai_problemas, []),
      recomendaciones: safeParseJSON(submission.ai_recomendaciones, [])
    };

    const version = await generateImprovedImage(submission, recommendations, pool);

    // Add file download URL to the version
    if (version.image_url && !version.image_url.startsWith('http')) {
      version.file_download_url = `/submissions/${submissionId}/versions/${version.id}/file`;
    }

    console.log(`[Generation] Generation complete for submission #${submissionId}`);
    res.json({ version });
  } catch (error) {
    console.error(`[Generation] Error for submission #${req.params.id}:`, error.message);
    // Reset generation status on error
    try {
      const pool = req.app.get('db');
      await pool.query(
        "UPDATE submissions SET generation_status = 'error', updated_at = NOW() WHERE id = $1",
        [req.params.id]
      );
    } catch (e) { /* ignore */ }
    // Return error details instead of generic 500
    res.status(500).json({ error: error.message || 'Error generando imagen' });
  }
});

// POST /submissions/:id/iterate - Request iteration with client feedback
router.post('/:id/iterate', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const submissionId = req.params.id;
    const { version_id, feedback } = req.body;

    if (!feedback) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    // Get submission
    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];

    // Verify ownership or admin
    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }

    // If no version_id provided, use the latest version
    let targetVersionId = version_id;
    if (!targetVersionId) {
      const latestResult = await pool.query(
        'SELECT id FROM submission_versions WHERE submission_id = $1 ORDER BY version_number DESC LIMIT 1',
        [submissionId]
      );
      if (latestResult.rows.length === 0) {
        return res.status(400).json({ error: 'No hay versiones generadas para iterar' });
      }
      targetVersionId = latestResult.rows[0].id;
    }

    // Update status to generating
    await pool.query(
      "UPDATE submissions SET generation_status = 'generating', updated_at = NOW() WHERE id = $1",
      [submissionId]
    );

    console.log(`[Generation] Starting iteration for submission #${submissionId}, version #${targetVersionId}`);

    const version = await generateIteration(submission, targetVersionId, feedback, pool);

    if (version.image_url && !version.image_url.startsWith('http')) {
      version.file_download_url = `/submissions/${submissionId}/versions/${version.id}/file`;
    }

    console.log(`[Generation] Iteration complete for submission #${submissionId}`);
    res.json({ version });
  } catch (error) {
    try {
      const pool = req.app.get('db');
      await pool.query(
        "UPDATE submissions SET generation_status = 'error', updated_at = NOW() WHERE id = $1",
        [req.params.id]
      );
    } catch (e) { /* ignore */ }
    next(error);
  }
});

// GET /submissions/:id/versions - Get all versions for a submission
router.get('/:id/versions', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const submissionId = req.params.id;

    // Verify submission exists and user has access
    const subResult = await pool.query('SELECT id, user_id FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];
    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }

    const result = await pool.query(
      'SELECT * FROM submission_versions WHERE submission_id = $1 ORDER BY version_number ASC',
      [submissionId]
    );

    // Add file download URLs
    const versions = result.rows.map(v => {
      if (v.image_url && !v.image_url.startsWith('http')) {
        v.file_download_url = `/submissions/${submissionId}/versions/${v.id}/file`;
      }
      return v;
    });

    res.json({ versions });
  } catch (error) { next(error); }
});

// GET /submissions/:id/versions/:versionId/file - Download a generated image
router.get('/:id/versions/:versionId/file', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { id: submissionId, versionId } = req.params;

    console.log(`[Generation] File request: submission=${submissionId}, version=${versionId}`);

    const result = await pool.query(
      'SELECT sv.image_url, s.user_id FROM submission_versions sv JOIN submissions s ON sv.submission_id = s.id WHERE sv.id = $1 AND sv.submission_id = $2',
      [versionId, submissionId]
    );

    if (result.rows.length === 0) {
      console.log(`[Generation] Version not found in DB: submission=${submissionId}, version=${versionId}`);
      return res.status(404).json({ error: 'Version not found' });
    }

    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    const imageUrl = result.rows[0].image_url;
    console.log(`[Generation] File lookup: image_url="${imageUrl}"`);

    const { getFilePath } = require('../services/file-storage');
    const filepath = getFilePath(imageUrl);
    if (!filepath) {
      console.log(`[Generation] File not on disk: "${imageUrl}"`);
      return res.status(410).json({ error: 'Archivo no encontrado en disco. Puede haber sido eliminado por limpieza automatica.' });
    }

    const fs = require('fs');
    const stat = fs.statSync(filepath);
    console.log(`[Generation] Serving file: ${filepath} (${Math.round(stat.size / 1024)}KB)`);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${imageUrl}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error(`[Generation] Stream error: ${err.message}`);
      if (!res.headersSent) res.status(500).json({ error: 'Error reading file' });
    });
  } catch (error) { next(error); }
});

// POST /submissions/:id/submit-final - Client satisfied, submit for admin review
router.post('/:id/submit-final', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const submissionId = req.params.id;

    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];

    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }

    // Mark the latest version as client_satisfied
    await pool.query(
      `UPDATE submission_versions SET client_satisfied = true
       WHERE submission_id = $1 AND version_number = (SELECT MAX(version_number) FROM submission_versions WHERE submission_id = $1)`,
      [submissionId]
    );

    // Update submission to evaluado for admin review
    const result = await pool.query(
      "UPDATE submissions SET estado = 'evaluado', generation_status = 'final', updated_at = NOW() WHERE id = $1 RETURNING *",
      [submissionId]
    );

    console.log(`[Generation] Submission #${submissionId} marked as final, sent for admin review`);
    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

/**
 * Safely parse JSON strings (from JSONB columns that may come as strings)
 */
function safeParseJSON(value, fallback) {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

module.exports = router;
