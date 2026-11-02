import { NextResponse } from 'next/server'

type Endpoint = 'search' | 'tornado'
const origin = 'https://tiv-archive-iszt.vercel.app'

export function useHostedTornadoData() {
  // Never fall back in production: a missing deployment secret must not proxy to itself.
  return process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL?.trim()
}

export function validatedTornadoQuery(endpoint: Endpoint, input: URLSearchParams): URLSearchParams | null {
  if (endpoint !== 'search' && endpoint !== 'tornado') return null
  const allowed = endpoint === 'search' ? ['lat', 'lon', 'radiusKm', 'datesOnly'] : ['id']
  for (const key of Array.from(input.keys())) {
    if (!allowed.includes(key) || input.getAll(key).length !== 1) return null
  }
  if (endpoint === 'tornado') {
    const id = input.get('id') || ''
    return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) <= 2147483647
      ? new URLSearchParams({ id }) : null
  }
  const datesOnly = input.get('datesOnly')
  if (datesOnly !== null && datesOnly !== 'true' && datesOnly !== 'false') return null
  if (datesOnly === 'true') return Array.from(input.keys()).length === 1 ? new URLSearchParams({ datesOnly: 'true' }) : null
  const number = (key: string, fallback?: number) => {
    const raw = input.get(key)
    return raw === null ? fallback ?? NaN : raw.trim() ? Number(raw) : NaN
  }
  const lat = number('lat'), lon = number('lon'), radiusKm = number('radiusKm', 50)
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 ||
      !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 500) return null
  return new URLSearchParams({ lat: String(lat), lon: String(lon), radiusKm: String(radiusKm) })
}

export async function proxyHostedTornadoData(endpoint: Endpoint, input: URLSearchParams) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  const params = validatedTornadoQuery(endpoint, input)
  if (!params) return json({ error: 'Invalid tornado data query.' }, 400)
  if (!useHostedTornadoData()) return json({ error: 'Hosted tornado data is only available in development without DATABASE_URL.' }, 503)
  try {
    // Construct from a fixed origin and two fixed paths. Never forward request headers or follow redirects.
    const response = await fetch(`${origin}/api/${endpoint}?${params}`, {
      method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit',
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    })
    if (endpoint === 'tornado' && response.status === 404) return json({ error: 'Tornado record not found.' }, 404)
    if (!response.ok) throw new Error('Hosted request failed')
    const payload = await response.json()
    const record = (value: any) => value && typeof value === 'object' && !Array.isArray(value) && Number.isInteger(value.id) && value.id > 0
    const date = (value: unknown) => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    if (endpoint === 'tornado' && record(payload?.tornado)) return json({ tornado: payload.tornado })
    if (endpoint === 'search' && payload?.dateRange && date(payload.dateRange.min_date) && date(payload.dateRange.max_date)) {
      if (params.has('datesOnly')) return json({ dateRange: payload.dateRange })
      if (Array.isArray(payload.data) && payload.data.length <= 200 && payload.data.every(record)) {
        return json({ data: payload.data, dateRange: payload.dateRange })
      }
    }
    throw new Error('Invalid hosted response')
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    return json({ error: timeout ? 'The hosted tornado data service timed out. Please try again.'
      : 'The hosted tornado data service is unavailable. Please try again shortly.' }, timeout ? 504 : 502)
  }
}
