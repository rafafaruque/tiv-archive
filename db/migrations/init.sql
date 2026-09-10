-- Init migration for PostGIS and tornadoes table
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS tornadoes (
  id SERIAL PRIMARY KEY,
  event_id TEXT,
  event_date DATE,
  ef_rating TEXT,
  path_length_km DOUBLE PRECISION,
  path_width_m DOUBLE PRECISION,
  fatalities INTEGER,
  injuries INTEGER,
  geom geometry(LineString,4326)
);
CREATE INDEX IF NOT EXISTS idx_tornadoes_geom ON tornadoes USING GIST (geom);
