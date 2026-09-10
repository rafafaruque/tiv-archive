-- Enable pgvector and add embedding column for semantic search
-- Enable vector extension (Supabase lists this as `vector`) and add embedding column for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_tornadoes_embedding ON tornadoes USING ivfflat (embedding) WITH (lists = 100);
