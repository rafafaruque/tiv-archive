const assert = require('node:assert/strict')
const fs = require('fs'), ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename)
const { cleanStormExcerpt, classifyStormSource, parseStormSources, stormSearchRequest } = require('../src/lib/stormSources.ts')
const storm = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-97.9, 35.5], [-97.8, 35.6]] },
  properties: { id: 1, event_date: '2011-05-24', state: 'OK', city: 'El Reno', county: 'Canadian', ef_rating: '5' } }
const exact = 'On May 24, 2011, an EF5 tornado struck El Reno, Oklahoma, damaging homes along its path.'
const impact = 'The tornado destroyed several homes and businesses.'
const raw = `Section Title: Home > Weather > Storm Reports
Content:
[Home](https://example.com) | [Weather](https://example.com/weather) | [Menu](https://example.com/menu)
## Storm report
**On May 24, 2011**, an EF5 tornado struck [El Reno](https://example.com/city), Oklahoma, damaging homes along its path.
| Date | Location | Rating |
| --- | --- | --- |
| May 24, 2011 | El Reno | EF5 |
${impact}
${impact}
Follow us on Facebook.
Privacy policy
Copyright 2026` // Fixtures are synthetic; no claim that they describe a real track.
assert.equal(cleanStormExcerpt([raw], storm), `${exact} ${impact}`)
assert.equal(cleanStormExcerpt(['<p>The tornado damaged homes &amp; businesses near the river.</p>']), 'The tornado damaged homes & businesses near the river.')
assert.equal(cleanStormExcerpt(['<script>The tornado destroyed many houses.</script>\n<style>body{}</style>\n```json\n{"tornado":"damage report"}\n```']), '')
assert.equal(cleanStormExcerpt(['Home | Weather | Storm Reports\nFollow us on Facebook.\nCookie policy\nNavigation']), '')
assert.equal(cleanStormExcerpt(['A new school library opened downtown.']), '')
assert.equal(cleanStormExcerpt(['Storm Prediction Center Tornado Safety And Weather Products']), '')
assert.equal(cleanStormExcerpt(['No injuries were reported.']), 'No injuries were reported.')
assert.equal(cleanStormExcerpt([null, 12, {}, '']), '')
assert.equal(cleanStormExcerpt(null), '')
assert.equal(cleanStormExcerpt([impact, impact.toUpperCase()]), impact)
assert.equal(cleanStormExcerpt([`${exact}\nUnrelated background text.\n${impact}`], storm), `${exact} … ${impact}`)
const long = `The tornado damaged ${'homes and businesses across the county '.repeat(30)}during the evening.`
assert(cleanStormExcerpt([long]).length <= 420)
assert(cleanStormExcerpt([long]).endsWith('…'))
assert.equal(cleanStormExcerpt(['The tornado damaged buildings &#38; homes near the river.']), 'The tornado damaged buildings & homes near the river.')
assert.equal(cleanStormExcerpt(['The tornado destroyed ~~three~~ five homes near the river.']), 'The tornado destroyed five homes near the river.')
assert.equal(cleanStormExcerpt(['The tornado had winds of ~100 mph and damaged < 5 homes with gusts > 90 mph.']), 'The tornado had winds of ~100 mph and damaged < 5 homes with gusts > 90 mph.')

