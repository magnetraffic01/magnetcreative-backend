CREATE TABLE IF NOT EXISTS submission_versions (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('original', 'generated', 'iteration', 'resubmit')),
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
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT NULL;
