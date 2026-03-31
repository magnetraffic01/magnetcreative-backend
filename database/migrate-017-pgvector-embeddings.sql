-- Migration 017: pgvector extension + kb_embeddings table
-- Enables semantic search on knowledge base entries

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_embeddings (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(768),
  negocio VARCHAR(50),
  categoria VARCHAR(50),
  tenant_id INTEGER REFERENCES tenants(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kbe_kb_id ON kb_embeddings(kb_id);
CREATE INDEX IF NOT EXISTS idx_kbe_tenant ON kb_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kbe_negocio ON kb_embeddings(negocio);

-- IVFFlat index for cosine similarity search (created after data exists)
-- Will be created in code after first batch of embeddings
