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
  const [expanded, setExpanded] = useState(false)
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
  return <div className={`storm-research${open && expanded ? ' sources-expanded' : ''}`}>
    <button className="explore-storm" aria-expanded={open} aria-controls={panelId} disabled={loading}
      onClick={() => open ? setOpen(false) : void explore()}>
      <span aria-hidden="true">⌕</span> {open ? 'Hide storm sources' : 'Explore this storm'}
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <section id={panelId} className="storm-sources" aria-label="Potential historical sources" aria-busy={loading} hidden={!open}>
      <div className="source-heading">
        <h3>Potential historical sources</h3>
        <button className="source-expand" type="button" aria-label={expanded ? 'Collapse storm sources' : 'Expand storm sources'}
          title={expanded ? 'Collapse storm sources' : 'Expand storm sources'} aria-pressed={expanded} aria-controls={panelId}
          onClick={() => setExpanded(value => !value)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? 'M1 6h5V1M10 15v-5h5M6 6 1 1m9 9 5 5' : 'M1 6V1h5M10 15h5v-5M1 1l5 5m4 4 5 5'} />
          </svg>
        </button>
      </div>
      <p className="source-note">Potential sources, not verified matches. Outbreak reports may cover other tornadoes.</p>
      <div role="status" aria-live="polite">
        {loading && <p className="search-loading"><span aria-hidden="true" />Searching historical sources…</p>}
        {result && !result.sources.length && <p className="source-note">No sources found for this record. Historical coverage may be limited.</p>}
      </div>
      {error && <div className="source-error"><p className="error" role="alert">{error}</p><button onClick={() => void explore()}>Try again</button></div>}
      {!!result?.sources.length && <ul className="source-list" tabIndex={0} aria-label="Historical source results">
        {result.sources.map(source => <li className="source-card" key={source.url}>
          <p className="source-domain">{source.domain}</p>
          <p className={`source-relevance ${source.relevance === 'likely-event' ? 'likely-event' : ''}`}
            title={source.relevance === 'likely-event' ? 'The event date and specific location agree in the result text; this is not verification.' : 'The result could not be tied to this specific tornado. Check the original report.'}>
            {source.relevance === 'likely-event' ? 'Likely event match' : 'Broader outbreak coverage'}
          </p>
          <h4><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span><span className="source-sr-only"> (opens in a new tab)</span></a></h4>
          {source.excerpt && <p className="source-excerpt">{source.excerpt}</p>}
        </li>)}
      </ul>}
      <p className="source-credit">Search powered by Parallel</p>
    </section>
  </div>
}
