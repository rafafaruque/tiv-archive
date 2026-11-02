import { dateLabel, eventDate, rating, stateName, TornadoFeature } from './tornadoDisplay'

export type SourceRelevance = 'likely-event' | 'broader-outbreak'
export type StormSource = { title: string; url: string; domain: string; excerpt: string; relevance: SourceRelevance }
export type StormSourcesResponse = { sources: StormSource[]; expiresAt: number }

export function stormSearchRequest(storm: TornadoFeature) {
  const p = storm.properties
  const date = eventDate(p)
  if (!date) return null
  const state = p.state ? stateName(p.state) : ''
  const county = p.county ? `${p.county.replace(/\s+County$/i, '')} County` : ''
  const place = [p.city, county, state].filter(Boolean).join(', ')
  const start = storm.geometry.coordinates[0]
  const end = storm.geometry.coordinates[storm.geometry.coordinates.length - 1]
  const coordinates = (point: number[]) => `${point[1].toFixed(4)}, ${point[0].toFixed(4)}`
  const location = (place || `near coordinates ${coordinates(start)}`) + (state ? '' : ' (state unavailable)')
  const queryLocation = p.city || county
  const keywords = `${date} ${queryLocation} ${p.state || coordinates(start)}`.replace(/\s+/g, ' ').trim()
  const intensity = rating(p) >= 0 ? `F${rating(p)}/EF${rating(p)}` : ''
  return {
    objective: `Find historical sources about the specific tornado on ${dateLabel(p, 'long')} (${date}) in ${location}. ` +
      `Recorded intensity category: ${intensity || 'unknown'}; path starts at latitude, longitude ${coordinates(start)} and ends at ${coordinates(end)}. ` +
      (p.event_id ? `NOAA/SPC record identifier: ${p.event_id} (not globally unique). ` : '') +
      'Prefer NOAA, National Weather Service (NWS), Storm Prediction Center (SPC), official historical documentation, and reputable local or national news archives. ' +
      'Prioritize event-specific damage surveys and reports identifying this date and location or track, rather than a different tornado in the same outbreak. ' +
      'Use path coordinates to disambiguate; do not infer missing city or county names. If event-specific coverage is unavailable, include relevant broader outbreak reports. ' +
      'Retrospective reports are welcome. Prefer excerpts describing the storm, its track or impacts; omit navigation menus, tables of contents, and site boilerplate.',
    search_queries: [`${keywords} tornado`, `${date} ${p.state || coordinates(start)} ${intensity} NWS tornado`, `${keywords} news`].map(query => query.replace(/\s+/g, ' ').trim().slice(0, 200)),
    mode: 'fast',
    advanced_settings: { max_results: 5, excerpt_settings: { max_chars_per_result: 1200 } },
  }
}

const words = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const mentions = (text: string, phrase: string) => !!phrase.trim() && ` ${words(text)} `.includes(` ${words(phrase)} `)
const stormTerms = /\b(?:tornado\w*|twister\w*|storm\w*|supercell\w*|wind\w*|damag\w*|destroy\w*|injur\w*|fatal\w*|killed|died|touchdown|path|track\w*|funnel\w*|F[0-5]|EF[0-5])\b/i
const stormInformation = /\b(?:was|were|observed|occurred|recorded|caused|damaged|destroyed|killed|injured|reported|tracked|travelled|traveled|developed|extended|hit|struck|crossed|produced|moved|touched|surveyed|rated|reached|died|resulted|affected|sustained|swept|collapsed)\b|\b\d+(?:\.\d+)?\s*(?:miles?|km|kilometers?|yards?|mph|fatalities|injuries|homes)\b/i
const boilerplate = /^(?:home\b|skip to\b|navigation\b|menu\b|search\b|follow us\b|share (?:this|on)\b|subscribe\b|sign (?:in|up)\b|log in\b|contact us\b|privacy\b|cookie\b|terms of (?:use|service)\b|all rights reserved\b|copyright\b|back to top\b|related (?:links|articles)\b|customize your weather\b|weather\.gov\s*>)/i

