import { readFile } from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse/sync'
// Source metadata is indexed once per server process. No reverse geocoding.
let index: Promise<Map<string, any[]>> | undefined
function key(coords: number[][], magnitude: unknown) { return JSON.stringify([coords[0], coords[coords.length - 1], String(magnitude)]) }
async function sourceIndex() {
  if (!index) index = readFile(process.env.SPC_CSV_PATH || path.join(process.cwd(), 'data/spc_tornadoes.csv'), 'utf8').then(csv => {
    const map = new Map<string, any[]>()
    for (const r of parse(csv, { columns: true, skip_empty_lines: true })) {
      const k = key([[+r.slon, +r.slat], [+r.elon, +r.elat]], r.mag)
      map.set(k, [...(map.get(k) || []), r])
    }
    return map
  }).catch(() => new Map())
  return index
}
export async function enrichRecords(rows: any[]) {
  const source = await sourceIndex()
  return rows.map(row => {
    let geom = row.geom
    try { if (typeof geom === 'string') geom = JSON.parse(geom) } catch { geom = null }
    const coords = geom?.coordinates || [[row.start_lon, row.start_lat], [row.end_lon, row.end_lat]]
    const matches = (source.get(key(coords, row.ef_rating)) || []).filter(r =>
      (!row.event_date || r.date === row.event_date) && (!row.event_id || r.om === row.event_id) &&
      +r.len === row.path_length_km && +r.wid === row.path_width_m &&
      +r.fat === (row.fatalities ?? 0) && +r.inj === (row.injuries ?? 0))
    const states = new Set(matches.map(r => r.st))
    return { ...row, state: states.size === 1 ? matches[0].st : null,
      // Legacy imports stored SPC miles in the km column. Only convert verified matches.
      path_length_km: matches.length ? +matches[0].len * 1.609344 : null,
      length_verified: matches.length > 0 }
  })
}
