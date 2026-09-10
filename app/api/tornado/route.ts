import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { NextResponse } from 'next/server'
import { query } from '../../../src/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const sql = `SELECT id, event_id, event_date::text AS event_date, ef_rating, path_length_km, path_width_m, injuries, fatalities, ST_AsGeoJSON(geom) as geom FROM tornadoes WHERE id = (SELECT COALESCE(duplicate_of,id) FROM tornadoes WHERE id = $1) LIMIT 1`
  const res = await query(sql, [id])
  if (!res || res.rowCount === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const row = res.rows[0]
  return NextResponse.json({ tornado: (await enrichRecords([row]))[0] })
}