function plainText(text: string): string {
  const entities: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
  return text
    .replace(/~~[\s\S]*?~~/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? entity
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ''
    })
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(?:#{1,6}\s+|>\s+(?=[a-z“"'])|[-+]\s+|\d+[.)]\s+)/i, '')
    .replace(/^\s*(?:Section Title|Content):\s*/i, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ').trim()
}

function excerptSentences(excerpts: unknown): string[] {
  if (!Array.isArray(excerpts)) return []
  const seen = new Set<string>()
  const sentences: string[] = []
  for (const excerpt of excerpts) {
    if (typeof excerpt !== 'string') continue
    const text = excerpt.replace(/```[\s\S]*?(?:```|$)/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    for (const line of text.split(/\r?\n/)) {
      // Skip table rows, link menus, and breadcrumb trails before stripping markup.
      if ((line.match(/\|/g) || []).length >= 2 || /(?:\s>\s.*){2}/.test(line) || /^\s*\[[^\]]+\]:\s*https?:/i.test(line)) continue
      const cleaned = plainText(line)
      for (const sentence of cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)) {
        const key = words(sentence)
        if (!key || seen.has(key) || boilerplate.test(sentence)) continue
        seen.add(key)
        sentences.push(sentence)
      }
    }
  }
  return sentences
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
function eventDates(text: string): string[] {
  const dates: string[] = []
  const add = (year: number, month: number, day: number) => {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (eventDate({ id: 0, date: iso })) dates.push(iso)
  }
  for (const match of text.matchAll(/\b((?:18|19|20)\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)) add(+match[1], +match[2], +match[3])
  for (const match of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-]((?:18|19|20)\d{2})\b/g)) add(+match[3], +match[1], +match[2])
  const monthNames = months.map(month => `${month.slice(0, 3)}(?:${month.slice(3)})?`).join('|')
  for (const match of text.matchAll(new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+((?:18|19|20)\\d{2})\\b`, 'gi'))) {
    add(+match[3], months.findIndex(month => month.startsWith(match[1].toLowerCase().slice(0, 3))) + 1, +match[2])
  }
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?[,]?\\s+((?:18|19|20)\\d{2})\\b`, 'gi'))) {
    add(+match[3], months.findIndex(month => month.startsWith(match[2].toLowerCase().slice(0, 3))) + 1, +match[1])
  }
  return dates
}

export function cleanStormExcerpt(excerpts: unknown, storm?: TornadoFeature): string {
  const date = storm ? eventDate(storm.properties) : null
  const p = storm?.properties
  const candidates = excerptSentences(excerpts).map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => sentence.length >= 24 && sentence.split(/\s+/).length >= 4 && stormTerms.test(sentence) && stormInformation.test(sentence))
  const scored = candidates.map(({ sentence, index }) => ({ sentence, index, score:
    (date && eventDates(sentence).includes(date) ? 4 : 0) +
    (p?.city && mentions(sentence, p.city) ? 3 : 0) +
    (p?.county && mentions(sentence, `${p.county.replace(/\s+County$/i, '')} County`) ? 2 : 0) +
    (/\b(?:damag\w*|destroy\w*|injur\w*|killed|died|touch\w*|track\w*)\b/i.test(sentence) ? 1 : 0) }))
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  // Select original sentences, never synthesize or paraphrase storm facts.
  const selected = scored.slice(0, 2).sort((a, b) => a.index - b.index)
  let preview = selected.map((item, index) => (index && item.index !== selected[index - 1].index + 1 ? '… ' : '') + item.sentence).join(' ')
  if (preview.length > 420) preview = preview.slice(0, 419).replace(/\s+\S*$/, '').trimEnd() + '…'
  return preview
}

export function classifyStormSource(title: string, excerpts: unknown, storm?: TornadoFeature): SourceRelevance {
  if (!storm) return 'broader-outbreak'
  const p = storm.properties
  const date = eventDate(p)
  if (!date || !p.state || (!p.city && !p.county)) return 'broader-outbreak'
  // A date/state match, publication date, or record ID alone cannot identify a track.
  // Outbreak-wide titles remain broad even when a selected place appears in a list.
  if (/\b(?:outbreak|tornadoes|multiple|several)\b/i.test(title)) return 'broader-outbreak'
  if (eventDates(plainText(title)).some(value => value !== date)) return 'broader-outbreak'
  const intensity = rating(p)
  const ratings = (text: string) => [...text.matchAll(/\b(?:EF|F)[ -]?([0-5])\b/gi)].map(match => +match[1])
  if (intensity >= 0 && ratings(title).some(value => value !== intensity)) return 'broader-outbreak'
  for (const sentence of [plainText(title), ...excerptSentences(excerpts)]) {
    if (!/\btornado\b/i.test(sentence) || /\b(?:outbreak|tornadoes|multiple|several|other|another|unlike|not)\b/i.test(sentence)) continue
    const dates = eventDates(sentence)
    if (!dates.includes(date) || dates.some(value => value !== date)) continue
    const state = stateName(p.state.toUpperCase())
    const stateMatches = mentions(sentence, state) || (/^[A-Z]{2}$/.test(p.state) && new RegExp(`,\\s*${p.state}\\b`).test(sentence))
    if (!stateMatches) continue
    const reportedRatings = ratings(sentence)
    if (intensity >= 0 && reportedRatings.some(value => value !== intensity)) continue
    const cityMatches = !!p.city && mentions(sentence, p.city)
    const countyMatches = !!p.county && mentions(sentence, `${p.county.replace(/\s+County$/i, '')} County`)
    if (cityMatches || (countyMatches && intensity >= 0 && reportedRatings.includes(intensity))) return 'likely-event'
  }
  return 'broader-outbreak'
}

export function parseStormSources(payload: unknown, storm?: TornadoFeature): StormSource[] {
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
      sources.push({ title: result.title.trim(), url: url.href, domain: url.hostname.replace(/^www\./, ''),
        excerpt: cleanStormExcerpt(result.excerpts, storm), relevance: classifyStormSource(result.title, result.excerpts, storm) })
      seen.add(url.href)
      if (sources.length === 5) break
    } catch { /* Skip invalid source URLs. */ }
  }
  return sources.sort((a, b) => Number(b.relevance === 'likely-event') - Number(a.relevance === 'likely-event'))
}
