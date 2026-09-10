require('dotenv').config({path:'.env.local'});
const {Pool} = require('pg');
(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const lon = -96.7970;
  const lat = 32.7767;
  const r = 50 * 1000;
  const sql = `SELECT id, ef_rating, path_length_km, fatalities, ST_AsGeoJSON(geom) as geom FROM tornadoes WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3) ORDER BY path_length_km DESC LIMIT 10`;
  const res = await pool.query(sql, [lon, lat, r]);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
})().catch(e=>{ console.error(e); process.exit(1); });
