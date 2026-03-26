const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const app = express();

// CORS
app.use(cors({
  origin: [config.frontendUrl, 'https://studio.magnetraffic.com', 'http://localhost:5173', /\.lovable\.app$/, /\.magnetraffic\.com$/],
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
    // Migration 004: Remove estado check constraint
    try {
      const constraints = await pool.query(`
        SELECT con.conname FROM pg_constraint con
        JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
        WHERE con.conrelid = 'submissions'::regclass AND att.attname = 'estado' AND con.contype = 'c'
      `);
      for (const row of constraints.rows) {
        await pool.query(`ALTER TABLE submissions DROP CONSTRAINT "${row.conname}"`);
        console.log(`[Migration 004] Dropped estado constraint: ${row.conname}`);
      }
    } catch (e) {
      console.error('[Migration 004] Error:', e.message);
    }

    // Migration 005: Widen VARCHAR columns that receive AI-generated text
    try {
      await pool.query(`
        ALTER TABLE submissions
          ALTER COLUMN ai_veredicto TYPE TEXT,
          ALTER COLUMN ai_hook_descripcion TYPE TEXT,
          ALTER COLUMN ai_cta_descripcion TYPE TEXT,
          ALTER COLUMN ai_uso_recomendado TYPE TEXT,
          ALTER COLUMN estado TYPE VARCHAR(30)
      `);
      console.log('[Migration 005] Widened AI text columns to TEXT');
    } catch (e) {
      // Already done or columns don't exist
      if (!e.message.includes('already')) console.log('[Migration 005]', e.message);
    }

    // Migration 006: Password reset columns
    const hasResetCode = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_code')`);
    if (!hasResetCode.rows[0].exists) {
      console.log('Running migration 006: password reset columns...');
      await pool.query(`
        ALTER TABLE users
          ADD COLUMN reset_code VARCHAR(10),
          ADD COLUMN reset_code_expires TIMESTAMP
      `);
      console.log('Migration 006 complete!');
    }

    // Migration 007: submission_versions table + generation columns
    const hasVersions = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'submission_versions')`);
    if (!hasVersions.rows[0].exists) {
      console.log('Running migration 007: submission_versions + generation columns...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS submission_versions (
          id SERIAL PRIMARY KEY,
          submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL DEFAULT 1,
          tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('original', 'generated', 'iteration')),
          image_url TEXT,
          generation_prompt TEXT,
          generation_model VARCHAR(50),
          ai_score INTEGER,
          ai_recomendaciones JSONB DEFAULT '[]',
          client_feedback TEXT,
          client_satisfied BOOLEAN,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sv_submission ON submission_versions(submission_id);
      `);
      await pool.query(`
        ALTER TABLE submissions ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
        ALTER TABLE submissions ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT NULL;
      `);
      console.log('Migration 007 complete!');
    }

    // Migration 008: Archive support
    const hasArchived = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'archived')`);
    if (!hasArchived.rows[0].exists) {
      console.log('Running migration 008: archive columns...');
      await pool.query(`
        ALTER TABLE submissions ADD COLUMN archived BOOLEAN DEFAULT false;
        ALTER TABLE submissions ADD COLUMN archived_at TIMESTAMP;
      `);
      console.log('Migration 008 complete!');
    }
    // Migration 009: Add objetivo column
    const hasObjetivo = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'objetivo')`);
    if (!hasObjetivo.rows[0].exists) {
      console.log('Running migration 009: objetivo column...');
      await pool.query(`ALTER TABLE submissions ADD COLUMN objetivo VARCHAR(50)`);
      console.log('Migration 009 complete!');
    }

    // Migration 010: Share token columns
    const hasShareToken = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'share_token')`);
    if (!hasShareToken.rows[0].exists) {
      console.log('Running migration 010: share token columns...');
      await pool.query(`
        ALTER TABLE submissions ADD COLUMN share_token VARCHAR(48);
        ALTER TABLE submissions ADD COLUMN share_expires TIMESTAMP;
      `);
      console.log('Migration 010 complete!');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/submissions', require('./routes/submissions'));
app.use('/submissions', require('./routes/webhook-callback'));
app.use('/submissions', require('./routes/async-analyze'));
app.use('/submissions', require('./routes/chat'));
app.use('/submissions', require('./routes/generations'));
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

// File storage cleanup
const { startCleanupSchedule } = require('./services/file-storage');

// Start
initDB().then(() => {
  startCleanupSchedule();
  app.listen(config.port, () => {
    console.log(`MagnetCreative running on port ${config.port}`);
    console.log(`[Config] Claude key: ${config.claudeApiKey ? config.claudeApiKey.substring(0, 15) + '...' + config.claudeApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] OpenAI key: ${config.openaiApiKey ? config.openaiApiKey.substring(0, 15) + '...' + config.openaiApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] Gemini key: ${config.geminiApiKey ? config.geminiApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  });
});
