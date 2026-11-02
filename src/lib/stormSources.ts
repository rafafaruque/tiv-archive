import { dateLabel, efLabel, eventDate, stateName, TornadoFeature } from './tornadoDisplay'

export type StormSource = { title: string; url: string; domain: string; excerpt: string }
export type StormSourcesResponse = { sources: StormSource[]; expiresAt: number }

export function stormSearchRequest(storm: TornadoFeature) {
  const p = storm.properties
  const date = eventDate(p)
  if (!date) return null
  const state = p.state ? stateName(p.state) : ''
  const place = [p.city, p.county ? `${p.county} County` : '', state].filter(Boolean).join(', ')
  const start = storm.geometry.coordinates[0]
  const end = storm.geometry.coordinates[storm.geometry.coordinates.length - 1]
  const coordinates = (point: number[]) => `${point[1].toFixed(4)}, ${point[0].toFixed(4)}`
  const location = place || `near coordinates ${coordinates(start)} (state unavailable)`
  const queryLocation = p.city || (p.county ? `${p.county} County` : '')
  const keywords = `${date} ${queryLocation} ${p.state || coordinates(start)}`.replace(/\s+/g, ' ').trim()
  return {
    objective: `Find historical sources about the specific tornado on ${dateLabel(p, 'long')} (${date}) in ${location}. ` +
      `Recorded rating: ${efLabel(p)}; path starts at latitude, longitude ${coordinates(start)} and ends at ${coordinates(end)}. ` +
      (p.event_id ? `NOAA/SPC record identifier: ${p.event_id} (not globally unique). ` : '') +
      'Prefer NOAA, National Weather Service (NWS), Storm Prediction Center (SPC), official historical documentation, and reputable local or national news archives. ' +
      'Prioritize sources identifying this date and location or path. Multiple tornadoes may share this date and state; avoid unrelated storms and generic tornado pages. Retrospective reports are welcome. Return relevant source excerpts.',
    search_queries: [`${keywords} tornado`, `${keywords} NWS`, `${keywords} news`].map(query => query.slice(0, 200)),
    mode: 'fast',
    advanced_settings: { max_results: 5, excerpt_settings: { max_chars_per_result: 700 } },
  }
}

export function parseStormSources(payload: unknown): StormSource[] {
  if (!payload || typeof payload !== 'object' || !('results' in payload) || !Array.isArray(payload.results)) {
    throw new Error('Invalid search response')
  }
  const sources: StormSource[] = []
  const seen = new Set<string>()
  for (const result of payload.results) {
    if (!result || typeof result.url !== 'string' || typeof result.title !== 'string' || !result.title.trim()) continue
    try {
      const url = new URL(result.url)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) continue
      const excerpt = Array.isArray(result.excerpts)
        ? result.excerpts.filter((value: unknown): value is string => typeof value === 'string' && !!value.trim()).join('\n\n')
        : ''
      sources.push({ title: result.title.trim(), url: url.href, domain: url.hostname.replace(/^www\./, ''), excerpt })
      seen.add(url.href)
      if (sources.length === 5) break
    } catch { /* Skip invalid source URLs. */ }
  }
  return sources
}
