// Ingest embeddings for tornado narratives using OpenAI and store in Postgres pgvector column.
// Requires: DATABASE_URL and OPENAI_API_KEY

const dotenv = require('dotenv')
const fs = require('fs')
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' })
} else {
  dotenv.config()
}
const { Pool } = require('pg')
const OpenAI = require('openai')

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in env')
  process.exit(1)
}
if (!process.env.OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY in env')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function ingest() {
  const res = await pool.query('SELECT id, narrative FROM tornadoes WHERE narrative IS NOT NULL AND (embedding IS NULL) LIMIT 200')
  console.log(`Found ${res.rows.length} rows to embed`)
  let i = 0
  for (const row of res.rows) {
    const text = row.narrative
    try {
      const emb = await client.embeddings.create({ model: 'text-embedding-3-small', input: text })
      const vector = emb.data[0].embedding
      await pool.query('UPDATE tornadoes SET embedding = $1 WHERE id = $2', [vector, row.id])
      i++
      if (i % 50 === 0) console.log(`Embedded ${i}`)
    } catch (err) {
      console.error('embed error', err)
    }
  }
  console.log(`done; embedded ${i}`)
  await pool.end()
}

ingest().catch(err => { console.error(err); process.exit(1) })
