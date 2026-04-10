const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const app = express();

// CORS - dynamic origin for multi-tenant support
app.use(cors({
  origin: function(origin, callback) {
    // Allow no-origin requests (mobile apps, curl)
    if (!origin) return callback(null, true);

    // Always allow these
    const allowed = [
      config.frontendUrl,
      'https://studio.magnetraffic.com',
      'http://localhost:5173'
    ];
    if (allowed.includes(origin)) return callback(null, true);

    // Allow any *.magnetraffic.com or *.magnetcreative.com subdomain (for tenants)
    if (/\.(magnetraffic|magnetcreative)\.com$/.test(origin)) return callback(null, true);

    // Allow lovable.app for development
    if (/\.lovable\.app$/.test(origin)) return callback(null, true);

    // Check tenant domains in DB (async)
    pool.query('SELECT domain FROM tenants WHERE domain = $1 AND status = $2', [origin.replace(/^https?:\/\//, ''), 'active'])
      .then(result => {
        if (result.rows.length > 0) return callback(null, true);
        callback(new Error('CORS not allowed'));
      })
      .catch(() => callback(null, false));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Database - strip sslmode from URL and disable SSL
const dbUrl = (config.databaseUrl || '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false,
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Prevent crash on PostgreSQL disconnect (code 57P01)
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
  if (err.code === '57P01') {
    console.log('[DB Pool] PostgreSQL terminated connection - pool will auto-reconnect');
  }
});

app.set('db', pool);

// ActuarialAds Database (for creative_vault sync)
if (config.actuarialDbUrl) {
  const actuarialUrl = config.actuarialDbUrl.replace(/[?&]sslmode=[^&]*/g, '');
  const actuarialPool = new Pool({
    connectionString: actuarialUrl,
    ssl: false
  });
  actuarialPool.on('error', (err) => {
    console.error('[ActuarialDB Pool] Unexpected error on idle client:', err.message);
  });
  app.set('actuarialDb', actuarialPool);
  console.log('ActuarialAds DB connected');
}

// Init database with retry
async function initDB(retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
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
      return;
    } catch (err) {
      console.error(`DB init error (attempt ${attempt}/${retries}):`, err.message);
      if (attempt < retries) {
        const delay = attempt * 3000;
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  console.error('[DB] All init attempts failed - server running without DB');
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
      await pool.query('BEGIN');
      await pool.query(`
        ALTER TABLE submissions
          ALTER COLUMN ai_veredicto TYPE TEXT,
          ALTER COLUMN ai_hook_descripcion TYPE TEXT,
          ALTER COLUMN ai_cta_descripcion TYPE TEXT,
          ALTER COLUMN ai_uso_recomendado TYPE TEXT,
          ALTER COLUMN estado TYPE VARCHAR(30)
      `);
      await pool.query('COMMIT');
      console.log('[Migration 005] Widened AI text columns to TEXT');
    } catch (e) {
      await pool.query('ROLLBACK');
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
      try {
        await pool.query('BEGIN');
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
        await pool.query('COMMIT');
        console.log('Migration 007 complete!');
      } catch (e) {
        await pool.query('ROLLBACK');
        console.error('[Migration 007] Error:', e.message);
      }
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
    // Migration 011: FK constraint + widen reset_code
    try {
      await pool.query(`ALTER TABLE submissions ADD CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
      console.log('[Migration 011] FK constraint added');
    } catch (e) {
      if (!e.message.includes('already exists')) console.log('[Migration 011]', e.message);
    }
    try {
      await pool.query(`ALTER TABLE users ALTER COLUMN reset_code TYPE VARCHAR(64)`);
      console.log('[Migration 011] Widened reset_code to VARCHAR(64)');
    } catch (e) {
      if (!e.message.includes('already')) console.log('[Migration 011]', e.message);
    }

    // Migration 012: tenants table
    const hasTenants = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants')`);
    if (!hasTenants.rows[0].exists) {
      console.log('Running migration 012: tenants table...');
      await pool.query(`
        CREATE TABLE tenants (
          id SERIAL PRIMARY KEY,
          slug VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255),
          logo_url TEXT,
          primary_color VARCHAR(7) DEFAULT '#D4AF37',
          secondary_color VARCHAR(7) DEFAULT '#1a365d',
          plan VARCHAR(20) DEFAULT 'starter',
          status VARCHAR(20) DEFAULT 'active',
          max_users INTEGER DEFAULT 10,
          max_evaluations_month INTEGER DEFAULT 100,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Migration 012 complete!');
    }

    // Migration 013: tenant_id on all tables
    const hasTenantId = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id')`);
    if (!hasTenantId.rows[0].exists) {
      console.log('Running migration 013: tenant_id columns...');
      try {
        await pool.query('BEGIN');
        await pool.query(`
          ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
          ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
          ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
        `);
        await pool.query('COMMIT');
        console.log('Migration 013 complete!');
      } catch (e) {
        await pool.query('ROLLBACK');
        console.error('[Migration 013] Error:', e.message);
      }
    }

    // Migration 014: businesses table
    const hasBusinesses = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'businesses')`);
    if (!hasBusinesses.rows[0].exists) {
      console.log('Running migration 014: businesses table...');
      await pool.query(`
        CREATE TABLE businesses (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id),
          name VARCHAR(100) NOT NULL,
          description TEXT,
          audience TEXT,
          tone TEXT,
          colors TEXT,
          visual_style TEXT,
          rules TEXT,
          products TEXT,
          urls TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(tenant_id, name)
        )
      `);
      console.log('Migration 014 complete!');
    }

    // Migration 015: default tenant + assign existing data
    try {
      const defaultTenant = await pool.query(`SELECT id FROM tenants WHERE slug = 'magnetraffic'`);
      if (defaultTenant.rows.length === 0) {
        console.log('Running migration 015: default tenant...');
        await pool.query('BEGIN');
        await pool.query(`INSERT INTO tenants (slug, name, domain, status, plan) VALUES ('magnetraffic', 'MagneTraffic', 'studio.magnetraffic.com', 'active', 'enterprise')`);
        const tid = await pool.query(`SELECT id FROM tenants WHERE slug = 'magnetraffic'`);
        const tenantId = tid.rows[0].id;
        await pool.query(`UPDATE users SET tenant_id = $1 WHERE tenant_id IS NULL`, [tenantId]);
        await pool.query(`UPDATE submissions SET tenant_id = $1 WHERE tenant_id IS NULL`, [tenantId]);
        await pool.query(`UPDATE knowledge_base SET tenant_id = $1 WHERE tenant_id IS NULL`, [tenantId]);
        await pool.query('COMMIT');
        console.log('Migration 015 complete!');
      }
    } catch (e) {
      await pool.query('ROLLBACK');
      console.log('[Migration 015]', e.message);
    }

    // Migration 016: expanded roles + permissions
    const hasPermissions = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'permissions')`);
    if (!hasPermissions.rows[0].exists) {
      console.log('Running migration 016: permissions + roles...');
      try {
        await pool.query('BEGIN');
        await pool.query(`ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '[]'`);
        await pool.query(`UPDATE users SET role = 'super_admin' WHERE email = 'admin@magnetraffic.com'`);
        await pool.query('COMMIT');
        console.log('Migration 016 complete!');
      } catch (e) {
        await pool.query('ROLLBACK');
        console.error('[Migration 016] Error:', e.message);
      }
    }

    // Migration 017: pgvector + kb_embeddings for semantic search
    const hasKBEmbeddings = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kb_embeddings')`);
    if (!hasKBEmbeddings.rows[0].exists) {
      console.log('Running migration 017: pgvector + kb_embeddings...');
      try {
        const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrate-017-pgvector-embeddings.sql'), 'utf8');
        await pool.query(migration);
        console.log('Migration 017 complete!');
        // Re-embed existing KB entries in background
        const { reembedAll } = require('./services/embedding');
        reembedAll(pool).catch(err => console.error(`[Embedding] Initial re-embed failed: ${err.message}`));
      } catch (e) {
        if (e.message.includes('could not open extension control file') || e.message.includes('extension "vector" is not available')) {
          console.warn('[Migration 017] pgvector extension not installed on this PostgreSQL server.');
          console.warn('[Migration 017] Install pgvector: https://github.com/pgvector/pgvector');
          console.warn('[Migration 017] Semantic search will be disabled, legacy KB loading will be used.');
        } else {
          console.error('[Migration 017] Error:', e.message);
        }
      }
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
app.use('/tenants', require('./routes/tenants'));
app.use('/businesses', require('./routes/businesses'));
app.use('/heygen', require('./routes/heygen'));

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
    console.log(`[Config] Claude key: ${config.claudeApiKey ? 'SET' : 'NOT SET'}`);
    console.log(`[Config] OpenAI key: ${config.openaiApiKey ? 'SET' : 'NOT SET'}`);
    console.log(`[Config] Gemini key: ${config.geminiApiKey ? 'SET' : 'NOT SET'}`);
  });
});
