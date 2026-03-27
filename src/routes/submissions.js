const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { analyzeSubmission } = require('../services/ai-router');
const { dispatchToN8n } = require('../services/webhook');
const { saveFile, getFilePath } = require('../services/file-storage');
const { recordLearning } = require('../services/learning');
const config = require('../config');

const router = express.Router();

// Simple in-memory rate limiter per user
const rateLimitMap = new Map();
function rateLimit(userId, action, maxPerHour = 10) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const hourAgo = now - 3600000;

  if (!rateLimitMap.has(key)) rateLimitMap.set(key, []);
  const timestamps = rateLimitMap.get(key).filter(t => t > hourAgo);
  rateLimitMap.set(key, timestamps);

  if (timestamps.length >= maxPerHour) return false;
  timestamps.push(now);
  return true;
}

// Score threshold: >= 70 goes to admin review, < 70 stays with designer
const ADMIN_REVIEW_THRESHOLD = 70;

function getEstadoByScore(score) {
  return score >= ADMIN_REVIEW_THRESHOLD ? 'evaluado' : 'rechazado_ai';
}

// Multer for file uploads (in-memory, max 50MB for videos)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Try n8n async first, fallback to sync analysis
async function analyzeOrDispatch(submission, pool, imageBase64, imageMimeType) {
  // Prevent duplicate analysis
  const lockCheck = await pool.query(
    "SELECT id FROM submissions WHERE id = $1 AND estado = 'analizando' AND ai_analyzed_at IS NOT NULL",
    [submission.id]
  );
  if (lockCheck.rows.length > 0) {
    console.log(`[Submission] #${submission.id}: Already analyzed, skipping duplicate`);
    const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
    return { async: false, submission: result.rows[0] };
  }

  // Try n8n dispatch (async)
  const dispatched = await dispatchToN8n(submission, pool);
  if (dispatched) {
    // n8n will process and call back — return submission as-is (estado=analizando)
    const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
    return { async: true, submission: result.rows[0] };
  }

  // Fallback: sync analysis (original behavior)
  const analysis = await analyzeSubmission(submission, imageBase64, imageMimeType);
  const finalScore = analysis.score || 50;
  const estado = getEstadoByScore(finalScore);

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
    submission.id, estado
  ]);

  // Record learning from this evaluation
  recordLearning(pool, submission, analysis).catch(() => {});

  const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
  return { async: false, submission: result.rows[0] };
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// GET /submissions/gemini-key - Temporary key for direct upload (videos too large for proxy)
router.get('/gemini-key', authenticate, (req, res) => {
  if (!config.geminiApiKey) return res.status(500).json({ error: 'Gemini not configured' });
  res.json({ key: config.geminiApiKey });
});

// POST /submissions/gemini-upload - Proxy upload to Gemini (key never leaves server)
router.post('/gemini-upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const key = config.geminiApiKey;
    if (!key) return res.status(500).json({ error: 'Gemini not configured' });

    console.log(`[Gemini Proxy] Uploading ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB, ${req.file.mimetype})`);

    // Upload to Gemini
    const uploadRes = await fetch(`${GEMINI_BASE}/upload/v1beta/files?key=${key}`, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(req.file.size),
        'X-Goog-Upload-Header-Content-Type': req.file.mimetype,
        'Content-Type': req.file.mimetype,
      },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error(`[Gemini Proxy] Upload failed: ${err.substring(0, 200)}`);
      return res.status(502).json({ error: 'Error al subir archivo' });
    }

    const uploadData = await uploadRes.json();
    const geminiFile = uploadData.file;
    console.log(`[Gemini Proxy] Uploaded: ${geminiFile.name}, state: ${geminiFile.state}`);

    // Poll until ACTIVE if processing
    if (geminiFile.state === 'PROCESSING') {
      let state = geminiFile.state;
      let attempts = 0;
      while (state === 'PROCESSING' && attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        const pollRes = await fetch(`${GEMINI_BASE}/v1beta/${geminiFile.name}?key=${key}`);
        if (!pollRes.ok) break;
        const pollData = await pollRes.json();
        state = pollData.state;
      }
      if (state !== 'ACTIVE') {
        return res.status(502).json({ error: 'El archivo no se proceso correctamente' });
      }
    }

    // Also save video to disk for admin download/preview
    let savedFilename = null;
    try {
      savedFilename = saveFile(req.file.buffer, req.file.originalname, `gemini_${Date.now()}`);
    } catch (saveErr) {
      console.error('[FileStorage] Failed to save video:', saveErr.message);
    }

    res.json({ uri: geminiFile.uri, name: geminiFile.name, localFile: savedFilename });
  } catch (error) { next(error); }
});

