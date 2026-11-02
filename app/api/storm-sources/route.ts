import { NextResponse } from 'next/server'
import { query } from '../../../src/lib/db'
import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { toFeatures } from '../../../src/lib/tornadoDisplay'
import { parseStormSources, stormSearchRequest, StormSourcesResponse } from '../../../src/lib/stormSources'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Per-process, bounded cache. Serverless instances each maintain their own cache.
const cache = new Map<number, StormSourcesResponse>()
const pending = new Map<number, Promise<StormSourcesResponse>>()
const DAY = 24 * 60 * 60 * 1000
const EMPTY_TTL = 15 * 60 * 1000

class SourceError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function searchStorm(id: number, apiKey: string): Promise<StormSourcesResponse> {
  const records = await query(`
    SELECT id, event_id, event_date::text AS event_date, ef_rating, path_length_km,
      path_width_m, injuries, fatalities, ST_AsGeoJSON(geom) AS geom
    FROM tornadoes
    WHERE id = (SELECT COALESCE(duplicate_of, id) FROM tornadoes WHERE id = $1)
    LIMIT 1
  `, [id])
  if (!records.rows.length) throw new SourceError('This tornado record could not be found.', 404)
  const storm = toFeatures(await enrichRecords(records.rows))[0]
  if (!storm) throw new SourceError('This record has no usable location for a historical search.', 422)
  const body = stormSearchRequest(storm)
  if (!body) throw new SourceError('This record has no confirmed date for a historical search.', 422)

  const response = await fetch('https://api.parallel.ai/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    throw new SourceError(response.status === 429
      ? 'Source search is busy. Please try again shortly.'
      : 'Historical source search is unavailable. Please try again shortly.', response.status === 429 ? 429 : 502)
  }
  const sources = parseStormSources(await response.json(), storm)
  return { sources, expiresAt: Date.now() + (sources.length ? DAY : EMPTY_TTL) }
}

export async function GET(request: Request) {
  const rawId = new URL(request.url).searchParams.get('id') || ''
  const id = Number(rawId)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id) || id > 2147483647) {
    return json({ error: 'A valid tornado ID is required.' }, 400)
  }
  const hit = cache.get(id)
  if (hit && hit.expiresAt > Date.now()) return json(hit)
  cache.delete(id)
  const apiKey = process.env.PARALLEL_API_KEY?.trim()
  if (!apiKey) return json({ error: 'Historical source search is not configured yet.' }, 503)

  try {
    let lookup = pending.get(id)
    if (!lookup) {
      lookup = searchStorm(id, apiKey).then(result => {
        for (const [key, value] of cache) if (value.expiresAt <= Date.now()) cache.delete(key)
        if (cache.size >= 500) cache.delete(cache.keys().next().value!)
        cache.set(id, result)
        return result
      }).finally(() => pending.delete(id))
      pending.set(id, lookup)
    }
    return json(await lookup)
  } catch (error) {
    // Never return provider bodies, credentials, SQL, or connection details.
    if (error instanceof SourceError) return json({ error: error.message }, error.status)
    return json({ error: 'Historical source search is unavailable. Please try again shortly.' }, 503)
  }
}
