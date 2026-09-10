-- Keep original records/IDs; verified repeat imports point to one canonical row.
ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS duplicate_of INTEGER REFERENCES tornadoes(id);
CREATE INDEX IF NOT EXISTS idx_tornadoes_duplicate_of ON tornadoes(duplicate_of);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tornadoes_canonical_source
  ON tornadoes(source_key) WHERE duplicate_of IS NULL;
