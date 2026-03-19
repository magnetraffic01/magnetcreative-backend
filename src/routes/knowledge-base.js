const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Extract text from uploaded document
async function extractText(file) {
  const mime = file.mimetype;
  if (mime === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown') {
    return file.buffer.toString('utf8');
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword') {
    // For DOCX, extract raw text (basic approach - strips XML tags)
    const raw = file.buffer.toString('utf8');
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return file.buffer.toString('utf8');
}

// GET /knowledge-base - List all KB entries
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(
      'SELECT * FROM knowledge_base ORDER BY updated_at DESC'
    );
    res.json({ items: result.rows });
  } catch (error) { next(error); }
});

// POST /knowledge-base - Create KB entry (JSON or multipart with document)
router.post('/', authenticate, requireAdmin, upload.single('documento'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido, categoria } = req.body;

    if (!titulo) {
      return res.status(400).json({ error: 'Titulo es requerido' });
    }

    // If document uploaded, extract text
    let finalContenido = contenido || '';
    let documentoNombre = null;
    if (req.file) {
      try {
        const extractedText = await extractText(req.file);
        documentoNombre = req.file.originalname;
        finalContenido = finalContenido
          ? `${finalContenido}\n\n--- Contenido del documento: ${documentoNombre} ---\n${extractedText}`
          : extractedText;
        console.log(`[KB] Extracted ${extractedText.length} chars from ${documentoNombre}`);
      } catch (extErr) {
        console.error(`[KB] Error extracting text: ${extErr.message}`);
        return res.status(400).json({ error: 'No se pudo leer el documento. Formatos soportados: PDF, TXT, DOCX' });
      }
    }

    if (!finalContenido.trim()) {
      return res.status(400).json({ error: 'Contenido o documento es requerido' });
    }

    const result = await pool.query(
      `INSERT INTO knowledge_base (titulo, tipo, negocio, contenido, categoria, documento_nombre, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [titulo, tipo || 'rules', negocio || null, finalContenido, categoria || 'general', documentoNombre, req.user.id]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

// PUT /knowledge-base/:id - Update KB entry
router.put('/:id', authenticate, requireAdmin, upload.single('documento'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido, categoria } = req.body;

    let finalContenido = contenido;
    let documentoNombre = null;

    if (req.file) {
      try {
        const extractedText = await extractText(req.file);
        documentoNombre = req.file.originalname;
        finalContenido = finalContenido
          ? `${finalContenido}\n\n--- Contenido del documento: ${documentoNombre} ---\n${extractedText}`
          : extractedText;
      } catch (extErr) {
        return res.status(400).json({ error: 'No se pudo leer el documento' });
      }
    }

    let query, params;
    if (documentoNombre) {
      query = `UPDATE knowledge_base SET
        titulo = COALESCE($1, titulo), tipo = COALESCE($2, tipo), negocio = $3,
        contenido = COALESCE($4, contenido), categoria = COALESCE($5, categoria),
        documento_nombre = $6, updated_at = NOW()
        WHERE id = $7 RETURNING *`;
      params = [titulo, tipo, negocio || null, finalContenido, categoria, documentoNombre, req.params.id];
    } else {
      query = `UPDATE knowledge_base SET
        titulo = COALESCE($1, titulo), tipo = COALESCE($2, tipo), negocio = $3,
        contenido = COALESCE($4, contenido), categoria = COALESCE($5, categoria),
        updated_at = NOW()
        WHERE id = $6 RETURNING *`;
      params = [titulo, tipo, negocio || null, finalContenido, categoria, req.params.id];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

// DELETE /knowledge-base/:id - Delete KB entry
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query(
      'DELETE FROM knowledge_base WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

module.exports = router;
