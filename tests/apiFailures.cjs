const assert = require('node:assert/strict')
const fs = require('fs'), ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText, filename)
process.env.DATABASE_URL = ''
const db = require('../src/lib/db.ts')
db.query = async () => {throw Object.assign(new Error('private connection details'), {code:'ENETUNREACH'})}
const search = require('../app/api/search/route.ts')
const detail = require('../app/api/tornado/route.ts')
;(async () => {
  process.env.DATABASE_URL = 'configured-for-mock'
  for (const [route,url] of [[search,'http://test/api/search?lat=37&lon=-97'],[detail,'http://test/api/tornado?id=1']]) {
    const r = await route.GET(new Request(url));assert.equal(r.status,503)
    const body = await r.json();assert(body.error.includes('unavailable'));assert(!JSON.stringify(body).includes('private'))
  }
  process.env.DATABASE_URL = ''
  assert.equal((await search.GET(new Request('http://test/api/search?lat=37&lon=-97'))).status,503)
  console.log('PASS: database exceptions and missing configuration return safe JSON errors.')
})().catch(e=>{console.error(e);process.exitCode=1})
