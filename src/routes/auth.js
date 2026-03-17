const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    delete user.password_hash;
    res.json({ user, token });
  } catch (error) { next(error); }
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /auth/create-user (admin only - Amed creates team members)
router.post('/create-user', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { email, password, name, role, negocio } = req.body;

    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, role, negocio) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, negocio',
      [email, hash, name, role || 'creative', negocio || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

// GET /auth/users (admin only)
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const result = await pool.query('SELECT id, email, name, role, negocio, created_at, last_login_at FROM users ORDER BY created_at');
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});

// POST /auth/setup-admin (first time setup)
router.post('/setup-admin', async (req, res, next) => {
  try {
    const pool = req.app.get('db');
    const { password } = req.body;

    if (!password) return res.status(400).json({ error: 'Password required' });

    const admin = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@magnetraffic.com']);
    if (admin.rows.length === 0) return res.status(404).json({ error: 'Admin user not found' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@magnetraffic.com']);

    const token = jwt.sign({ userId: admin.rows[0].id }, config.jwtSecret, { expiresIn: '30d' });
    res.json({ message: 'Admin password set', token });
  } catch (error) { next(error); }
});

module.exports = router;
