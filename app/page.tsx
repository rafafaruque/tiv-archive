"use client"
import { readApiResponse } from '../src/lib/apiResponse'
import { useEffect, useMemo, useRef, useState } from 'react'
import DataInfo from '../components/DataInfo'
import { allRatings, filterEvents, parseState, sortEvents, SortMode, stateQuery } from '../src/lib/explorerState'
import SearchBar from '../components/SearchBar'
import NLSearch from '../components/NLSearch'
import TornadoAnimator from '../components/TornadoAnimator'
import { DateRange, TornadoFeature, dateLabel, efLabel, eventDate, fatalityLabel, lengthLabel, nameFeatures, normalizePlace, toFeatures } from '../src/lib/tornadoDisplay'

export default function Page() {
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [ef, setEf] = useState([...allRatings])
  const [sort, setSort] = useState<SortMode>('nearest')
  const [restoring, setRestoring] = useState(true)
  const urlMode = useRef<'push'|'replace'>('replace')
  const [status, setStatus] = useState('Search a location to explore its tornado history.')
  const [features, setFeatures] = useState<TornadoFeature[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewState, setViewState] = useState({ longitude: -95.7129, latitude: 37.0902, zoom: 3.3 })
  const [searchArea, setSearchArea] = useState<{ lat: number, lon: number, radiusKm: number } | null>(null)
  const [place, setPlace] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [yearRange, setYearRange] = useState({ from: '', to: '' })
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/search?datesOnly=true', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(p => { if (p?.dateRange) setDateRange(p.dateRange) }).catch(() => {})
    return () => controller.abort()
  }, [])
  const [historyYear, setHistoryYear] = useState<number | null>(null)
  useEffect(()=>{if(historyYear!=null&&dateRange?.min_date&&dateRange?.max_date){const bounded=Math.max(+dateRange.min_date.slice(0,4),Math.min(+dateRange.max_date.slice(0,4),historyYear));if(bounded!==historyYear)setHistoryYear(bounded)}},[dateRange,historyYear])
  const searchRequest = useRef(0)
  const selectionRequest = useRef(0)
  const named = useMemo(() => nameFeatures(features), [features])
  const filtered = useMemo(() => filterEvents(named, ef, yearRange.from, yearRange.to), [named, ef, yearRange])
  const visible = useMemo(() => sortEvents(filterEvents(filtered, allRatings, '', '', historyYear), sort), [filtered, historyYear, sort])
  const hasDates = named.some(f => eventDate(f.properties))
  useEffect(() => {
    if (!restoring && selectedId != null && !visible.some(f=>f.properties.id===selectedId)) {
      selectionRequest.current++; setSelectedId(null)
    }
  }, [visible, selectedId, restoring])
  useEffect(() => {
    if (restoring) return
    const timer=setTimeout(()=>{
      const query=stateQuery({place,lat:searchArea?.lat??null,lon:searchArea?.lon??null,radius:searchArea?.radiusKm??50,year:historyYear,ef,sort,tornado:selectedId,from:yearRange.from,to:yearRange.to})
      const next=location.pathname+(query?'?'+query:'')
      if(next!==location.pathname+location.search) window.history[urlMode.current==='push'?'pushState':'replaceState'](null,'',next)
      urlMode.current='replace'
    },180)
    return ()=>clearTimeout(timer)
  }, [place,searchArea,historyYear,ef,sort,selectedId,yearRange,restoring])
  useEffect(() => {
    let generation=0
    const restore=async()=>{
      const run=++generation;setRestoring(true)
      const state=parseState(location.search)
      try {
        let lat=state.lat,lon=state.lon
        if((lat==null||lon==null)&&state.place) {
          const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(state.place)}&limit=1`)
          if(!res.ok)throw new Error('Could not restore this location. Please search again.')
          const places=await res.json();if(!places[0])throw new Error('Shared location was not found.')
          lat=Number(places[0].lat);lon=Number(places[0].lon)
        }
        if(run!==generation)return
        let loaded:TornadoFeature[]=[]
        if(lat!=null && lon!=null) loaded=await handleSearch(lat,lon,state.radius,state.place)
        else {searchRequest.current++;selectionRequest.current++;setFeatures([]);setSelectedId(null);setPlace('');setSearchArea(null);setLoading(false);setStatus('Search a location to explore its tornado history.');setViewState({longitude:-95.7129,latitude:37.0902,zoom:3.3})}
        if(run!==generation)return
        setEf(state.ef);setSort(state.sort);setHistoryYear(state.year);setYearRange({from:state.from,to:state.to})
        if(state.tornado!=null) {
          const selected=filterEvents(loaded,state.ef,state.from,state.to,state.year).find(f=>f.properties.id===state.tornado || f.properties.alias_ids?.includes(state.tornado!))
          if(selected) await selectTornado(selected.properties.id)
        }
      } catch(e) {if(run===generation)setSearchError(e instanceof Error?e.message:'Could not restore shared search.')}
      finally {if(run===generation){urlMode.current='replace';setRestoring(false)}}
    }
    void restore();window.addEventListener('popstate',restore)
    return ()=>{generation++;searchRequest.current++;selectionRequest.current++;window.removeEventListener('popstate',restore)}
  }, [])

  function acceptResults(rows: any[], label = '') {
    setFeatures(toFeatures(rows)); setPlace(label); setSelectedId(null); setVisibleCount(50)
    setYearRange({ from: '', to: '' }); setHistoryYear(null); selectionRequest.current++
  }
  async function handleSearch(lat: number, lon: number, radiusKm: number, label = ''): Promise<TornadoFeature[]> {
    const request = ++searchRequest.current
    selectionRequest.current++
    setStatus('Looking through the storm records…'); setLoading(true); setSearchError('')
    try {
      const res = await fetch(`/api/search?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`)
      const payload = await readApiResponse(res, 'The tornado data service is unavailable. Please try again shortly.')
      if (!res.ok || payload.error || payload.message) throw new Error(payload.message ? 'The data service is unavailable. Please try again later.' : 'Search failed. Please try again.')
      if (request !== searchRequest.current) return []
      if (payload.dateRange) setDateRange(payload.dateRange)
      acceptResults(payload.data || [], normalizePlace(label) || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`)
      setSearchArea({ lat, lon, radiusKm })
      setViewState({ longitude: lon, latitude: lat, zoom: Math.max(3, Math.min(10, 8 - Math.log2(radiusKm / 50))) })
      urlMode.current='push'
      setStatus(payload.message ? 'No records available from the data service.' : `${toFeatures(payload.data || []).length} tornadoes loaded${payload.data?.length === 200 ? ' · Search limit reached; narrow the radius for more focused results.' : '.'}`)
      return toFeatures(payload.data || [])
    } catch (e) { if (request === searchRequest.current) { setSearchError(e instanceof Error ? e.message : 'Search failed.'); setStatus('Search failed. Previous results retained.') }; return [] }
    finally { if(request===searchRequest.current)setLoading(false) }
  }
  async function selectTornado(id: number | null) {
    urlMode.current='push'
    const request = ++selectionRequest.current
    if (id == null) { setSelectedId(null); return }
    setSelectedId(id); setDrawerOpen(false); setStatus('Loading full tornado path…')
    try {
      const res = await fetch(`/api/tornado?id=${encodeURIComponent(id)}`)
      const payload = await readApiResponse(res, 'The tornado data service is unavailable. Please try again shortly.')
      if (!res.ok || payload.error) throw new Error('Could not load the full path. Select the tornado to retry.')
      if (request !== selectionRequest.current) return
      const full = toFeatures([payload.tornado])[0]
      if (!full) throw new Error('Full path unavailable.')
      setFeatures(prev => prev.map(f => f.properties.id === id ? { ...full, properties: { ...f.properties, ...full.properties } } : f))
      const coords = full.geometry.coordinates
      setViewState({ longitude: coords[0][0], latitude: coords[0][1], zoom: 8 })
      setStatus('Full path loaded. Replaying tornado path.')
    } catch (e) { if (request === selectionRequest.current) setStatus(e instanceof Error ? e.message : 'Unable to load tornado.') }
  }
  return <main className="archive-app">
    <header className="app-header"><img className="brand-mark" src="/images/project-tiv-archive.jpg" alt="Pixel-art tornado over a green field and blue sky" width={58} height={58} /><div><h1>TIV Archive</h1><p>Explore historic U.S. tornadoes</p></div><DataInfo /></header>
    <div className="workspace">
      <button className="mobile-toggle" aria-expanded={drawerOpen} aria-controls="search-sidebar" onClick={() => setDrawerOpen(v => !v)}>{drawerOpen ? 'Close search & results' : `Search & results${features.length ? ` · ${visible.length}` : ''}`}</button>
      <aside id="search-sidebar" className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Search and tornado results">
        <section className="search-card panel"><h2><span aria-hidden="true">⌖</span> Explore a location</h2><SearchBar location={place} initialRadius={searchArea?.radiusKm??50} onSearch={async (...args)=>{await handleSearch(...args)}} />{searchError && <p className="error" role="alert">{searchError}</p>}
          <details className="filters"><summary>More filters & natural language</summary>
            <fieldset disabled={!hasDates}><legend>Event year range</legend><div className="date-inputs"><input aria-label="From year" type="number" min="1800" max={yearRange.to || '2100'} placeholder="From" value={yearRange.from} onChange={e => { setYearRange(v => ({ ...v, from: e.target.value })); setHistoryYear(null) }} /><span>—</span><input aria-label="To year" type="number" min={yearRange.from || '1800'} max="2100" placeholder="To" value={yearRange.to} onChange={e => { setYearRange(v => ({ ...v, to: e.target.value })); setHistoryYear(null) }} /></div></fieldset>
            {!hasDates && <p className="muted small">Date filtering needs dated event records.</p>}
            <label className="nl-label">Search in your own words</label><NLSearch onSearch={async (...args)=>{await handleSearch(...args)}} onResults={rows => { searchRequest.current++; acceptResults(rows); setSearchArea(null); setSort('recent') }} setStatus={setStatus} />
          </details>
        </section>
        <section className="results-panel panel" aria-label="Tornado results"><div className="results-heading"><h2>{place ? `Tornadoes near ${place}` : 'Tornado results'}</h2><span>{visible.length} found</span></div>
          <div className="sort-row"><label htmlFor="result-sort">Sort by</label><select id="result-sort" value={sort} onChange={e=>{urlMode.current='push';setSort(e.target.value as SortMode)}}><option value="nearest" disabled={!features.some(f=>f.properties.distance_km!=null)}>Nearest</option><option value="strongest">Strongest</option><option value="longest">Longest path</option><option value="recent">Most recent</option><option value="deadliest">Deadliest</option></select></div>
          <div className="result-list" aria-busy={loading}>
            {loading && <div className="search-loading" role="status"><span />Looking through the storm records…</div>}
            {!loading && !visible.length && <div className="empty-state">{!features.length && !searchArea ? <img className="empty-tornado" src="/images/croptornado.png" alt="" width={56} height={56} /> : <span aria-hidden="true">⌖</span>}<h3>{features.length ? 'No events match these filters' : searchArea ? 'No tornadoes found' : 'Pick a place. Follow a storm.'}</h3><p>{features.length ? 'Adjust the EF filters or choose All years.' : searchArea ? `No tornadoes found within ${searchArea.radiusKm} km of ${place || 'this location'}.` : 'Search a city to discover its tornado history—or start with Wichita, Kansas.'}</p>{!features.length && !searchArea && <button className="primary explore-demo" onClick={async()=>{setEf([...allRatings]);setSort('nearest');const rows=await handleSearch(37.6872,-97.3301,50,'Wichita, KS');if(rows.length)setDrawerOpen(false)}}>Explore Wichita, KS <span aria-hidden="true">↗</span></button>}</div>}
            {visible.slice(0, visibleCount).map(f => { const p = f.properties; return <button key={p.id} className={`result-row ${selectedId === p.id ? 'selected' : ''}`} aria-pressed={selectedId === p.id} onClick={() => selectTornado(p.id)}><span className="event-dot" style={{ background: p.color }} /><span className="result-copy"><strong>{p.displayName}</strong><span className="result-date">{dateLabel(p)}</span><span className="result-metrics">{efLabel(p)} · {lengthLabel(p)} · {fatalityLabel(p)}{p.distance_km!=null ? ` · ${p.distance_km.toFixed(1)} km away` : ''}</span></span><span className="chevron" aria-hidden="true">›</span></button> })}
            {visible.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount(v => v + 50)}>Show more tornadoes</button>}
          </div><p className="results-note">Historical records · NOAA / SPC</p>
        </section>
      </aside>
      <section className="map-root" aria-label="Interactive tornado map"><TornadoAnimator features={filtered} visible={visible} ef={ef} onEfChange={value=>{urlMode.current='push';setEf(value)}} initialViewState={viewState} selectedId={selectedId} onSelect={selectTornado} searchArea={searchArea} dateRange={dateRange} historyYear={historyYear} onHistoryYear={setHistoryYear} /><div className="map-status" role="status">{status}</div></section>
    </div>
  </main>
}
