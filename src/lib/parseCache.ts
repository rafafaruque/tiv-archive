import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.resolve(process.cwd(), '.cache')
const CACHE_FILE = path.join(CACHE_DIR, 'parse_cache.json')

let cache: Record<string, any> = {}
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8')
    cache = JSON.parse(raw || '{}')
  } else {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR)
    fs.writeFileSync(CACHE_FILE, '{}')
  }
} catch (e) {
  cache = {}
}

function persist() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
  } catch (e) {
    // ignore
  }
}

export function getCachedParse(q: string) {
  return cache[q]
}

export function setCachedParse(q: string, parsed: any) {
  cache[q] = parsed
  persist()
}

export function clearCache() {
  cache = {}
  persist()
}

export function getAllParses() {
  return cache
}

export default { getCachedParse, setCachedParse, clearCache }
