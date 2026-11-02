import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { NextResponse } from 'next/server'
import { query } from '../../../src/lib/db'
import { proxyHostedTornadoData, useHostedTornadoData, validatedTornadoQuery } from '../../../src/lib/hostedTornadoData'

export const dynamic = 'force-dynamic'

async function handleGet(req: Request) {
  const params = validatedTornadoQuery('tornado', new URL(req.url).searchParams)
  if (!params) return NextResponse.json({ error: 'A valid tornado ID is required.' }, { status: 400 })
  if (useHostedTornadoData()) return proxyHostedTornadoData('tornado', params)
  const id = params.get('id')

  const sql = `SELECT id, event_id, event_date::text AS event_date, ef_rating, path_length_km, path_width_m, injuries, fatalities, ST_AsGeoJSON(geom) as geom FROM tornadoes WHERE id = (SELECT COALESCE(duplicate_of,id) FROM tornadoes WHERE id = $1) LIMIT 1`
  const res = await query(sql, [id])
  if (!res || res.rowCount === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const row = res.rows[0]
  return NextResponse.json({ tornado: (await enrichRecords([row]))[0] })
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
