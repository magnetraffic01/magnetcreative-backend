const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateVideo, getVideoStatus, listAvatars } = require('../services/heygen');

const router = express.Router();

// GET /heygen/avatars - List available avatars
router.get('/avatars', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const avatars = await listAvatars();
    res.json({ avatars });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /heygen/generate - Generate video from script
router.post('/generate', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { script, avatar_id, voice_id, title, submission_id } = req.body;
    if (!script) return res.status(400).json({ error: 'Script is required' });

    const result = await generateVideo({ script, avatar_id, voice_id, title });

    // If linked to a submission, save reference
    if (submission_id) {
      const pool = req.app.get('db');
      try {
        await pool.query(
          `INSERT INTO submission_versions (submission_id, version_number, tipo, generation_prompt, generation_model)
           VALUES ($1, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM submission_versions WHERE submission_id = $1), 'generated', $2, 'heygen')`,
          [submission_id, `heygen:${result.video_id}`]
        );
      } catch (e) { console.error('[HeyGen] Failed to save version:', e.message); }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /heygen/status/:videoId - Check video status
router.get('/status/:videoId', authenticate, async (req, res, next) => {
  try {
    const status = await getVideoStatus(req.params.videoId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
