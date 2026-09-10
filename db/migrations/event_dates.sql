-- Nullable so unmatched historical records never acquire invented dates.
ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS event_date DATE;
CREATE INDEX IF NOT EXISTS idx_tornadoes_event_date ON tornadoes(event_date);
