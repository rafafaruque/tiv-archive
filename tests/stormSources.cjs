const assert = require('node:assert/strict')
const fs = require('fs'), ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename)

const { stormSearchRequest, parseStormSources } = require('../src/lib/stormSources.ts')
const storm = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-97, 33], [-96, 34]] },
  properties: { id: 1, event_date: '2011-05-24', state: 'OK', city: 'El Reno', county: 'Canadian', ef_rating: '5', event_id: '123' } }
const body = stormSearchRequest(storm)
assert.equal(body.mode, 'fast')
assert.equal(body.advanced_settings.max_results, 5)
assert.equal(body.advanced_settings.excerpt_settings.max_chars_per_result, 1200)
for (const identifier of ['2011-05-24', 'Oklahoma', 'El Reno', 'Canadian County', '33.0000, -97.0000', '34.0000, -96.0000', '123']) assert(body.objective.includes(identifier))
assert(body.search_queries.every(query => query.length <= 200 && query.includes('2011-05-24')))
assert.equal(stormSearchRequest({ ...storm, properties: { id: 2 } }), null)
assert(stormSearchRequest({ ...storm, properties: { id: 2, event_date: '2011-05-24' } }).objective.includes('state unavailable'))
const provider = { results: [
  { title: 'NWS report', url: 'https://www.weather.gov/oun/storm', excerpts: ['The tornado damaged several homes near El Reno in Oklahoma.', 'The storm tracked northeast across open farmland.'] },
  { title: 'Duplicate', url: 'https://www.weather.gov/oun/storm', excerpts: ['Duplicate'] },
  { title: 'Unsafe', url: 'javascript:alert(1)', excerpts: ['Unsafe'] },
  { title: 'Bad URL', url: 'not a url' },
  { title: 'Archive', url: 'https://example.com/archive', excerpts: [] },
] }
const parsed = parseStormSources(provider, storm)
assert.equal(parsed.length, 2)
assert.equal(parsed[0].domain, 'weather.gov')
assert.equal(parsed[0].excerpt, 'The tornado damaged several homes near El Reno in Oklahoma. The storm tracked northeast across open farmland.')
assert.equal(parsed[0].relevance, 'broader-outbreak')
assert.equal(parsed[1].excerpt, '')
assert.throws(() => parseStormSources({ error: 'malformed' }))

process.env.DATABASE_URL = ''
process.env.NODE_ENV = 'test'
const db = require('../src/lib/db.ts')
const metadata = require('../src/lib/sourceMetadata.ts')
let queries = 0, searches = 0, outcome = 'success'
metadata.enrichRecords = async rows => rows
db.query = async (sql, params) => {
  queries++
  assert(sql.includes('COALESCE(duplicate_of, id)'))
  assert.equal(params.length, 1)
  const id = params[0]
  return { rows: id === 404 ? [] : [{ ...storm.properties, id, event_date: id === 422 ? null : '2011-05-24', geom: JSON.stringify(storm.geometry) }] }
}
global.fetch = async (url, options) => {
  searches++
  assert.equal(url, 'https://api.parallel.ai/v1/search')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['x-api-key'], 'test-secret')
  assert.equal(options.cache, 'no-store')
  assert.equal(JSON.parse(options.body).advanced_settings.max_results, 5)
  if (outcome === 'failure') return new Response('private provider response test-secret', { status: 429 })
  if (outcome === 'malformed') return Response.json({ error: 'private details' })
  if (outcome === 'empty') return Response.json({ results: [] })
  return Response.json(provider)
}
const route = require('../app/api/storm-sources/route.ts')
const request = id => route.GET(new Request(`http://localhost/api/storm-sources?id=${id}`))
const realNow = Date.now
let now = realNow()
Date.now = () => now

;(async () => {
  delete process.env.PARALLEL_API_KEY
  for (const id of ['', '0', '-1', '1.1', 'NaN', '2147483648', '1%20OR%201=1']) assert.equal((await request(id)).status, 400)
  assert.equal((await request(1)).status, 503)
  assert.equal(searches, 0)
  process.env.PARALLEL_API_KEY = 'test-secret'
  const results = await Promise.all([request(1), request(1)])
  assert(results.every(response => response.status === 200))
  assert.equal(searches, 1)
  assert.equal(queries, 1)
  const data = await results[0].json()
  assert.deepEqual(data.sources, parsed)
  assert.equal(data.expiresAt, now + 24 * 60 * 60 * 1000)
  assert.equal(results[0].headers.get('Cache-Control'), 'no-store')
  await request(1)
  assert.equal(searches, 1)
  now += 24 * 60 * 60 * 1000 + 1
  await request(1)
  assert.equal(searches, 2)
  assert.equal((await request(404)).status, 404)
  assert.equal((await request(422)).status, 422)
  assert.equal(searches, 2)
  outcome = 'failure'
  const failure = await request(2)
  assert.equal(failure.status, 429)
  assert(!JSON.stringify(await failure.json()).includes('test-secret'))
  outcome = 'success'
  assert.equal((await request(2)).status, 200)
  assert.equal(searches, 4)
  outcome = 'malformed'
  assert.equal((await request(3)).status, 503)
  outcome = 'empty'
  const empty = await (await request(3)).json()
  assert.deepEqual(empty.sources, [])
  assert.equal(empty.expiresAt, now + 15 * 60 * 1000)
  const before = searches
  await request(3)
  assert.equal(searches, before)
  now += 15 * 60 * 1000 + 1
  outcome = 'success'
  assert.equal((await (await request(3)).json()).sources.length, 2)
  assert.equal(searches, before + 1)
  console.log('PASS: storm search identity/schema, genuine excerpts, URL filtering, validation, pending deduplication, cache TTLs, and retryable safe errors.')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { Date.now = realNow })
