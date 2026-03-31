const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { embedKBEntry, reembedAll } = require('../services/embedding');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Clean text for PostgreSQL (remove null bytes and non-printable chars)
function cleanText(text) {
  return text.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
}

// Extract text from uploaded document
async function extractText(file) {
  const mime = file.mimetype;
  let text = '';
  if (mime === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    text = data.text;
  } else if (mime === 'text/plain' || mime === 'text/csv' || mime === 'text/markdown') {
    text = file.buffer.toString('utf8');
  } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword') {
    const raw = file.buffer.toString('utf8');
    text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    text = file.buffer.toString('utf8');
  }
  return cleanText(text);
}

// GET /knowledge-base - List KB entries (filtered by role/tenant)
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    let result;
    if (req.user.role === 'super_admin') {
      // super_admin sees everything
      result = await pool.query('SELECT * FROM knowledge_base ORDER BY updated_at DESC');
    } else {
      // tenant_admin/admin sees universal (read-only) + their own tenant entries
      result = await pool.query(
        'SELECT * FROM knowledge_base WHERE tenant_id IS NULL OR tenant_id = $1 ORDER BY updated_at DESC',
        [req.user.tenant_id]
      );
    }
    const items = result.rows.map(row => ({
      ...row,
      is_universal: !row.tenant_id
    }));
    res.json({ items });
  } catch (error) { next(error); }
});

// POST /knowledge-base - Create KB entry (JSON or multipart with document)
router.post('/', authenticate, requireAdmin, upload.single('documento'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido, categoria } = req.body;
    let { tenant_id } = req.body;

    if (!titulo) {
      return res.status(400).json({ error: 'Titulo es requerido' });
    }

    // Access control: determine tenant_id for the new entry
    if (req.user.role === 'super_admin') {
      // super_admin can create universal (tenant_id=null) or for any tenant
      tenant_id = tenant_id ? parseInt(tenant_id) : null;
    } else {
      // tenant_admin always creates with their own tenant_id (cannot create universal)
      tenant_id = req.user.tenant_id;
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
      `INSERT INTO knowledge_base (titulo, tipo, negocio, contenido, categoria, documento_nombre, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [titulo, tipo || 'rules', negocio || null, finalContenido, categoria || 'general', documentoNombre, req.user.id, tenant_id]
    );

    const item = { ...result.rows[0], is_universal: !result.rows[0].tenant_id };

    // Generate embeddings async (don't block response)
    embedKBEntry(pool, result.rows[0]).catch(err =>
      console.error(`[KB] Embedding failed for entry ${result.rows[0].id}: ${err.message}`)
    );

    res.status(201).json({ item });
  } catch (error) { next(error); }
});

// PUT /knowledge-base/:id - Update KB entry
router.put('/:id', authenticate, requireAdmin, upload.single('documento'), async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido, categoria } = req.body;

    // Access control: check ownership
    if (req.user.role !== 'super_admin') {
      const check = await pool.query('SELECT tenant_id FROM knowledge_base WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
      const entry = check.rows[0];
      // tenant_admin cannot edit universal entries or other tenants' entries
      if (!entry.tenant_id || entry.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ error: 'No tienes permiso para editar esta entrada' });
      }
    }

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
    const item = { ...result.rows[0], is_universal: !result.rows[0].tenant_id };

    // Re-generate embeddings async
    embedKBEntry(pool, result.rows[0]).catch(err =>
      console.error(`[KB] Embedding update failed for entry ${result.rows[0].id}: ${err.message}`)
    );

    res.json({ item });
  } catch (error) { next(error); }
});

// DELETE /knowledge-base/:id - Delete KB entry
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');

    // Access control: check ownership
    if (req.user.role !== 'super_admin') {
      const check = await pool.query('SELECT tenant_id FROM knowledge_base WHERE id = $1', [req.params.id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
      const entry = check.rows[0];
      // tenant_admin cannot delete universal entries or other tenants' entries
      if (!entry.tenant_id || entry.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar esta entrada' });
      }
    }

    const result = await pool.query(
      'DELETE FROM knowledge_base WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

// POST /knowledge-base/reembed - Re-embed all KB entries (super_admin only)
router.post('/reembed', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super_admin puede ejecutar re-embed' });
    }
    const pool = req.app.get('db');

    // Run in background
    reembedAll(pool).catch(err =>
      console.error(`[KB] Re-embed failed: ${err.message}`)
    );

    res.json({ success: true, message: 'Re-embedding iniciado en background. Revisa los logs.' });
  } catch (error) { next(error); }
});

module.exports = router;
