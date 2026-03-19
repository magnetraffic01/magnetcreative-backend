-- Add categoria column to knowledge_base
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'general';

-- Add documento_nombre column (original filename of uploaded document)
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS documento_nombre VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_kb_categoria ON knowledge_base(categoria);
