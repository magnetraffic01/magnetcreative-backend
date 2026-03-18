-- Migration 001: Add negocios array to users + knowledge_base table
-- Run this on existing database

-- Add negocios column to users (if not exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS negocios JSONB DEFAULT '[]';

-- Backfill: copy existing negocio value into negocios array
UPDATE users SET negocios = json_build_array(negocio)::jsonb WHERE negocio IS NOT NULL AND (negocios IS NULL OR negocios = '[]'::jsonb);

-- Knowledge Base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  tipo VARCHAR(30) DEFAULT 'rules' CHECK (tipo IN ('guidelines', 'rules', 'templates', 'objectives')),
  negocio VARCHAR(50),
  contenido TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_tipo ON knowledge_base(tipo);
CREATE INDEX IF NOT EXISTS idx_kb_negocio ON knowledge_base(negocio);
