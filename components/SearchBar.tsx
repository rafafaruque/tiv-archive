"use client"
import { useEffect, useState } from 'react'

export default function SearchBar({ onSearch, location, initialRadius = 50 }: { location?: string, initialRadius?: number, onSearch: (lat: number, lon: number, radiusKm: number, place?: string) => void | Promise<void> }) {
  const [q, setQ] = useState('Wichita, KS')
  const [radius, setRadius] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setQ(location || 'Wichita, KS'); setRadius(initialRadius) }, [location, initialRadius])
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q.trim())}&limit=1`)
      if (!res.ok) throw new Error('Location search is unavailable. Please try again.')
      const data = await res.json()
      if (!data[0]) throw new Error('No location found. Try a city and state.')
      await onSearch(Number(data[0].lat), Number(data[0].lon), radius, q.trim())
    } catch (e) { setError(e instanceof Error ? e.message : 'Search failed. Please try again.') }
    finally { setLoading(false) }
  }
  return <form onSubmit={handleSearch} className="place-search">
    <label htmlFor="place">City or location</label>
    <div className="search-input-row"><input id="place" required value={q} onChange={e => setQ(e.target.value)} placeholder="City, state or address" /><button className="primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button></div>
    <div className="radius-heading"><label htmlFor="radius">Search radius</label><span><input aria-label="Radius in kilometers" type="number" min="1" max="500" required value={radius} onChange={e => setRadius(Number(e.target.value))} /> km</span></div>
    <input id="radius" type="range" min="1" max="500" value={radius} onChange={e => setRadius(Number(e.target.value))} />
    <div className="range-labels"><span>1 km</span><span>500 km</span></div>
    {error && <p className="error" role="alert">{error}</p>}
  </form>
}
