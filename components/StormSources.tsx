"use client"
import { useEffect, useRef, useState } from 'react'
import type { StormSourcesResponse } from '../src/lib/stormSources'

const cache = new Map<number, StormSourcesResponse>()
const pending = new Map<number, Promise<StormSourcesResponse>>()

function loadSources(id: number): Promise<StormSourcesResponse> {
  const hit = cache.get(id)
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit)
  cache.delete(id)
  const existing = pending.get(id)
  if (existing) return existing
  const request = fetch(`/api/storm-sources?id=${id}`).then(async response => {
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(payload?.error || 'Could not load historical sources. Please try again.')
    if (!Array.isArray(payload?.sources) || typeof payload.expiresAt !== 'number') {
      throw new Error('Could not load historical sources. Please try again.')
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(id, payload)
    return payload as StormSourcesResponse
  }).finally(() => pending.delete(id))
  pending.set(id, request)
  return request
}

export default function StormSources({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StormSourcesResponse | null>(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  // Allow an in-flight request to fill the cache after selection changes, without updating the old panel.
  useEffect(() => () => { generation.current++ }, [])

  async function explore() {
    setOpen(true)
    setLoading(true)
    setError('')
    setResult(null)
    const current = ++generation.current
    try {
      const sources = await loadSources(id)
      if (current === generation.current) setResult(sources)
    } catch (error) {
      if (current === generation.current) setError(error instanceof Error ? error.message : 'Could not load historical sources.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }

  const panelId = `storm-sources-${id}`
  return <div className="storm-research">
    <button className="explore-storm" aria-expanded={open} aria-controls={panelId} disabled={loading}
      onClick={() => open ? setOpen(false) : void explore()}>
      <span aria-hidden="true">⌕</span> {open ? 'Hide storm sources' : 'Explore this storm'}
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <section id={panelId} className="storm-sources" aria-label="Potential historical sources" aria-busy={loading} hidden={!open}>
      <h3>Potential historical sources</h3>
      <p className="source-note">Search matches, not verified matches. Check dates and locations; reports may cover other tornadoes in the same outbreak.</p>
      <div role="status" aria-live="polite">
        {loading && <p className="search-loading"><span aria-hidden="true" />Searching historical sources…</p>}
        {result && !result.sources.length && <p className="source-note">No sources found for this record. Historical coverage may be limited.</p>}
      </div>
      {error && <div className="source-error"><p className="error" role="alert">{error}</p><button onClick={() => void explore()}>Try again</button></div>}
      {!!result?.sources.length && <ul className="source-list">
        {result.sources.map(source => <li className="source-card" key={source.url}>
          <p className="source-domain">{source.domain}</p>
          <h4><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span><span className="source-sr-only"> (opens in a new tab)</span></a></h4>
          <p className="source-excerpt">{source.excerpt || 'No excerpt provided by the search result.'}</p>
        </li>)}
      </ul>}
      <p className="source-credit">Search powered by Parallel</p>
    </section>
  </div>
}
