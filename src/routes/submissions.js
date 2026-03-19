const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { analyzeSubmission } = require('../services/ai-router');
const { getApiKey } = require('../services/gemini');

const router = express.Router();

// Multer for file uploads (in-memory, max 20MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /submissions/gemini-key - Frontend gets key to upload directly to Gemini
router.get('/gemini-key', authenticate, (req, res) => {
  res.json({ key: getApiKey() });
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

    // Convert uploaded file to base64 for Claude
    let imageBase64 = null;
    let imageMimeType = null;
    console.log(`[Submission] req.file exists: ${!!req.file}, req.files: ${!!req.files}, content-type: ${req.headers['content-type']}`);
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      imageMimeType = req.file.mimetype;
      console.log(`[Submission] #${submission.id}: File received (${Math.round(req.file.size / 1024)}KB, ${imageMimeType}, base64 length: ${imageBase64.length})`);
    } else {
      console.log(`[Submission] #${submission.id}: NO FILE RECEIVED - multer did not process any file`);
    }

    console.log(`[Submission] Created #${submission.id}: ${titulo} (${finalTipo}), hasFile: ${!!imageBase64}, objetivo: ${objetivo || 'none'}`);

    // Attach db pool for knowledge base queries
    submission._dbPool = pool;

    // Analyze with AI
    try {
      const analysis = await analyzeSubmission(submission, imageBase64, imageMimeType);

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
      const analysis = await analyzeSubmission(submission, null, null);

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

// POST /submissions/email
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
    const analysis = await analyzeSubmission(submission, null, null);

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
    res.json({ submission: result.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
