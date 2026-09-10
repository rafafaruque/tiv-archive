import { eventDate, rating, TornadoFeature } from './tornadoDisplay'
export const allRatings = [-1, 0, 1, 2, 3, 4, 5]
export const sortModes = ['nearest', 'strongest', 'longest', 'recent', 'deadliest'] as const
export type SortMode = typeof sortModes[number]
export type SharedState = { place: string, lat: number | null, lon: number | null, radius: number, year: number | null, ef: number[], sort: SortMode, tornado: number | null, from: string, to: string }
export function parseState(query: string): SharedState {
  const q = new URLSearchParams(query)
  const number = (key: string, min: number, max: number) => { const value=q.get(key); const n=Number(value); return value !== null && value.trim() !== '' && Number.isFinite(n) && n>=min && n<=max ? n : null }
  const year=number('year',1800,2100), tornado=number('tornado',1,2147483647)
  let from=q.get('from') || '', to=q.get('to') || ''
  if (!/^\d{4}$/.test(from) || +from<1800 || +from>2100) from=''
  if (!/^\d{4}$/.test(to) || +to<1800 || +to>2100) to=''
  if(from && to && +from>+to) [from,to]=[to,from]
  let ef=q.has('ef') ? [...new Set((q.get('ef') || '').split(',').filter(s=>/^-?\d$/.test(s)).map(Number).filter(n=>allRatings.includes(n)))] : [...allRatings]
  if(q.get('ef') && !ef.length) ef=[...allRatings]
  return { place:(q.get('place') || '').slice(0,160),lat:number('lat',-90,90),lon:number('lon',-180,180),radius:number('radius',1,500) ?? 50,year:year==null?null:Math.trunc(year),ef,sort:sortModes.includes(q.get('sort') as SortMode)?q.get('sort') as SortMode:'nearest',tornado:tornado!=null&&Number.isInteger(tornado)?tornado:null,from,to }
}
export function stateQuery(s: SharedState) {
  const q=new URLSearchParams()
  if(s.place) q.set('place',s.place)
  if(s.lat!=null && s.lon!=null) {q.set('lat',String(s.lat));q.set('lon',String(s.lon))}
  if(s.radius!==50)q.set('radius',String(s.radius))
  if(s.year!=null)q.set('year',String(s.year))
  if(s.ef.length!==7)q.set('ef',s.ef.join(','))
  if(s.sort!=='nearest')q.set('sort',s.sort)
  if(s.tornado!=null)q.set('tornado',String(s.tornado))
  if(s.from)q.set('from',s.from);if(s.to)q.set('to',s.to)
  return q.toString()
}
export function filterEvents(features: TornadoFeature[], ef: number[], from='',to='',year:number|null=null) {
  return features.filter(f=>{const d=eventDate(f.properties);const y=d?Number(d.slice(0,4)):null;return ef.includes(rating(f.properties)) && (y==null || ((!from||y>=+from)&&(!to||y<=+to)&&(year==null||y<=year)))})
}
export function sortEvents(features: TornadoFeature[], mode: SortMode) {
  function value(f:TornadoFeature):number|null {
    const p=f.properties
    if(mode==='recent')return eventDate(p)?Date.parse(eventDate(p)!):null
    if(mode==='strongest')return rating(p)<0?null:rating(p)
    const n=mode==='nearest'?p.distance_km:mode==='longest'?p.path_length_km:p.fatalities
    return n!=null&&Number.isFinite(Number(n))?Number(n):null
  }
  return [...features].sort((a,b)=>{const av=value(a),bv=value(b);if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;return (av!=null&&bv!=null?(av-bv)*(mode==='nearest'?1:-1):0)||a.properties.id-b.properties.id})
}
