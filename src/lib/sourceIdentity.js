const { createHash } = require('crypto')
// A source row, not an EF/state/date label: preserve separate track segments and reports.
const fields = 'om yr mo dy date time tz st stf stn mag inj fat loss closs slat slon elat elon len wid ns sn sg f1 f2 f3 f4 fc edat etime'.split(' ')
function sourceKey(row) {
  if (!row.om || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')) return null
  return 'spc:' + createHash('sha256').update(JSON.stringify(fields.map(k => String(row[k] ?? '').trim()))).digest('hex')
}
function matchKey(row) {
  const values = ['start_lon','start_lat','end_lon','end_lat','path_length_km','path_width_m']
  if (values.some(k => row[k] == null || !Number.isFinite(Number(row[k])))) return null
  return JSON.stringify([...values.map(k => Number(row[k])), String(row.ef_rating), row.fatalities ?? 0, row.injuries ?? 0])
}
function indexSource(rows) {
  const index = new Map()
  for (const row of rows) {
    const key = matchKey({start_lon:+row.slon,start_lat:+row.slat,end_lon:+row.elon,end_lat:+row.elat,path_length_km:+row.len,path_width_m:+row.wid,ef_rating:row.mag,fatalities:+row.fat,injuries:+row.inj})
    index.set(key,[...(index.get(key)||[]),row])
  }
  return index
}
function matchSource(row,index) {
  const matches = (index.get(matchKey(row)) || []).filter(r => (!row.event_id || row.event_id === r.om) && (!row.event_date || row.event_date === r.date))
  const keys = new Set(matches.map(sourceKey))
  return keys.size === 1 && !keys.has(null) ? matches[0] : null
}
module.exports = { sourceKey, indexSource, matchSource }
