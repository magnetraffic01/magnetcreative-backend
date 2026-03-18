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
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/submissions', require('./routes/submissions'));
app.use('/admin', require('./routes/admin'));
app.use('/knowledge-base', require('./routes/knowledge-base'));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'MagnetCreative', timestamp: new Date().toISOString() });
});

// Start
initDB().then(() => {
  app.listen(config.port, () => {
    console.log(`MagnetCreative running on port ${config.port}`);
    console.log(`[Config] Claude key: ${config.claudeApiKey ? config.claudeApiKey.substring(0, 15) + '...' + config.claudeApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] OpenAI key: ${config.openaiApiKey ? config.openaiApiKey.substring(0, 15) + '...' + config.openaiApiKey.slice(-6) : 'NOT SET'}`);
    console.log(`[Config] Gemini key: ${config.geminiApiKey ? config.geminiApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
  });
});
