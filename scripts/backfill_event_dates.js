// Dry run by default. --apply commits dates matched unambiguously to source records.
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { Pool } = require('pg')
const { from } = require('pg-copy-streams')
const { pipeline } = require('stream/promises')
async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(fs.readFileSync('db/migrations/event_dates.sql', 'utf8'))
    await client.query(`CREATE TEMP TABLE source_dates (
      om TEXT, yr TEXT, mo TEXT, dy TEXT, date TEXT, time TEXT, tz TEXT,
      st TEXT, stf TEXT, stn TEXT, mag TEXT, inj TEXT, fat TEXT, loss TEXT, closs TEXT,
      slat TEXT, slon TEXT, elat TEXT, elon TEXT, len TEXT, wid TEXT, ns TEXT, sn TEXT,
      sg TEXT, f1 TEXT, f2 TEXT, f3 TEXT, f4 TEXT, fc TEXT, edat TEXT, etime TEXT
    ) ON COMMIT DROP`)
    await pipeline(fs.createReadStream(process.env.SPC_CSV_PATH || 'data/spc_tornadoes.csv'), client.query(from('COPY source_dates FROM STDIN WITH (FORMAT csv, HEADER true)')))
    await client.query(`CREATE TEMP TABLE date_matches ON COMMIT DROP AS
      SELECT t.id, min(s.date::date) AS event_date, count(DISTINCT s.date::date) AS candidate_dates
      FROM tornadoes t JOIN source_dates s ON
        ST_AsEWKB(t.geom) = ST_AsEWKB(ST_SetSRID(ST_MakeLine(
          ST_MakePoint(s.slon::float8,s.slat::float8), ST_MakePoint(s.elon::float8,s.elat::float8)),4326))
        AND t.ef_rating = s.mag AND t.path_length_km = s.len::float8
        AND t.path_width_m = s.wid::float8
        AND coalesce(t.injuries,0) = s.inj::int AND coalesce(t.fatalities,0) = s.fat::int
        AND (t.event_id IS NULL OR t.event_id = s.om)
      WHERE t.event_date IS NULL
      GROUP BY t.id`)
    console.log((await client.query(`SELECT count(*) FILTER(WHERE candidate_dates=1) AS unambiguous,
      count(*) FILTER(WHERE candidate_dates>1) AS ambiguous,
      (SELECT count(*) FROM tornadoes WHERE event_date IS NULL) - count(*) AS unmatched,
      min(event_date) FILTER(WHERE candidate_dates=1)::text AS min_date,
      max(event_date) FILTER(WHERE candidate_dates=1)::text AS max_date FROM date_matches`)).rows[0])
    if (process.argv.includes('--apply')) {
      const updated = await client.query(`UPDATE tornadoes t SET event_date=m.event_date FROM date_matches m
        WHERE t.id=m.id AND m.candidate_dates=1 AND t.event_date IS NULL`)
      console.log('Updated:', updated.rowCount)
      await client.query('COMMIT')
    } else { await client.query('ROLLBACK'); console.log('Dry run: no database changes committed.') }
  } catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release(); await pool.end() }
}
run().catch(e => { console.error(e.message); process.exitCode=1 })