// POST /submissions/upload - Upload file directly for Claude analysis (non-video)
router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!rateLimit(req.user.id, 'upload', 20)) return res.status(429).json({ error: 'Limite alcanzado / Rate limit exceeded. Intenta en 1 hora.' });

    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, descripcion, objetivo, gemini_file_uri, lang } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || 'imagen';

    // Insert submission
    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, descripcion, gemini_file_uri, objetivo, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', descripcion, gemini_file_uri || null, objetivo || null]);

    // Attach objetivo for AI context
    result.rows[0].objetivo = objetivo;

    const submission = result.rows[0];

    // Convert uploaded file to base64 for Claude + save to disk for download
    let imageBase64 = null;
    let imageMimeType = null;
    console.log(`[Submission] req.file exists: ${!!req.file}, req.files: ${!!req.files}, content-type: ${req.headers['content-type']}`);
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      imageMimeType = req.file.mimetype;
      console.log(`[Submission] #${submission.id}: File received (${Math.round(req.file.size / 1024)}KB, ${imageMimeType}, base64 length: ${imageBase64.length})`);

      // Save file to disk for later download/preview
      try {
        const savedFilename = saveFile(req.file.buffer, req.file.originalname, submission.id);
        await pool.query('UPDATE submissions SET archivo_nombre = $1, archivo_size = $2, archivo_url = $3 WHERE id = $4', [
          req.file.originalname, req.file.size, savedFilename, submission.id
        ]);
        submission.archivo_nombre = req.file.originalname;
        submission.archivo_url = savedFilename;
      } catch (saveErr) {
        console.error(`[FileStorage] Failed to save file for #${submission.id}:`, saveErr.message);
      }
    } else {
      console.log(`[Submission] #${submission.id}: NO FILE RECEIVED - multer did not process any file`);
    }

    console.log(`[Submission] Created #${submission.id}: ${titulo} (${finalTipo}), hasFile: ${!!imageBase64}, objetivo: ${objetivo || 'none'}`);

    submission._dbPool = pool;

    try {
      const result2 = await analyzeOrDispatch(submission, pool, imageBase64, imageMimeType);
      res.json({ submission: result2.submission, async: result2.async });
    } catch (aiErr) {
      console.error('AI analysis error:', aiErr.message);
      await pool.query("UPDATE submissions SET estado = 'error' WHERE id = $1", [submission.id]);
      res.status(500).json({ error: 'Error en el analisis de IA. Intenta de nuevo.' });
    }

  } catch (error) { next(error); }
});

// POST /submissions - Submit creative (JSON, for videos with Gemini URI)
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!rateLimit(req.user.id, 'upload', 20)) return res.status(429).json({ error: 'Limite alcanzado / Rate limit exceeded. Intenta en 1 hora.' });

    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email, objetivo, localFile, lang } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || 'video';

    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email, objetivo, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', formato, descripcion, archivo_url, gemini_file_uri, contenido_email, objetivo || null]);

    const submission = result.rows[0];
    submission.objetivo = objetivo;
    submission.lang = lang || 'es';
    submission._dbPool = pool;

    // If video was saved to disk during gemini-upload, link it to this submission
    if (localFile) {
      await pool.query('UPDATE submissions SET archivo_url = $1, archivo_nombre = $2 WHERE id = $3',
        [localFile, localFile, submission.id]);
      submission.archivo_url = localFile;
      submission.archivo_nombre = localFile;
    }

    console.log(`[Submission] Created #${submission.id}: ${titulo} (${finalTipo}), objetivo: ${objetivo || 'none'}, Gemini URI: ${gemini_file_uri || 'none'}, localFile: ${localFile || 'none'}`);

    try {
      const result2 = await analyzeOrDispatch(submission, pool, null, null);
      res.json({ submission: result2.submission, async: result2.async });
    } catch (aiErr) {
      console.error('AI analysis error:', aiErr.message);
      await pool.query("UPDATE submissions SET estado = 'error' WHERE id = $1", [submission.id]);
      res.status(500).json({ error: 'Error en el analisis de IA. Intenta de nuevo.' });
    }

  } catch (error) { next(error); }
});

