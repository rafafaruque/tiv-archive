import { Pool } from 'pg'

const connection = process.env.DATABASE_URL || ''
let pool: Pool | null = null
if (connection) {
  pool = new Pool({ connectionString: connection })
}

export async function query(text: string, params?: any[]) {
  if (!pool) throw new Error('DATABASE_URL not configured')
  const res = await pool.query(text, params)
  return res
}

export function getPool() {
  if (!pool) throw new Error('DATABASE_URL not configured')
  return pool
}
