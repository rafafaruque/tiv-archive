// Simple SPC CSV ingestion into PostGIS `tornadoes` table.
// Usage: set DATABASE_URL and SPC_CSV_PATH and run `node scripts/ingest_spc.js`

const dotenv = require('dotenv')
const fs = require('fs')
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' })
} else {
  dotenv.config()
}
const parse = require('csv-parse').parse
const { Pool } = require('pg')
const { sourceKey } = require('../src/lib/sourceIdentity')

const csvPath = process.env.SPC_CSV_PATH
if (!csvPath) {
  console.error('Set SPC_CSV_PATH in env or .env')
  process.exit(1)
}

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
function ensurePool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return pool
}

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS tornadoes (
      id SERIAL PRIMARY KEY,
      event_id TEXT,
      ef_rating TEXT,
      path_length_km DOUBLE PRECISION,
      path_width_m DOUBLE PRECISION,
      fatalities INTEGER,
      injuries INTEGER,
      narrative TEXT,
      geom geometry(LineString,4326)
    );
    CREATE INDEX IF NOT EXISTS idx_tornadoes_geom ON tornadoes USING GIST (geom);
  `
  await pool.query(sql)
  await pool.query('ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS event_date DATE')
  await pool.query(fs.readFileSync('db/migrations/source_identity.sql', 'utf8'))
}

async function ingest() {
  await ensureTable()
  const skipRows = parseInt(process.env.SKIP_ROWS || '0', 10)
  const parser = fs.createReadStream(csvPath).pipe(parse({ columns: true, skip_empty_lines: true }))
  let count = 0
  let rowIndex = 0
  for await (const row of parser) {
    rowIndex++
    if (rowIndex <= skipRows) continue
    // adapt column names if needed; common SPC CSVs have: 'begin_lat','begin_lon','end_lat','end_lon'
    const beginLat = parseFloat(row.begin_lat || row.BEGIN_LAT || row.beginLat || row.slat || row.SLAT)
    const beginLon = parseFloat(row.begin_lon || row.BEGIN_LON || row.beginLon || row.slon || row.SLON)
    const endLat = parseFloat(row.end_lat || row.END_LAT || row.endLat || row.elat || row.ELAT)
    const endLon = parseFloat(row.end_lon || row.END_LON || row.endLon || row.elon || row.ELON)
    const pathLength = parseFloat(row.length_km || row.length || row.PathLength || row.len || row.LEN || 0)
    const pathWidth = parseFloat(row.width_m || row.width || row.PathWidth || row.wid || row.WID || 0)
    const ef = row.ef || row.EF || row.mag || row['mag'] || null
    const fat = parseInt(row.fat ?? row.FAT ?? row.fatals ?? row.FATALITIES, 10)
    const fatalities = Number.isFinite(fat) ? fat : null
    const inj = parseInt(row.inj ?? row.INJ ?? row.injuries ?? row.INJURIES, 10)
    const injuries = Number.isFinite(inj) ? inj : null
    const eventId = row.om || row.event_id || row.EVENT_ID || null
    const eventDate = row.date || row.DATE || row.event_date || null
    const narrative = row.narrative || row.NARRATIVE || row.EVENT_NARRATIVE || row['short_description'] || null

    if ([beginLat, beginLon, endLat, endLon].some(v => Number.isNaN(v))) continue

    const wkt = `LINESTRING(${beginLon} ${beginLat}, ${endLon} ${endLat})`
    const sql = `INSERT INTO tornadoes (event_id, ef_rating, path_length_km, path_width_m, fatalities, injuries, narrative, geom, event_date, source_key) VALUES ($1,$2,$3,$4,$5,$6,$7, ST_GeomFromText($8,4326),$9,$10) ON CONFLICT (source_key) WHERE duplicate_of IS NULL DO NOTHING`;
    let attempts = 0
    while (attempts < 5) {
      try {
        const p = ensurePool()
        await p.query(sql, [eventId, ef, pathLength, pathWidth, fatalities, injuries, narrative, wkt, eventDate, sourceKey(row)])
        break
      } catch (err) {
        console.error('insert error, attempt', attempts + 1, err.message || err)
        attempts++
        try { await new Promise(r => setTimeout(r, 1000 * attempts)) } catch(_){}
        try { await pool.end().catch(()=>{}) } catch(_){}
        pool = null
        if (attempts >= 5) throw err
      }
    }
    count++
    if (count % 500 === 0) console.log(`ingested ${count}`)
  }
  console.log(`done; total ingested ${count}`)
  await pool.end()
}

ingest().catch(err => { console.error(err); process.exit(1) })