const classify = (text, selected = storm, title = 'Storm damage survey') => classifyStormSource(title, [text], selected)
assert.equal(classify(exact), 'likely-event')
for (const date of ['2011-05-24', '05/24/2011', 'May 24th, 2011', '24 May 2011', 'may 24, 2011', 'May 24 2011']) {
  assert.equal(classify(`On ${date}, a tornado struck El Reno, Oklahoma, and damaged homes.`), 'likely-event', date)
}
assert.equal(classify('On May 24, 2011, a tornado struck El Reno, OK, and damaged homes.'), 'likely-event')
assert.equal(classify(exact, storm, 'The May 24, 2011 Tornado Outbreak in Oklahoma'), 'broader-outbreak')
assert.equal(classify(exact, storm, 'The May 31, 2013 El Reno tornado'), 'broader-outbreak')
assert.equal(classify(exact, storm, 'The El Reno EF3 tornado'), 'broader-outbreak')
assert.equal(classify(exact.replace('El Reno', 'Canton')), 'broader-outbreak')
assert.equal(classify(exact.replace('El Reno', 'El Renowned')), 'broader-outbreak')
assert.equal(classify(exact.replace('Oklahoma', 'Kansas')), 'broader-outbreak')
assert.equal(classify(exact.replace('2011', '2013')), 'broader-outbreak')
assert.equal(classify(exact.replace('May 24, 2011', '2011')), 'broader-outbreak')
assert.equal(classify(exact.replace('EF5', 'EF3')), 'broader-outbreak')
assert.equal(classify('On May 24, 2011, tornadoes hit El Reno, Oklahoma, and Canton.'), 'broader-outbreak')
assert.equal(classify('Unlike May 24, 2011, the May 31, 2013 tornado struck El Reno, Oklahoma.'), 'broader-outbreak')
assert.equal(classify('On May 24, 2011, a tornado hit Oklahoma. El Reno reported damage from a tornado.'), 'broader-outbreak')
const countyOnly = { ...storm, properties: { ...storm.properties, city: null } }
assert.equal(classify('On May 24, 2011, an EF5 tornado crossed Canadian County, Oklahoma.', countyOnly), 'likely-event')
assert.equal(classify('On May 24, 2011, a tornado crossed Canadian County, Oklahoma.', countyOnly), 'broader-outbreak')
assert.equal(classify(exact, { ...storm, properties: { id: 1, event_date: '2011-05-24', state: 'OK' } }), 'broader-outbreak')
assert.equal(classify(exact, { ...storm, properties: { ...storm.properties, state: null } }), 'broader-outbreak')
assert.equal(classify(exact, { ...storm, properties: { ...storm.properties, event_date: null } }), 'broader-outbreak')
assert.equal(classifyStormSource('El Reno, Oklahoma tornado, May 24, 2011', [], storm), 'likely-event')
assert.equal(classifyStormSource('Storm survey', [exact]), 'broader-outbreak')

const result = (title, excerpts, url = `https://example.com/${encodeURIComponent(title)}`) => ({ title, excerpts, url })
const sources = parseStormSources({ results: [null, [], 7, {}, { title: 'Invalid URL', url: 'javascript:alert(1)' },
  result('Outbreak report', ['On May 24, 2011, tornadoes caused widespread damage across Oklahoma.']),
  result('Specific survey', [exact]), result('Title only', ['Home | Search | Weather']),
  result('Malformed excerpts', [null, {}, 3]), result('No excerpts', null),
] }, storm)
assert.equal(sources.length, 5, 'retain valid broad and title-only historical sources')
assert.equal(sources[0].title, 'Specific survey', 'likely matches sort first')
assert.equal(sources[0].relevance, 'likely-event')
assert.equal(sources[2].excerpt, '')
assert.equal(sources[3].excerpt, '')
assert.equal(sources[4].excerpt, '')
assert.equal(parseStormSources({ results: [{ ...result('Retrospective', [exact.replace('2011', '2013')]), publish_date: '2011-05-24' }] }, storm)[0].relevance, 'broader-outbreak', 'publication date never establishes event identity')
assert.throws(() => parseStormSources({ results: {} }))
assert.throws(() => parseStormSources(null))
assert.deepEqual(parseStormSources({ results: [] }, storm), [])

const incomplete = stormSearchRequest({ ...storm, properties: { id: 1, event_date: '2011-05-24' } })
assert(incomplete.objective.includes('state unavailable'))
assert(!incomplete.objective.includes('El Reno'))
assert(incomplete.objective.includes('do not infer missing city or county'))
assert(stormSearchRequest(countyOnly).search_queries[0].includes('Canadian County'))
assert(!stormSearchRequest({ ...countyOnly, properties: { ...countyOnly.properties, county: 'Canadian County' } }).objective.includes('County County'))
console.log('PASS: excerpt cleanup/selection, conservative event relevance, missing metadata, malformed results, and stable source ordering.')
