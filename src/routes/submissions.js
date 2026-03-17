const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { uploadToGemini, analyzeContent } = require('../services/gemini');

const router = express.Router();

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// MIME type mapping
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  return map[ext] || 'application/octet-stream';
}

// Content type from MIME
function getContentType(mimeType) {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'imagen';
  if (mimeType === 'application/pdf') return 'presentacion';
  return 'plantilla';
}

// POST /submissions - Upload and analyze
router.post('/', authenticate, upload.single('archivo'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, plataforma, formato, descripcion, contenido_email } = req.body;

    if (!titulo || !negocio) {
      return res.status(400).json({ error: 'Titulo and negocio are required' });
    }

    const finalTipo = tipo || (req.file ? getContentType(getMimeType(req.file.originalname)) : 'email');

    // Insert submission
    const result = await pool.query(`
      INSERT INTO submissions (user_id, titulo, tipo, negocio, plataforma, formato, descripcion, contenido_email, archivo_nombre, archivo_size, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'analizando')
      RETURNING *
    `, [req.user.id, titulo, finalTipo, negocio, plataforma || 'facebook', formato, descripcion, contenido_email, req.file?.originalname, req.file?.size]);

    const submission = result.rows[0];

    // Upload to Gemini if file exists
    let geminiFileUri = null;
    if (req.file) {
      console.log(`[Upload] File received: ${req.file.originalname}, path: ${req.file.path}, size: ${req.file.size}`);
      const mimeType = getMimeType(req.file.originalname);
      const geminiFile = await uploadToGemini(req.file.path, mimeType);
      geminiFileUri = geminiFile.uri;
      await pool.query('UPDATE submissions SET gemini_file_uri = $1 WHERE id = $2', [geminiFileUri, submission.id]);
      submission.gemini_file_uri = geminiFileUri;
      console.log(`[Upload] Gemini URI: ${geminiFileUri}`);
    }

    // Analyze with AI
    try {
      const analysis = await analyzeContent(submission, req.file?.path);

      await pool.query(`
        UPDATE submissions SET
          estado = 'evaluado',
          ai_score = $1,
          ai_resumen = $2,
          ai_veredicto = $3,
          ai_hook_presente = $4,
          ai_hook_descripcion = $5,
          ai_cta_presente = $6,
          ai_cta_descripcion = $7,
          ai_fortalezas = $8,
          ai_problemas = $9,
          ai_recomendaciones = $10,
          ai_uso_recomendado = $11,
          ai_analyzed_at = NOW(),
          updated_at = NOW()
        WHERE id = $12
      `, [
        analysis.score || 50,
        analysis.resumen || 'Sin resumen',
        analysis.veredicto || 'cambios',
        analysis.hook_presente ?? analysis.hook_primeros_3s ?? null,
        analysis.hook_descripcion || null,
        analysis.cta_presente ?? null,
        analysis.cta_descripcion || null,
        JSON.stringify(analysis.fortalezas || []),
        JSON.stringify(analysis.problemas || []),
        JSON.stringify(analysis.recomendaciones || []),
        analysis.uso_recomendado || null,
        submission.id
      ]);

      // Clean up local file
      if (req.file) fs.unlink(req.file.path, () => {});

      const updated = await pool.query('SELECT * FROM submissions WHERE id = $1', [submission.id]);
      res.json({ submission: updated.rows[0] });

    } catch (aiErr) {
      console.error('AI analysis error:', aiErr.message);
      await pool.query('UPDATE submissions SET estado = $1 WHERE id = $2', ['error', submission.id]);
      if (req.file) fs.unlink(req.file.path, () => {});
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

    const analysis = await analyzeContent(submission, null);

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

// GET /submissions - List submissions
router.get('/', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { tipo, negocio, estado } = req.query;

    let query = 'SELECT s.*, u.name as submitted_by FROM submissions s JOIN users u ON s.user_id = u.id WHERE 1=1';
    const params = [];

    // Creative users only see their own
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

// GET /submissions/stats/dashboard
router.get('/stats/dashboard', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'evaluado') as pendientes_revision,
        COUNT(*) FILTER (WHERE estado = 'aprobado') as aprobados,
        COUNT(*) FILTER (WHERE estado = 'rechazado') as rechazados,
        COUNT(*) FILTER (WHERE estado = 'cambios') as con_cambios,
        ROUND(AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL)) as score_promedio,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as esta_semana
      FROM submissions
    `);
    res.json({ stats: stats.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;
