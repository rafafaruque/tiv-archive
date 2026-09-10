// Read-only audit by default; --apply records canonical identities without deleting rows.
require('dotenv').config({path:'.env.local'})
const fs=require('fs')
const {parse}=require('csv-parse/sync')
const {Pool}=require('pg')
const {sourceKey,indexSource,matchSource}=require('../src/lib/sourceIdentity')
async function run() {
  const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000})
  const client=await pool.connect()
  try {
    const source=parse(fs.readFileSync(process.env.SPC_CSV_PATH || 'data/spc_tornadoes.csv','utf8'),{columns:true,skip_empty_lines:true})
    const index=indexSource(source)
    const rows=(await client.query(`SELECT id,event_id,event_date::text,ef_rating,path_length_km,path_width_m,fatalities,injuries,
      ST_X(ST_StartPoint(geom)) AS start_lon,ST_Y(ST_StartPoint(geom)) AS start_lat,
      ST_X(ST_EndPoint(geom)) AS end_lon,ST_Y(ST_EndPoint(geom)) AS end_lat FROM tornadoes ORDER BY id`)).rows
    const groups=new Map();let uncertain=0
    for(const row of rows) {
      const match=matchSource(row,index)
      if(!match){uncertain++;continue}
      const key=sourceKey(match)
      if(!groups.has(key))groups.set(key,{canonical:row.id,source:match,ids:[]})
      groups.get(key).ids.push(row.id)
    }
    const mapping=[...groups].flatMap(([key,g])=>g.ids.map(id=>({id,source_key:key,duplicate_of:id===g.canonical?null:g.canonical,event_id:g.source.om,event_date:g.source.date,fatalities:+g.source.fat,injuries:+g.source.inj})))
    console.log({rows:rows.length,verifiedSourceRecords:groups.size,duplicateImports:mapping.filter(r=>r.duplicate_of!=null).length,unresolvedKeptSeparate:uncertain,visibleAfter:groups.size+uncertain})
    if(!process.argv.includes('--apply')){console.log('Audit only: no database changes.');return}
    await client.query('BEGIN')
    await client.query(fs.readFileSync('db/migrations/source_identity.sql','utf8'))
    // Apply aliases first, so a rerun cannot collide with the canonical unique index.
    mapping.sort((a,b)=>Number(b.duplicate_of!=null)-Number(a.duplicate_of!=null))
    for(let i=0;i<mapping.length;i+=2000) {
      await client.query(`UPDATE tornadoes t SET source_key=m.source_key,duplicate_of=m.duplicate_of,
        event_id=m.event_id,event_date=m.event_date,fatalities=m.fatalities,injuries=m.injuries
        FROM jsonb_to_recordset($1::jsonb) AS m(id int,source_key text,duplicate_of int,event_id text,event_date date,fatalities int,injuries int)
        WHERE t.id=m.id`,[JSON.stringify(mapping.slice(i,i+2000))])
    }
    await client.query('COMMIT');console.log('Applied canonical mapping and verified source casualties. No rows deleted.')
  } catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}
  finally{client.release();await pool.end()}
}
run().catch(e=>{console.error(e.message);process.exitCode=1})
