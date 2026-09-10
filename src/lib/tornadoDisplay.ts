export type TornadoProperties = {
  id: number
  alias_ids?: number[]
  event_id?: string | null
  event_date?: string | null
  date?: string | null
  ef_rating?: string | number | null
  path_length_km?: number | null
  fatalities?: number | null
  injuries?: number | null
  state?: string | null
  city?: string | null
  county?: string | null
  distance_km?: number | null
  length_verified?: boolean
  displayName?: string
  color?: string
}
export type TornadoFeature = { type: 'Feature', geometry: { type: 'LineString', coordinates: number[][] }, properties: TornadoProperties }
export type DateRange = { min_date: string | null, max_date: string | null }
export const efColors = ['#8b969e', '#c4a52d', '#df951d', '#e56b29', '#d13b38', '#941c3a']
export function rating(p: any) {
  const match = String(p.ef_rating ?? '').match(/^(?:EF|F)?([0-5])$/i)
  return match ? Number(match[1]) : -1
}
export function efLabel(p: any) { const n = rating(p); return n < 0 ? 'EF unknown' : `EF${n}` }
export function efColor(p: any) { return efColors[rating(p)] || '#687784' }
export function eventDate(p: TornadoProperties): string | null {
  // Database identifiers are not dates.
  const raw = p.date || p.event_date
  if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(String(raw))) return null
  const value = String(raw).slice(0, 10)
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}
export function dateLabel(p: any, month: 'short' | 'long' = 'short') {
  const date = eventDate(p)
  return date ? new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month, day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Date unavailable'
}
export function lengthLabel(p: any) { return p.path_length_km == null ? 'Length unknown' : `${Number(p.path_length_km).toFixed(1)} km` }
export function fatalityLabel(p: any) { return p.fatalities == null ? 'Fatalities unknown' : `${p.fatalities} ${Number(p.fatalities) === 1 ? 'fatality' : 'fatalities'}` }
export function toFeatures(rows: any[]) {
  return rows.flatMap(r => {
    let geometry = r.geom
    try { if (typeof geometry === 'string') geometry = JSON.parse(geometry) } catch { geometry = null }
    if (!geometry && [r.start_lon, r.start_lat, r.end_lon, r.end_lat].every(v => v != null && Number.isFinite(Number(v)))) {
      geometry = { type: 'LineString', coordinates: [[Number(r.start_lon), Number(r.start_lat)], [Number(r.end_lon), Number(r.end_lat)]] }
    }
    if (geometry?.type !== 'LineString' || !geometry.coordinates?.length) return []
    const valid=geometry.coordinates.filter((c:any)=>Array.isArray(c)&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90&&(c[0]!==0||c[1]!==0))
    if(!valid.length)return []
    geometry={...geometry,coordinates:valid.length===1?[valid[0],valid[0]]:valid}
    return [{ type: 'Feature' as const, geometry, properties: { ...r, geom: undefined } }]
  })
}
export function nameFeatures(features: TornadoFeature[]) {
  const groups = new Map<string, any[]>()
  for (const f of features) {
    const p=f.properties
    const location=p.city ? normalizePlace(p.city) + (p.state ? `, ${p.state}` : '') : p.county ? `${normalizePlace(p.county)} County${p.state ? `, ${p.state}` : ''}` : p.state ? stateName(p.state) : ''
    const base = p.city ? `${location} ${efLabel(p)}` : location ? `${efLabel(p)} — ${location}` : `${efLabel(p)} Tornado`
    const key = `${base}|${eventDate(f.properties) || 'unknown'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ f, base })
  }
  const names = new Map<any, string>()
  for (const group of groups.values()) {
    group.sort((a, b) => String(a.f.properties.id).localeCompare(String(b.f.properties.id), 'en', { numeric: true }))
    group.forEach(({ f, base }, i) => names.set(f.properties.id, base + (group.length > 1 ? ` ${letterSuffix(i)}` : '')))
  }
  return features.map(f => ({ ...f, properties: { ...f.properties, displayName: names.get(f.properties.id), color: efColor(f.properties) } }))
}

export function normalizePlace(value: string) { return value.trim().replace(/\s+/g,' ').split(',').map((part,i)=>{const s=part.trim();return i>0 && /^[a-z]{2}$/i.test(s) ? s.toUpperCase() : s.replace(/\b\w[\w’'-]*/g,w=>w[0].toUpperCase()+w.slice(1).toLowerCase())}).join(', ') }
export function letterSuffix(index:number):string { let value=index+1,out='';while(value>0){value--;out=String.fromCharCode(65+value%26)+out;value=Math.floor(value/26)}return out }
export function stateName(code:string) {
  const names:Record<string,string>={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'}
  return names[code] || code
}
export function stormSummary(p:TornadoProperties) {
  const date=eventDate(p)
  const when=date ? `On ${new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})}, this` : 'This'
  const strength=rating(p)>=0 ? `${efLabel(p)} tornado` : 'tornado'
  const where=p.state ? ` in ${stateName(p.state)}` : ''
  const path=p.path_length_km!=null ? ` had a recorded path length of ${Number(p.path_length_km).toFixed(1)} km` : ' was recorded'
  return `${when} ${strength}${path}${where}.${p.fatalities!=null ? ` ${p.fatalities} ${p.fatalities===1?'fatality was':'fatalities were'} recorded.` : ''}`
}
