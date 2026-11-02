const assert = require('node:assert/strict')
const fs = require('fs'), ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename)

process.env.DATABASE_URL = ''
process.env.NODE_ENV = 'development'
const db = require('../src/lib/db.ts')
const metadata = require('../src/lib/sourceMetadata.ts')
const { useHostedTornadoData, proxyHostedTornadoData } = require('../src/lib/hostedTornadoData.ts')
const search = require('../app/api/search/route.ts')
const detail = require('../app/api/tornado/route.ts')
const stormSources = require('../app/api/storm-sources/route.ts')
const dateRange = { min_date: '1950-01-03', max_date: '2025-12-28' }
const record = { id: 8407, event_date: '1965-05-13', state: 'KS', ef_rating: '3', path_length_km: 100.584,
  length_verified: true, geom: JSON.stringify({ type: 'LineString', coordinates: [[-97.3, 37.13], [-97.53, 38.02]] }) }
let mode = 'success', fetches = [], queries = [], enrichments = 0
metadata.enrichRecords = async rows => { enrichments++; return rows }
db.query = async (sql, params) => {
  queries.push({ sql, params })
  if (mode === 'database-error') throw new Error('private database connection details')
  return { rowCount: 1, rows: sql.includes('min(event_date)') ? [dateRange] : [record] }
}
global.fetch = async (url, options) => {
  fetches.push({ url: String(url), options })
  if (String(url) === 'https://api.parallel.ai/v1/search') {
    assert.equal(options.headers['x-api-key'], 'local-parallel-secret')
    return Response.json({ results: [] })
  }
  assert.equal(new URL(url).origin, 'https://tiv-archive-iszt.vercel.app')
  assert.equal(options.method, 'GET')
  assert.equal(options.redirect, 'error')
  assert.equal(options.credentials, 'omit')
  assert.equal(options.cache, 'no-store')
  assert.deepEqual(options.headers, { Accept: 'application/json' })
  assert(!options.body)
  assert(options.signal instanceof AbortSignal)
  if (mode === 'network-error') throw new Error('private upstream connection details')
  if (mode === 'timeout') throw Object.assign(new Error('private timeout'), { name: 'TimeoutError' })
  if (mode === 'failure') return Response.json({ error: 'private provider details' }, { status: 503 })
  if (mode === 'not-found') return Response.json({ error: 'private provider details' }, { status: 404 })
  if (mode === 'redirect') return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example' } })
  if (mode === 'html') return new Response('<html>private login page</html>')
  if (mode === 'malformed') return Response.json({ data: 'invalid', tornado: 'invalid', dateRange: {} })
  if (mode === 'bad-record') return Response.json({ data: [{}], tornado: {}, dateRange })
  const target = new URL(url)
  return Response.json(target.pathname === '/api/tornado' ? { tornado: record }
    : target.searchParams.has('datesOnly') ? { dateRange } : { data: [record], dateRange })
}
const get = (route, path) => route.GET(new Request(`http://localhost${path}`, {
  headers: { Authorization: 'Bearer browser-secret', Cookie: 'session=private', 'x-api-key': 'browser-secret' },
}))

