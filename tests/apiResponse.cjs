const assert = require('node:assert/strict')
const fs = require('fs'), ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, filename)
const {readApiResponse} = require('../src/lib/apiResponse.ts')
;(async () => {
  for (const response of [new Response('', {status:500}),new Response('<html>Unavailable</html>',{status:502}),new Response(''),new Response('null')]) {
    await assert.rejects(readApiResponse(response,'Service unavailable'), {message:'Service unavailable'})
  }
  assert.deepEqual(await readApiResponse(Response.json({data:[]}), 'Service unavailable'), {data:[]})
  console.log('5 API response assertions passed: empty/HTML failures, malformed success bodies, valid JSON.')
})().catch(error => {console.error(error);process.exitCode=1})
