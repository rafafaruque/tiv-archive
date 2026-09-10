import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { NextResponse } from 'next/server'
import { query } from '../../../src/lib/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))
  const radiusKm = Number(url.searchParams.get('radiusKm') || '50')

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ data: [], message: 'DATABASE_URL not configured; return mock data' })
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || !Number.isFinite(radiusKm) || radiusKm<1 || radiusKm>500) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  if (url.searchParams.get('datesOnly') === 'true') {
    const extent = await query('SELECT min(event_date)::text AS min_date, max(event_date)::text AS max_date FROM tornadoes WHERE duplicate_of IS NULL')
    return NextResponse.json({ dateRange: extent.rows[0] })
  }

  const radiusMeters = radiusKm * 1000
  const sql = `
    SELECT id, ARRAY(SELECT a.id FROM tornadoes a WHERE a.duplicate_of = tornadoes.id ORDER BY a.id) AS alias_ids, event_id, event_date::text AS event_date, ef_rating, path_length_km, path_width_m, injuries, fatalities,
      ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000 AS distance_km,
      ST_X(ST_StartPoint(geom)) as start_lon, ST_Y(ST_StartPoint(geom)) as start_lat,
      ST_X(ST_EndPoint(geom)) as end_lon, ST_Y(ST_EndPoint(geom)) as end_lat
    FROM tornadoes
    WHERE duplicate_of IS NULL AND ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ORDER BY path_length_km DESC NULLS LAST, id ASC
    LIMIT 200
  `
  const res = await query(sql, [lon, lat, radiusMeters])
  const extent = await query('SELECT min(event_date)::text AS min_date, max(event_date)::text AS max_date FROM tornadoes WHERE duplicate_of IS NULL')
  return NextResponse.json({ data: await enrichRecords(res.rows), dateRange: extent.rows[0] })
}