;(async () => {
  assert(useHostedTornadoData())
  let response = await get(search, '/api/search?lat=37.6872&lon=-97.3301')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { data: [record], dateRange })
  assert.equal(fetches[0].url, 'https://tiv-archive-iszt.vercel.app/api/search?lat=37.6872&lon=-97.3301&radiusKm=50')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await (await get(search, '/api/search?datesOnly=true')).json(), { dateRange })
  assert.deepEqual(await (await get(detail, '/api/tornado?id=8407')).json(), { tornado: record })
  assert.equal(queries.length, 0)
  assert.equal(enrichments, 0, 'hosted units and metadata pass through without re-enrichment')

  const before = fetches.length
  for (const path of [
    '/api/search', '/api/search?lat=&lon=0', '/api/search?lat=1', '/api/search?lat=NaN&lon=0',
    '/api/search?lat=91&lon=0', '/api/search?lat=0&lon=-181', '/api/search?lat=0&lon=0&radiusKm=501',
    '/api/search?lat=0&lon=0&radiusKm=0', '/api/search?lat=0&lon=0&radiusKm=',
    '/api/search?lat=0&lat=1&lon=0', '/api/search?datesOnly=yes', '/api/search?datesOnly=true&lat=0',
    '/api/search?datesOnly=true&url=https://untrusted.example', '/api/search?datesOnly=true&datesOnly=true',
    '/api/tornado', '/api/tornado?id=0', '/api/tornado?id=1.2', '/api/tornado?id=2147483648',
    '/api/tornado?id=1&id=2', '/api/tornado?id=1&url=https://untrusted.example', '/api/tornado?id=1%20OR%201=1',
  ]) assert.equal((await get(path.startsWith('/api/search') ? search : detail, path)).status, 400, path)
  assert.equal(fetches.length, before, 'invalid queries never reach the upstream')
  assert.equal((await proxyHostedTornadoData('nl-search', new URLSearchParams())).status, 400)
  assert.equal(fetches.length, before, 'only the two fixed data endpoints are allowed')
  for (const failure of ['network-error', 'failure', 'redirect', 'html', 'malformed', 'bad-record', 'timeout']) {
    mode = failure
    for (const [route, path] of [[search, '/api/search?lat=0&lon=0'], [detail, '/api/tornado?id=8407']]) {
      response = await get(route, path)
      assert.equal(response.status, failure === 'timeout' ? 504 : 502)
      const body = await response.json()
      assert(body.error.includes('hosted tornado data service'))
      assert(!JSON.stringify(body).includes('private'))
    }
  }
  mode = 'not-found'
  assert.equal((await get(detail, '/api/tornado?id=8407')).status, 404)

  mode = 'success'
  const noProxy = fetches.length
  for (const environment of ['production', 'test']) {
    process.env.NODE_ENV = environment
    assert(!useHostedTornadoData())
    assert.equal((await get(search, '/api/search?datesOnly=true')).status, 503)
    assert.equal((await proxyHostedTornadoData('search', new URLSearchParams({ datesOnly: 'true' }))).status, 503)
  }
  assert.equal(fetches.length, noProxy, 'missing production configuration cannot create a proxy loop')
  process.env.NODE_ENV = 'development'
  process.env.DATABASE_URL = 'configured-for-mock'
  assert(!useHostedTornadoData())
  assert.equal((await get(search, '/api/search?lat=37&lon=-97&radiusKm=50')).status, 200)
  assert.deepEqual(queries[0].params, [-97, 37, 50000])
  assert.equal((await get(search, '/api/search?datesOnly=true')).status, 200)
  assert.equal((await get(detail, '/api/tornado?id=8407')).status, 200)
  assert.equal(enrichments, 2)
  mode = 'database-error'
  assert.equal((await get(search, '/api/search?lat=37&lon=-97')).status, 503)
  assert.equal(fetches.length, noProxy, 'configured but failing database never silently switches to hosted data')

  mode = 'success'
  process.env.DATABASE_URL = ''
  delete process.env.PARALLEL_API_KEY
  assert.equal((await get(stormSources, '/api/storm-sources?id=8407')).status, 503)
  assert.equal(fetches.length, noProxy, 'optional research makes no requests without its own key')
  process.env.PARALLEL_API_KEY = 'local-parallel-secret'
  response = await get(stormSources, '/api/storm-sources?id=8407')
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).sources, [])
  assert.equal(fetches.length, noProxy + 2)
  assert.equal(new URL(fetches[noProxy].url).pathname, '/api/tornado')
  assert.equal(fetches[noProxy + 1].url, 'https://api.parallel.ai/v1/search')
  assert(!fetches.some(call => call.url.startsWith('https://tiv-archive-iszt.vercel.app/api/storm-sources')))
  console.log('PASS: hosted search/date/detail reads, strict query validation, header isolation, safe failures, production-loop prevention, database precedence, and separate optional Parallel search.')
})().catch(error => { console.error(error); process.exitCode = 1 })
