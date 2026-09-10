import { enrichRecords } from '../../../src/lib/sourceMetadata'
import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import OpenAI from 'openai'
import { getCachedParse, setCachedParse } from '../../../src/lib/parseCache'

const connection = process.env.DATABASE_URL || ''
const pool = connection ? new Pool({ connectionString: connection }) : null
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

async function parseNLWithOpenAI(q: string) {
  if (!openai) throw new Error('OPENAI_API_KEY not set')
  const system = `You are a parser that extracts structured filters from a short natural-language query about tornado events. Respond with JSON only. Fields: lat (number or null), lon (number or null), radiusKm (number or null), date_from (YYYY-MM-DD or null), date_to (YYYY-MM-DD or null), ef_min (number or null), ef_max (number or null), text (string or null).
If the query mentions only an EF threshold like "EF4+" set ef_min to 4. If a decade is mentioned like "90s" choose date_from=1990-01-01 date_to=1999-12-31. If a city is mentioned but no coords, leave lat/lon null (caller will geocode).`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Parse into JSON: "${q}"` }
    ],
    max_tokens: 300,
    temperature: 0
  })
  const text = resp.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(text) } catch (e) { return null }
}

function mockParse(q: string) {
  const out: any = { lat: null, lon: null, radiusKm: null, date_from: null, date_to: null, ef_min: null, ef_max: null, text: null, _source: 'mock' }
  // EF
  const efMatch = q.match(/EF\s*\+?(\d)/i)
  if (efMatch) out.ef_min = parseInt(efMatch[1], 10)
  // year / since
  const sinceMatch = q.match(/since\s*(\d{4})/i)
  const yearMatch = q.match(/(\d{4})/)
  if (sinceMatch) {
    out.date_from = `${sinceMatch[1]}-01-01`
  } else if (yearMatch) {
    out.date_from = `${yearMatch[1]}-01-01`
  }
  // decade like 90s
  const decade = q.match(/(\d{2})0s\b/)
  if (decade) {
    const start = parseInt(decade[1], 10) * 10
    out.date_from = `${start}-01-01`
    out.date_to = `${start + 9}-12-31`
  }
  // text fallback
  if (!out.ef_min && !out.date_from) out.text = q
  return out
}

export async function POST(request: Request) {
  const body = await request.json()
  const q = body.q
  const parseOnly = body.parseOnly === true
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })
  if (!pool) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
  // try cache
  let parsed = getCachedParse(q)

  // if not cached, either use mock (dev) or call OpenAI; on OpenAI error, fall back to mock
  if (!parsed) {
    if (process.env.PARSER_MOCK === 'true') {
      parsed = mockParse(q)
      setCachedParse(q, parsed)
    } else {
      try {
        parsed = await parseNLWithOpenAI(q)
        if (parsed) setCachedParse(q, parsed)
      } catch (err) {
        // if OpenAI fails, fall back to mock parser and cache result
        parsed = mockParse(q)
        setCachedParse(q, parsed)
      }
    }
  }

  if (!parsed) return NextResponse.json({ error: 'Could not parse query' }, { status: 500 })

  if (parseOnly) {
    return NextResponse.json({ parsed })
  }

  // if there's a text search, perform semantic search via embeddings
  if (parsed.text) {
    if (!openai) return NextResponse.json({ error: 'Semantic search is not configured' }, { status: 503 })
    const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: parsed.text })
    const vector = emb.data[0].embedding
    const sql = `SELECT id, event_id, ARRAY(SELECT a.id FROM tornadoes a WHERE a.duplicate_of = tornadoes.id ORDER BY a.id) AS alias_ids, event_date::text AS event_date, ef_rating, path_length_km, path_width_m, injuries, fatalities, ST_AsGeoJSON(geom) as geom FROM tornadoes WHERE duplicate_of IS NULL AND embedding IS NOT NULL ORDER BY embedding <=> $1, id ASC LIMIT 200`;
    const res = await pool.query(sql, [vector])
    return NextResponse.json({ parsed, data: await enrichRecords(res.rows) })
  }

  // fallback to spatial/attribute query
  const lat = parsed.lat
  const lon = parsed.lon
  const radiusKm = parsed.radiusKm || 50
  const radiusMeters = radiusKm * 1000
  let clauses: string[] = ['duplicate_of IS NULL']
  let params: any[] = []
  if (parsed.ef_min != null) {
    params.push(parsed.ef_min)
    // Safely extract digits from ef_rating and compare as int; non-numeric ratings become -1
    clauses.push(`(COALESCE(NULLIF(regexp_replace(ef_rating, '[^0-9]', '', 'g'), '')::int, -1) >= $${params.length}::int)`)
  }
  if (lat != null && lon != null) {
    params.push(lon, lat, radiusMeters)
    clauses.push(`ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($${params.length-2}, $${params.length-1}),4326)::geography, $${params.length})`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const sql = `SELECT id, event_id, ARRAY(SELECT a.id FROM tornadoes a WHERE a.duplicate_of = tornadoes.id ORDER BY a.id) AS alias_ids, event_date::text AS event_date, ef_rating, path_length_km, path_width_m, injuries, fatalities, ST_AsGeoJSON(geom) as geom FROM tornadoes ${where} ORDER BY id ASC LIMIT 500`
  const res = await pool.query(sql, params)
  return NextResponse.json({ parsed, data: await enrichRecords(res.rows) })
}