// POST /submissions/email
router.post('/email', authenticate, async (req, res, next) => {
  try {
    if (!rateLimit(req.user.id, 'upload', 20)) return res.status(429).json({ error: 'Limite alcanzado / Rate limit exceeded. Intenta en 1 hora.' });

    const pool = req.app.get('db');
    const { titulo, negocio, contenido_email, descripcion, objetivo, lang, tipo: emailTipo, whatsapp_template_type } = req.body;

    if (!titulo || !negocio || !contenido_email) {
      return res.status(400).json({ error: 'Titulo, negocio and contenido_email are required' });
    }

    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, descripcion, contenido_email, objetivo, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, emailTipo || 'email', negocio, descripcion, contenido_email, objetivo || null]);

    const submission = result.rows[0];
    submission.objetivo = objetivo;
    submission.lang = lang || 'es';
    submission._dbPool = pool;
    console.log(`[Submission] Created email #${submission.id}: ${titulo}, objetivo: ${objetivo || 'none'}`);

    const result2 = await analyzeOrDispatch(submission, pool, null, null);
    res.json({ submission: result2.submission, async: result2.async });

  } catch (error) { next(error); }
});

// GET /submissions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { tipo, negocio, estado, include_archived } = req.query;
    let query = 'SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id WHERE 1=1';
    const params = [];
    if (include_archived !== 'true') { query += ` AND (s.archived IS NULL OR s.archived = false)`; }
    if (req.user.role === 'creative') { params.push(req.user.id); query += ` AND s.user_id = $${params.length}`; }
    if (tipo) { params.push(tipo); query += ` AND s.tipo = $${params.length}`; }
    if (negocio) { params.push(negocio); query += ` AND s.negocio = $${params.length}`; }
    if (estado) { params.push(estado); query += ` AND s.estado = $${params.length}`; }
    query += ' ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ submissions: result.rows });
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
    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }
    const sub = result.rows[0];
    // Add download URL if file exists on disk
    if (sub.archivo_url && !sub.archivo_url.startsWith('http')) {
      sub.file_download_url = `/submissions/${sub.id}/file`;
    }
    res.json({ submission: sub });
  } catch (error) { next(error); }
});

// GET /submissions/:id/file - Download/stream the uploaded file (authenticated)
router.get('/:id/file', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query('SELECT archivo_url, archivo_nombre, tipo, user_id FROM submissions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }

    const sub = result.rows[0];
    if (!sub.archivo_url) return res.status(404).json({ error: 'No file associated' });

    // archivo_url stores the local filename on disk
    const filepath = getFilePath(sub.archivo_url);
    if (!filepath) return res.status(410).json({ error: 'Archivo expirado (se eliminan despues de 3 dias). Pide al creativo que lo suba de nuevo.' });

    // Set proper content-type based on extension
    const ext = (sub.archivo_nombre || sub.archivo_url).split('.').pop().toLowerCase();
    const mimeTypes = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      pdf: 'application/pdf'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // For download parameter, force download instead of inline
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${sub.archivo_nombre || sub.archivo_url}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${sub.archivo_nombre || sub.archivo_url}"`);
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    // Stream the file (low memory usage)
    const stream = require('fs').createReadStream(filepath);
    stream.pipe(res);
    stream.on('error', () => res.status(500).json({ error: 'Error reading file' }));
  } catch (error) { next(error); }
});

