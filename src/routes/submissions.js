const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { analyzeSubmission } = require('../services/ai-router');
const { dispatchToN8n } = require('../services/webhook');
const { saveFile, getFilePath } = require('../services/file-storage');
const config = require('../config');

const router = express.Router();

// Score threshold: >= 70 goes to admin review, < 70 stays with designer
const ADMIN_REVIEW_THRESHOLD = 70;

function getEstadoByScore(score) {
  return score >= ADMIN_REVIEW_THRESHOLD ? 'evaluado' : 'rechazado_ai';
}

// Multer for file uploads (in-memory, max 50MB for videos)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Try n8n async first, fallback to sync analysis
async function analyzeOrDispatch(submission, pool, imageBase64, imageMimeType) {
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

  const result = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
  return { async: false, submission: result.rows[0] };
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

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

// GET /submissions/gemini-key - Legacy fallback (deprecated, use gemini-upload proxy)
router.get('/gemini-key', authenticate, (req, res) => {
  res.json({ key: config.geminiApiKey });
});

// POST /submissions/upload - Upload file directly for Claude analysis (non-video)
router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, descripcion, objetivo, gemini_file_uri } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || 'imagen';

    // Insert submission
    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, descripcion, gemini_file_uri, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', descripcion, gemini_file_uri || null]);

    // Attach objetivo for AI context (not stored in DB column yet but passed to AI)
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
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email, objetivo } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || 'video';

    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, formato, descripcion, archivo_url, gemini_file_uri, contenido_email, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', formato, descripcion, archivo_url, gemini_file_uri, contenido_email]);

    const submission = result.rows[0];
    submission.objetivo = objetivo;
    submission._dbPool = pool;
    console.log(`[Submission] Created #${submission.id}: ${titulo} (${finalTipo}), objetivo: ${objetivo || 'none'}, Gemini URI: ${gemini_file_uri || 'none'}`);

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
    const pool = req.app.get('db');
    const { titulo, negocio, contenido_email, descripcion, objetivo } = req.body;

    if (!titulo || !negocio || !contenido_email) {
      return res.status(400).json({ error: 'Titulo, negocio and contenido_email are required' });
    }

    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, descripcion, contenido_email, estado)
      VALUES ($1, $2, 'email', $3, $4, $5, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, negocio, descripcion, contenido_email]);

    const submission = result.rows[0];
    submission.objetivo = objetivo;
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
    const { tipo, negocio, estado } = req.query;
    let query = 'SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id WHERE 1=1';
    const params = [];
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
    const result = await pool.query('SELECT archivo_url, archivo_nombre, tipo FROM submissions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

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

module.exports = router;
