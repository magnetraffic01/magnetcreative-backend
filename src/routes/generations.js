const express = require('express');
const { authenticate } = require('../middleware/auth');
const { generateImprovedImage, generateIteration } = require('../services/image-generator');

const router = express.Router();

// POST /submissions/:id/generate - Trigger GPT-4o generation from AI recommendations
router.post('/:id/generate', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const submissionId = req.params.id;

    // Get submission with AI analysis
    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const submission = subResult.rows[0];

    // Verify ownership or admin
    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta submission' });
    }

    // Check that AI analysis exists
    if (!submission.ai_score) {
      return res.status(400).json({ error: 'Esta submission aun no ha sido analizada por la IA' });
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
      return res.status(403).json({ error: 'No tienes acceso a esta submission' });
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
      return res.status(403).json({ error: 'No tienes acceso a esta submission' });
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

    const result = await pool.query(
      'SELECT sv.image_url, s.user_id FROM submission_versions sv JOIN submissions s ON sv.submission_id = s.id WHERE sv.id = $1 AND sv.submission_id = $2',
      [versionId, submissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    const { getFilePath } = require('../services/file-storage');
    const filepath = getFilePath(result.rows[0].image_url);
    if (!filepath) {
      return res.status(410).json({ error: 'Archivo expirado' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${result.rows[0].image_url}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const fs = require('fs');
    const stream = fs.createReadStream(filepath);
    stream.pipe(res);
    stream.on('error', () => res.status(500).json({ error: 'Error reading file' }));
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
      return res.status(403).json({ error: 'No tienes acceso a esta submission' });
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