// POST /submissions/:id/archive
router.post('/:id/archive', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const check = await pool.query('SELECT user_id FROM submissions WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }
    const result = await pool.query(
      'UPDATE submissions SET archived = true, archived_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

// POST /submissions/:id/unarchive
router.post('/:id/unarchive', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const check = await pool.query('SELECT user_id FROM submissions WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado / Access denied' });
    }
    const result = await pool.query(
      'UPDATE submissions SET archived = false, archived_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

// POST /submissions/:id/resubmit - Upload new version and re-evaluate
router.post('/:id/resubmit', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!rateLimit(req.user.id, 'resubmit', 10)) return res.status(429).json({ error: 'Limite de resubmits alcanzado. Intenta en 1 hora.' });

    const pool = req.app.get('db');
    const submissionId = req.params.id;

    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const submission = subResult.rows[0];

    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No access' });
    }
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    // Save old analysis as version (preserve history)
    const versionResult = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM submission_versions WHERE submission_id = $1',
      [submissionId]
    );
    const nextVersion = versionResult.rows[0].max_version + 1;

    // If first resubmit, save original as version 1
    if (nextVersion === 1) {
      await pool.query(`
        INSERT INTO submission_versions (submission_id, version_number, tipo, image_url, ai_score, created_at)
        VALUES ($1, 1, 'original', $2, $3, $4)
      `, [submissionId, submission.archivo_url, submission.ai_score, submission.created_at]);
    }

    // Save new file
    const savedFilename = saveFile(req.file.buffer, req.file.originalname, submissionId);

    // Save new version record
    const newVersionNum = nextVersion + 1;
    await pool.query(`
      INSERT INTO submission_versions (submission_id, version_number, tipo, image_url)
      VALUES ($1, $2, 'resubmit', $3)
    `, [submissionId, newVersionNum, savedFilename]);

    // Update submission: new file, reset AI analysis, re-analyze
    await pool.query(`
      UPDATE submissions SET
        archivo_url = $1, archivo_nombre = $2, archivo_size = $3,
        estado = 'analizando', current_version = $4,
        ai_score = NULL, ai_resumen = NULL, ai_veredicto = NULL,
        ai_fortalezas = '[]', ai_problemas = '[]', ai_recomendaciones = '[]',
        updated_at = NOW()
      WHERE id = $5
    `, [savedFilename, req.file.originalname, req.file.size, newVersionNum, submissionId]);

    // Re-analyze
    const updatedSub = await pool.query('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    const sub = updatedSub.rows[0];
    sub.objetivo = submission.objetivo || req.body.objetivo;
    sub._dbPool = pool;

    const imageBase64 = req.file.buffer.toString('base64');
    const imageMimeType = req.file.mimetype;

    console.log(`[Resubmit] #${submissionId}: version ${newVersionNum}, re-analyzing...`);

    try {
      const result2 = await analyzeOrDispatch(sub, pool, imageBase64, imageMimeType);
      // Update version with new score
      const finalSub = result2.submission;
      if (finalSub.ai_score) {
        await pool.query(
          'UPDATE submission_versions SET ai_score = $1 WHERE submission_id = $2 AND version_number = $3',
          [finalSub.ai_score, submissionId, newVersionNum]
        );
      }
      res.json({ submission: finalSub, version: newVersionNum });
    } catch (aiErr) {
      console.error(`[Resubmit] AI error:`, aiErr.message);
      await pool.query("UPDATE submissions SET estado = 'error', updated_at = NOW() WHERE id = $1", [submissionId]);
      res.status(500).json({ error: 'Error en re-analisis: ' + aiErr.message });
    }
  } catch (error) { next(error); }
});

// POST /submissions/:id/share - Generate a temporary public share token
router.post('/:id/share', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const crypto = require('crypto');
    const submissionId = req.params.id;

    // Verify ownership or admin
    const subResult = await pool.query('SELECT user_id FROM submissions WHERE id = $1', [submissionId]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && subResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No access' });
    }

    // Generate token (valid for 7 days)
    const shareToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE submissions SET share_token = $1, share_expires = $2 WHERE id = $3',
      [shareToken, expiresAt, submissionId]
    );

    res.json({
      shareUrl: `/shared/${submissionId}/${shareToken}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) { next(error); }
});

// GET /submissions/:id/shared/:token - Public view (no auth needed)
router.get('/:id/shared/:token', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { id, token } = req.params;

    const result = await pool.query(
      `SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.share_token = $2 AND s.share_expires > NOW()`,
      [id, token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link expirado o invalido' });
    }

    // Return submission without sensitive fields
    const sub = result.rows[0];
    delete sub.share_token;
    delete sub.share_expires;
    delete sub.user_id;

    res.json({ submission: sub });
  } catch (error) { next(error); }
});

module.exports = router;
