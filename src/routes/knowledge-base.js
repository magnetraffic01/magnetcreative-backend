const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

// POST /knowledge-base - Create KB entry
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido } = req.body;

    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Titulo y contenido son requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO knowledge_base (titulo, tipo, negocio, contenido, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [titulo, tipo || 'rules', negocio || null, contenido, req.user.id]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) { next(error); }
});

// PUT /knowledge-base/:id - Update KB entry
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { titulo, tipo, negocio, contenido } = req.body;

    const result = await pool.query(
      `UPDATE knowledge_base SET
        titulo = COALESCE($1, titulo),
        tipo = COALESCE($2, tipo),
        negocio = $3,
        contenido = COALESCE($4, contenido),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [titulo, tipo, negocio || null, contenido, req.params.id]
    );

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
