// Fast bulk ingestion: COPY CSV into a temp table then insert into tornadoes with geom
// Usage: node scripts/fast_ingest.js

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { Pool } = require('pg')
const { parse } = require('csv-parse/sync')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')
const { sourceKey } = require('../src/lib/sourceIdentity')
const copyFrom = require('pg-copy-streams').from

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(fs.readFileSync('db/migrations/source_identity.sql', 'utf8'))
    await client.query('ALTER TABLE tornadoes ADD COLUMN IF NOT EXISTS event_date DATE')
    console.log('Creating temp table...')
    await client.query(`CREATE TEMP TABLE tmp_spc_csv (
      om TEXT, yr TEXT, mo TEXT, dy TEXT, date TEXT, time TEXT, tz TEXT,
      st TEXT, stf TEXT, stn TEXT, mag TEXT, inj TEXT, fat TEXT, loss TEXT, closs TEXT,
      slat TEXT, slon TEXT, elat TEXT, elon TEXT, len TEXT, wid TEXT, ns TEXT, sn TEXT,
      sg TEXT, f1 TEXT, f2 TEXT, f3 TEXT, f4 TEXT, fc TEXT, edat TEXT, etime TEXT, source_key TEXT
    ) ON COMMIT DROP;`)

    const file = process.env.SPC_CSV_PATH || './data/spc_tornadoes.csv'
    if (!fs.existsSync(file)) throw new Error('CSV not found: ' + file)

    console.log('Starting COPY from', file)
    const rows = parse(fs.readFileSync(file, 'utf8'), {columns:true, skip_empty_lines:true})
    const fields = 'om yr mo dy date time tz st stf stn mag inj fat loss closs slat slon elat elon len wid ns sn sg f1 f2 f3 f4 fc edat etime'.split(' ')
    const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const csv = Readable.from(rows.map(row => [...fields.map(k => row[k]), sourceKey(row)].map(quote).join(',') + '\n'))
    await pipeline(csv, client.query(copyFrom("COPY tmp_spc_csv FROM STDIN WITH (FORMAT csv)")))

    console.log('COPY complete. Inserting into tornadoes...')
    // Insert mapping columns; convert to geometry
    const insertSql = `
      INSERT INTO tornadoes (event_id, ef_rating, path_length_km, path_width_m, fatalities, injuries, narrative, geom, event_date, source_key)
      SELECT om, mag, NULLIF(len,'')::double precision, NULLIF(wid,'')::double precision, NULLIF(fat,'')::int, NULLIF(inj,'')::int, NULL, 
        ST_SetSRID(ST_MakeLine(ST_MakePoint(NULLIF(slon,'')::double precision, NULLIF(slat,'')::double precision), ST_MakePoint(NULLIF(elon,'')::double precision, NULLIF(elat,'')::double precision)), 4326), NULLIF(date,'')::date, NULLIF(source_key,'')
      FROM tmp_spc_csv WHERE true ON CONFLICT (source_key) WHERE duplicate_of IS NULL DO NOTHING;
    `
    await client.query(insertSql)
    console.log('Insert complete.')

    await client.query('COMMIT')
    console.log('Temp table dropped. Done.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
