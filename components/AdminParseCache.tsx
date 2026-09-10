"use client"
import { useState } from 'react'

export default function AdminParseCache() {
  const [cache, setCache] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/parse-cache')
      const j = await res.json()
      setCache(j.cache || {})
    } catch (e: any) {
      setMsg('Could not load cache')
    } finally {
      setLoading(false)
    }
  }

  async function clearAll() {
    if (!confirm('Clear parse cache?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/parse-cache', { method: 'DELETE' })
      const j = await res.json()
      if (j.ok) {
        setCache({})
        setMsg('Cache cleared')
      } else {
        setMsg('Could not clear cache')
      }
    } catch (e) {
      setMsg('Could not clear cache')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={load} disabled={loading} style={{ padding: '6px 10px' }}>{loading ? 'Loading...' : 'Refresh'}</button>
        <button onClick={clearAll} disabled={loading} style={{ padding: '6px 10px' }}>Clear Cache</button>
        {msg ? <div style={{ marginLeft: 8 }}>{msg}</div> : null}
      </div>

      {cache ? (
        <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
          {Object.keys(cache).length === 0 ? <div>(empty)</div> : Object.entries(cache).map(([k,v])=> (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>{k}</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 8 }}>{JSON.stringify(v, null, 2)}</pre>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: '#666' }}>No data loaded — click Refresh</div>
      )}
    </div>
  )
}
