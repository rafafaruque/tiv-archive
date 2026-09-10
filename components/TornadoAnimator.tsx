"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { DateRange, TornadoFeature, dateLabel, efColors, efLabel, eventDate, lengthLabel, fatalityLabel, stormSummary } from '../src/lib/tornadoDisplay'

type Props = { visible: TornadoFeature[], ef: number[], onEfChange: (ef:number[])=>void, features: TornadoFeature[], dateRange: DateRange | null, initialViewState: any, selectedId: number | null, onSelect: (id: number | null) => void, searchArea: { lat: number, lon: number, radiusKm: number } | null, historyYear: number | null, onHistoryYear: (year: number | null) => void }
const collection = (features: any[]) => ({ type: 'FeatureCollection' as const, features })

export default function TornadoAnimator({ features, visible, ef, onEfChange, dateRange, initialViewState, selectedId, onSelect, searchArea, historyYear, onHistoryYear }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const replayMarker = useRef<maplibregl.Marker | null>(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const [ready, setReady] = useState(false)
  const [mapError, setMapError] = useState('')
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const [pathPlaying, setPathPlaying] = useState(false)
  const [historyPlaying, setHistoryPlaying] = useState(false)
  const years = useMemo(() => features.flatMap(f => { const date = eventDate(f.properties); return date ? [Number(date.slice(0, 4))] : [] }), [features])
  const minYear = dateRange?.min_date ? Number(dateRange.min_date.slice(0, 4)) : years.length ? Math.min(...years) : 0
  const maxYear = dateRange?.max_date ? Number(dateRange.max_date.slice(0, 4)) : years.length ? Math.max(...years) : 0
  const year = Math.max(minYear, Math.min(maxYear, historyYear ?? maxYear))
  const yearFraction = maxYear > minYear ? (year - minYear) / (maxYear - minYear) : 0
  const selected = visible.find(f => f.properties.id === selectedId)
  const coords = selected?.geometry.coordinates as number[][] | undefined
  const unknownDates = features.length - years.length
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const popupRef = useRef<maplibregl.Popup | null>(null)

  useEffect(() => {
    if (!container.current) return
    let map: maplibregl.Map
    try { map = new maplibregl.Map({ container: container.current, style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' } }, layers: [{ id: 'basemap', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.5, 'raster-contrast': -0.06, 'raster-opacity': 1 } }] }, center: [initialViewState.longitude, initialViewState.latitude], zoom: initialViewState.zoom }) } catch { setMapError('The map could not initialize. Try enabling browser graphics acceleration; results are still available.'); return }
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
    map.on('error', () => setMapError('Some map tiles could not load. Search results remain available.'))
    const popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,className:'tornado-preview',offset:12})
    popupRef.current=popup
    const preview=(p:any,point:number[])=>{
      const content=document.createElement('div')
      content.textContent=[p.displayName || efLabel(p),eventDate(p)?dateLabel(p):null,p.path_length_km!=null?`${lengthLabel(p)} path`:null,p.fatalities!=null?fatalityLabel(p):null].filter(Boolean).join('\n')
      popup.setLngLat([point[0],point[1]]).setDOMContent(content).addTo(map)
    }
    let keyboardIndex=-1
    const keyboard=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){popup.remove();keyboardIndex=-1;return}
      const records=visibleRef.current
      if(!records.length)return
      if(e.key===']'||e.key==='['){e.preventDefault();keyboardIndex=(keyboardIndex+(e.key===']'?1:-1)+records.length)%records.length;const f=records[keyboardIndex];preview(f.properties,f.geometry.coordinates[0])}
      if(e.key==='Enter'&&keyboardIndex>=0){e.preventDefault();const f=records[keyboardIndex];if(f)selectRef.current(f.properties.id)}
    }
    map.getCanvas().setAttribute('aria-label','Tornado map. Use bracket keys to preview events and Enter to select; arrow keys pan.')
    map.getCanvas().addEventListener('keydown',keyboard)
    map.getCanvas().addEventListener('blur',()=>popup.remove())
    map.on('movestart',()=>popup.remove())
    map.on('load', () => {
      for (const id of ['radius', 'starts', 'selected-path', 'selected-start']) map.addSource(id, { type: 'geojson', data: collection([]) })
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#318cb9', 'fill-opacity': 0.055 } })
      map.addLayer({ id: 'radius-outline', type: 'line', source: 'radius', paint: { 'line-color': '#377c9c', 'line-width': 1.3, 'line-opacity': 0.55, 'line-dasharray': [3, 3] } })
      map.addLayer({ id: 'path-halo', type: 'line', source: 'selected-path', paint: { 'line-color': '#ffffff', 'line-width': 6 } })
      map.addLayer({ id: 'path', type: 'line', source: 'selected-path', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 3 } })
      map.addLayer({ id: 'starts', type: 'circle', source: 'starts', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-opacity': 0.95 } })
      map.addLayer({ id: 'selected-ring', type: 'circle', source: 'selected-start', paint: { 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-opacity': 0.4, 'circle-stroke-color': '#29384d', 'circle-stroke-width': 2 } })
      map.on('click', 'starts', e => { const id = e.features?.[0]?.properties?.id; if (id != null) selectRef.current(Number(id)) })
      map.on('mouseenter', 'starts', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'starts', () => { map.getCanvas().style.cursor = ''; popup.remove() })
      map.on('mousemove', 'starts', e => { const f=e.features?.[0]; if(f) preview(f.properties, (f.geometry as any).coordinates) })
      setReady(true)
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    return () => { observer.disconnect(); popup.remove(); popupRef.current=null; map.getCanvas().removeEventListener('keydown',keyboard); replayMarker.current?.remove(); replayMarker.current = null; map.remove(); mapRef.current = null }
  }, [])
  useEffect(() => { mapRef.current?.easeTo({ center: [initialViewState.longitude, initialViewState.latitude], zoom: initialViewState.zoom, duration: 650 }) }, [initialViewState])
  useEffect(() => {
    if (!ready) return
    const set = (id: string, features: any[]) => (mapRef.current?.getSource(id) as maplibregl.GeoJSONSource)?.setData(collection(features))
    set('starts', visible.map(f => ({ ...f, geometry: { type: 'Point', coordinates: f.geometry.coordinates[0] } })))
    set('selected-path', selected ? [selected] : [])
    set('selected-start',selected?[{...selected,geometry:{type:'Point',coordinates:selected.geometry.coordinates[0]}}]:[])
    popupRef.current?.remove()
    if (searchArea) {
      const { lat, lon, radiusKm } = searchArea
      const rad = Math.PI / 180, angular = radiusKm / 6371
      const ring = Array.from({ length: 97 }, (_, i) => {
        const bearing = i / 96 * 2 * Math.PI
        const latitude = Math.asin(Math.sin(lat * rad) * Math.cos(angular) + Math.cos(lat * rad) * Math.sin(angular) * Math.cos(bearing))
        const longitude = lon * rad + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat * rad), Math.cos(angular) - Math.sin(lat * rad) * Math.sin(latitude))
        return [longitude / rad, latitude / rad]
      })
      set('radius', [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }])
    } else set('radius', [])
  }, [ready, visible, selected, searchArea])
  useEffect(() => {
    progressRef.current = 0
    setProgress(0); setPathPlaying(Boolean(coords?.length))
    if (coords?.length) setHistoryPlaying(false)
    if (!coords?.length || !mapRef.current) return
    const bounds = new maplibregl.LngLatBounds()
    coords.forEach(point => bounds.extend([point[0], point[1]]))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapRef.current.fitBounds(bounds, { padding: 65, maxZoom: 10, duration: reducedMotion ? 0 : 650 })
  }, [selectedId, coords])
  useEffect(() => {
    if (!pathPlaying || !coords) return
    let frame: number
    let start: number | null = null
    const offset = progressRef.current
    const tick = (now: number) => {
      if (start == null) start = now
      const next = Math.min(1, offset + (now - start) / 8000)
      progressRef.current = next
      setProgress(next)
      if (next < 1) frame = requestAnimationFrame(tick)
      else setPathPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [pathPlaying, coords])
  useEffect(() => {
    if (!ready) return
    if (!coords?.length || !mapRef.current) {
      replayMarker.current?.remove()
      replayMarker.current = null
      return
    }
    const at = progress * (coords.length - 1)
    const i = Math.min(Math.floor(at), coords.length - 1)
    const next = coords[Math.min(i + 1, coords.length - 1)]
    const point = coords[i].map((v, axis) => v + (next[axis] - v) * (at - i))
    if (!replayMarker.current) {
      const icon = document.createElement('img')
      icon.src = '/images/croptornado.png'
      icon.alt = ''
      icon.setAttribute('aria-hidden', 'true')
      icon.draggable = false
      icon.className = 'path-tornado-marker'
      replayMarker.current = new maplibregl.Marker({ element: icon, anchor: 'bottom', offset: [0, 2] })
        .setLngLat([point[0], point[1]]).addTo(mapRef.current)
    } else replayMarker.current.setLngLat([point[0], point[1]])
  }, [coords, progress, ready])
  useEffect(() => {
    if (!historyPlaying) return
    const timer = setTimeout(() => { if (year >= maxYear) setHistoryPlaying(false); else onHistoryYear(year + 1) }, 650)
    return () => clearTimeout(timer)
  }, [historyPlaying, year, maxYear, onHistoryYear])
  useEffect(() => { setHistoryPlaying(false) }, [minYear, maxYear, features])
  function fitResults() {
    if(!mapRef.current || !visible.length)return
    const bounds=new maplibregl.LngLatBounds()
    visible.forEach(f=>f.geometry.coordinates.forEach(c=>{if(c[0]!==0||c[1]!==0)bounds.extend([c[0],c[1]])}))
    if(!bounds.isEmpty())mapRef.current.fitBounds(bounds,{padding:{top:55,bottom:180,left:45,right:45},maxZoom:11,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500})
  }
  const p = selected?.properties
  return <>
    <div ref={container} className="map-canvas" />
    <div className="map-caption">U.S. TORNADO ARCHIVE<span>Explore the paths of the past</span></div>
    {mapError && <div className="map-error" role="status">{mapError}</div>}
    <button className="fit-results" disabled={!visible.length || !ready} onClick={fitResults} aria-label="Fit map to visible results">⌖ Fit results</button>
    <div className="ef-legend panel" aria-label="Filter by EF rating"><strong>EF rating</strong><div>{[0,1,2,3,4,5,-1].map(i=><button key={i} aria-pressed={ef.includes(i)} onClick={()=>onEfChange(ef.includes(i)?ef.filter(n=>n!==i):[...ef,i])}><i style={{background:efColors[i]||'#687784'}} /><span>{i===-1?'Unknown':`EF${i}`}</span><b aria-hidden="true">{ef.includes(i)?'✓':'−'}</b></button>)}</div><button className="legend-reset" onClick={()=>onEfChange([-1,0,1,2,3,4,5])}>Show all</button></div>
    {p && <section className="detail-panel panel" aria-label="Selected tornado details"><button className="close-detail" aria-label="Close tornado details" onClick={() => onSelect(null)}>×</button><p className="eyebrow"><img className="selected-art" src="/images/croptornado.png" alt="" width={28} height={28} />SELECTED TORNADO</p><h2 className={eventDate(p) ? "detail-date-heading" : undefined}>{eventDate(p) ? <time dateTime={eventDate(p)!}>{dateLabel(p, 'long')}</time> : p.displayName}</h2>{eventDate(p) ? <p className="detail-event-name">{p.displayName}</p> : <p className="muted detail-date">Date unavailable</p>}<p className="storm-summary">{stormSummary(p)}</p><span className="ef-badge" style={{ borderColor: p.color }}>{efLabel(p)}</span><dl><div><dt>Path length</dt><dd>{lengthLabel(p)}</dd></div><div><dt>Fatalities</dt><dd>{p.fatalities ?? 'Unknown'}</dd></div>{p.injuries != null && <div><dt>Injuries</dt><dd>{p.injuries}</dd></div>}</dl><button className="primary replay-button" onClick={() => { if (pathPlaying) setPathPlaying(false); else { if (progress >= 1) { progressRef.current = 0; setProgress(0) }; setPathPlaying(true) } }}>{pathPlaying ? 'Ⅱ Pause path' : progress > 0 && progress < 1 ? '▶ Resume path' : '▶ Replay path'}</button><div className="path-progress" role="progressbar" aria-label="Path replay progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress * 100}%` }} /></div><p className="record-id">Database ID: {p.id}{p.event_id ? ` · NOAA/SPC ID: ${p.event_id}` : ''}</p></section>}
    <section className="timeline panel" aria-label="Tornado history timeline">
      <button className="timeline-play" disabled={!years.length || minYear === maxYear} aria-label={historyPlaying ? 'Pause tornado history' : 'Play tornado history'} onClick={() => { setPathPlaying(false); if (year >= maxYear) onHistoryYear(minYear); setHistoryPlaying(v => !v) }}>{historyPlaying ? 'Ⅱ' : '▶'}</button>
      <div className="timeline-body">
        <div className="timeline-heading"><strong>Tornado history</strong><span aria-live="off">{maxYear ? `${historyYear==null?'All years':`Through ${year}`} · ${visible.length} records` : 'Search a location to explore history'}</span></div>
        <div className="history-track">
          <div className="density" aria-hidden="true">{Array.from({ length: 60 }, (_, i) => { const count = years.filter(y => Math.min(59, Math.floor((y - minYear) / Math.max(1, maxYear - minYear) * 59)) === i).length; return <i key={i} style={{ height: count ? `${Math.min(14, 3 + count * 2)}px` : '1px' }} /> })}</div>
          <div className="history-slider-wrap">
            <input aria-label="Show tornadoes through year" aria-valuetext={`${year}, ${visible.length} records shown, cumulative history`} type="range" min={minYear} max={maxYear || 1} step={1} value={year} disabled={!years.length || minYear === maxYear} onChange={e => { setHistoryPlaying(false); setPathPlaying(false); onHistoryYear(Number(e.target.value)) }} />
            {maxYear > 0 && <span className="tornado-indicator" aria-hidden="true" style={{ left: `calc(8px + (100% - 16px) * ${yearFraction})` }}><img src="/images/croptornado.png" alt="" draggable={false} width={40} height={40} /></span>}
          </div>
        </div>
        <div className="range-labels"><span>{minYear || '—'}</span><span>{features.length ? `Loaded results${unknownDates ? ` · ${unknownDates} undated included` : ''}` : 'Search a location to load tornado records'}</span><span>{maxYear || '—'}</span></div>
      </div>
      {years.length > 0 && <button className="all-years" onClick={() => { setHistoryPlaying(false); onHistoryYear(null) }}>All years</button>}
    </section>
  </>
}
