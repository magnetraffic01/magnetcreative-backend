const express = require('express');
const { authenticate } = require('../middleware/auth');
const { buildChatSystemPrompt, chatWithAI } = require('../services/chat');

const router = express.Router();

// POST /submissions/:id/chat - Send message and get AI response
router.post('/:id/chat', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    // Get submission (verify ownership or admin)
    const subResult = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.id]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

    const submission = subResult.rows[0];
    if (req.user.role !== 'admin' && submission.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!submission.ai_score) {
      return res.status(400).json({ error: 'El creativo aun no ha sido analizado' });
    }

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (submission_id, user_id, role, content) VALUES ($1, $2, $3, $4)',
      [submission.id, req.user.id, 'user', message.trim()]
    );

    // Get chat history (limit to last 20 messages to control token cost)
    const historyResult = await pool.query(
      'SELECT role, content FROM chat_messages WHERE submission_id = $1 ORDER BY created_at ASC LIMIT 20',
      [submission.id]
    );

    // Build context and call AI
    const systemPrompt = buildChatSystemPrompt(submission);
    console.log(`[Chat] Submission #${submission.id}: user="${message.trim().substring(0, 50)}..." (${historyResult.rows.length} msgs)`);
    const aiResponse = await chatWithAI(systemPrompt, historyResult.rows);

    // Save AI response
    await pool.query(
      'INSERT INTO chat_messages (submission_id, user_id, role, content) VALUES ($1, $2, $3, $4)',
      [submission.id, req.user.id, 'assistant', aiResponse]
    );

    res.json({ response: aiResponse });
  } catch (error) { next(error); }
});

// GET /submissions/:id/chat - Get chat history
router.get('/:id/chat', authenticate, async (req, res, next) => {
  try {
    const pool = req.app.get('db');

    const subResult = await pool.query('SELECT user_id FROM submissions WHERE id = $1', [req.params.id]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    if (req.user.role !== 'admin' && subResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result = await pool.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE submission_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ messages: result.rows });
  } catch (error) { next(error); }
});

module.exports = router;
