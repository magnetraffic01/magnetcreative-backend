const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const app = express();

// CORS
app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:5173', /\.lovable\.app$/],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Database - strip sslmode from URL and disable SSL
const dbUrl = (config.databaseUrl || '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});
app.set('db', pool);

// ActuarialAds Database (for creative_vault sync)
if (config.actuarialDbUrl) {
  const actuarialUrl = config.actuarialDbUrl.replace(/[?&]sslmode=[^&]*/g, '');
  const actuarialPool = new Pool({
    connectionString: actuarialUrl,
    ssl: false
  });
  app.set('actuarialDb', actuarialPool);
  console.log('ActuarialAds DB connected');
}

// Init database
async function initDB() {
  try {
    const check = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'submissions')`);
    if (!check.rows[0].exists) {
      console.log('Initializing database...');
      const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
      await pool.query(schema);
      console.log('Database initialized!');
    }
    // Run migrations
    await runMigrations();
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

async function runMigrations() {
  try {
    // Migration 001: negocios + knowledge_base
    const hasNegocios = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'negocios')`);
    if (!hasNegocios.rows[0].exists) {
      console.log('Running migration 001: negocios + knowledge_base...');
      const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrate-001-negocios-kb.sql'), 'utf8');
      await pool.query(migration);
      console.log('Migration 001 complete!');
    }
    // Ensure knowledge_base table exists even if negocios column was already there
    const hasKB = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_base')`);
    if (!hasKB.rows[0].exists) {
      console.log('Creating knowledge_base table...');
      const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrate-001-negocios-kb.sql'), 'utf8');
      await pool.query(migration);
      console.log('knowledge_base table created!');
    }
    // Migration 002: chat_messages
    const hasChat = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_messages')`);
    if (!hasChat.rows[0].exists) {
      console.log('Running migration 002: chat_messages...');
      const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrate-002-chat.sql'), 'utf8');
      await pool.query(migration);
      console.log('Migration 002 complete!');
    }
    // Migration 003: KB categoria + documento
    const hasCategoria = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'knowledge_base' AND column_name = 'categoria')`);
    if (!hasCategoria.rows[0].exists) {
      console.log('Running migration 003: KB categoria + documento...');
      const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrate-003-kb-categoria.sql'), 'utf8');
      await pool.query(migration);
      console.log('Migration 003 complete!');
    }
    // Migration 004: Add rechazado_ai to estado check constraint
    try {
      await pool.query(`
        ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_estado_check;
        ALTER TABLE submissions ADD CONSTRAINT submissions_estado_check
          CHECK (estado IN ('analizando', 'evaluado', 'aprobado', 'cambios', 'rechazado', 'rechazado_ai', 'error'));
      `);
    } catch (e) { /* constraint may already be correct */ }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/submissions', require('./routes/submissions'));
app.use('/submissions', require('./routes/chat'));
app.use('/admin', require('./routes/admin'));
app.use('/knowledge-base', require('./routes/knowledge-base'));
app.use('/feed', require('./routes/feed'));

// Health check with DB verification
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', app: 'MagnetCreative', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', app: 'MagnetCreative', db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// Global error handler — hide internal details from client
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

// Validate critical config before starting
if (!config.jwtSecret || config.jwtSecret === 'cambiar-en-produccion') {
  console.error('[FATAL] JWT_SECRET is not set or is using default value. Set a secure JWT_SECRET.');
  process.exit(1);
}

// Start
initDB().then(() => {
  app.listen(config.port, () => {
    console.log(`MagnetCreative running on port ${config.port}`);
    console.log(`[Config] Claude key: ${config.claudeApiKey ? config.claudeApiKey.substring(0, 15) + '...' + config.claudeApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] OpenAI key: ${config.openaiApiKey ? config.openaiApiKey.substring(0, 15) + '...' + config.openaiApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] Gemini key: ${config.geminiApiKey ? config.geminiApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  });
});
