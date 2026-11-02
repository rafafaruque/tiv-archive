import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { NextResponse } from 'next/server'
import { query } from '../../../src/lib/db'
import { proxyHostedTornadoData, useHostedTornadoData, validatedTornadoQuery } from '../../../src/lib/hostedTornadoData'

export const dynamic = 'force-dynamic'

async function handleGet(request: Request) {
  const params = validatedTornadoQuery('search', new URL(request.url).searchParams)
  if (!params) return NextResponse.json({ error: 'Provide valid lat, lon, and radiusKm (1–500), or datesOnly=true.' }, { status: 400 })
  if (useHostedTornadoData()) return proxyHostedTornadoData('search', params)

  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: 'The tornado data service is unavailable. Please try again shortly.' }, { status: 503 })
  }

  if (params.has('datesOnly')) {
    const extent = await query('SELECT min(event_date)::text AS min_date, max(event_date)::text AS max_date FROM tornadoes WHERE duplicate_of IS NULL')
    return NextResponse.json({ dateRange: extent.rows[0] })
  }

  const lat = Number(params.get('lat')), lon = Number(params.get('lon'))
  const radiusMeters = Number(params.get('radiusKm')) * 1000
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

export async function GET(request: Request) {
  try {
    return await handleGet(request)
  } catch (error) {
    // Connection errors can contain credentials or SQL; log only a safe code.
    const code = (error as { code?: unknown })?.code
    console.error('Tornado API request failed', { code: typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'UNEXPECTED_ERROR' })
    return NextResponse.json({ error: 'The tornado data service is unavailable. Please try again shortly.' }, { status: 503 })
  }
}
