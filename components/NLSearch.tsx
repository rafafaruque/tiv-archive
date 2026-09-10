"use client"
import { useState } from 'react'

type Props = {
  onSearch: (lat: number, lon: number, radiusKm: number) => void,
  onResults: (rows: any[]) => void,
  setStatus: (s: string) => void
}

export default function NLSearch({ onSearch, onResults, setStatus }: Props) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  async function geocodeAndSearch(query: string) {
    setStatus('Geocoding...')
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`)
      const places = await r.json()
      if (places && places.length > 0) {
        const p = places[0]
        const lat = parseFloat(p.lat)
        const lon = parseFloat(p.lon)
        onSearch(lat, lon, 50)
        return true
      }
    } catch (e) {
      // ignore
    }
    return false
  }

  async function handleSubmit(e: any) {
    e?.preventDefault()
    if (!q) return
    setLoading(true)
    // Heuristic: if query looks like a filter/temporal/EF query, parse-first. Otherwise geocode-first.
    const filterRegex = /\b(EF\s*\+?\d|EF\d|\d{4}|since|after|before|between|from|to|\bkm\b|\bmi\b)\b/i
    const looksLikeFilter = filterRegex.test(q)

    if (looksLikeFilter) {
      setStatus('Parsing natural-language query...')
      try {
        const parseRes = await fetch('/api/nl-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, parseOnly: true }) })
          .then(r => r.json())
        const parsed = parseRes?.parsed
        if (parsed) {
          // If parser found coordinates, run spatial search via onSearch
          if (parsed.lat != null && parsed.lon != null) {
            onSearch(parsed.lat, parsed.lon, parsed.radiusKm || 50)
            setLoading(false)
            return
          }
          // Otherwise call full nl-search to get semantic/attribute results
          const full = await fetch('/api/nl-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) }).then(r => r.json())
          if (full?.data && full.data.length > 0) {
            onResults(full.data)
            setStatus(`Found ${full.data.length} tornadoes`)
            setLoading(false)
            return
          }
        }
        // fallback to geocode if parser returned nothing useful
        const geoOk = await geocodeAndSearch(q)
        if (!geoOk) setStatus('No results from NL search; no geocode match')
      } catch (err) {
        // fallback to geocode on error
        const geoOk = await geocodeAndSearch(q)
        if (!geoOk) setStatus('Error running NL search')
      } finally {
        setLoading(false)
      }
      return
    }

    // Default: geocode-first (fast for place queries)
    const geoOk = await geocodeAndSearch(q)
    if (geoOk) {
      setLoading(false)
      return
    }

    // If geocode failed, fall back to parse-only then full search
    setStatus('Parsing natural-language query...')
    try {
      const parseRes = await fetch('/api/nl-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, parseOnly: true }) }).then(r => r.json())
      const parsed = parseRes?.parsed
      if (parsed && parsed.lat != null && parsed.lon != null) {
        onSearch(parsed.lat, parsed.lon, parsed.radiusKm || 50)
      } else {
        const full = await fetch('/api/nl-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) }).then(r => r.json())
        if (full?.data && full.data.length > 0) {
          onResults(full.data)
          setStatus(`Found ${full.data.length} tornadoes`)
        } else {
          setStatus('No results from NL search; no geocode match')
        }
      }
    } catch (err) {
      setStatus('Error running NL search')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="nl-search">
      <input aria-label="Natural language query" placeholder="Try: 'EF3+ near Dallas since 1990'" value={q} onChange={e => setQ(e.target.value)}  />
      <button type="submit" disabled={loading} >{loading ? 'Searching...' : 'Go'}</button>
    </form>
  )
}
