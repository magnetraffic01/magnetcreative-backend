-- MagnetCreative Database Schema

-- Users table (admin = Amed, creative = designers)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'creative' CHECK (role IN ('admin', 'creative')),
  negocio VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- Submissions (videos, images, emails, presentations)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('video', 'imagen', 'presentacion', 'plantilla', 'email')),
  negocio VARCHAR(50) NOT NULL,
  plataforma VARCHAR(50) DEFAULT 'facebook',
  formato VARCHAR(30),
  descripcion TEXT,
  archivo_url TEXT,
  archivo_nombre VARCHAR(255),
  archivo_size INTEGER,
  contenido_email TEXT,
  gemini_file_uri TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('analizando', 'evaluado', 'aprobado', 'cambios', 'rechazado', 'pendiente', 'error')),
  -- AI Analysis
  ai_score INTEGER,
  ai_resumen TEXT,
  ai_veredicto VARCHAR(20),
  ai_hook_presente BOOLEAN,
  ai_hook_descripcion TEXT,
  ai_cta_presente BOOLEAN,
  ai_cta_descripcion TEXT,
  ai_fortalezas JSONB DEFAULT '[]',
  ai_problemas JSONB DEFAULT '[]',
  ai_recomendaciones JSONB DEFAULT '[]',
  ai_uso_recomendado VARCHAR(50),
  ai_analyzed_at TIMESTAMP,
  -- Admin review (Amed)
  admin_decision VARCHAR(20) CHECK (admin_decision IN ('aprobado', 'cambios', 'rechazado')),
  admin_comentario TEXT,
  admin_reviewed_at TIMESTAMP,
  admin_reviewed_by INTEGER REFERENCES users(id),
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert admin user (Amed)
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@magnetraffic.com', '$2b$10$placeholder', 'Amed Garces', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_estado ON submissions(estado);
CREATE INDEX IF NOT EXISTS idx_submissions_negocio ON submissions(negocio);
CREATE INDEX IF NOT EXISTS idx_submissions_tipo ON submissions(tipo);
