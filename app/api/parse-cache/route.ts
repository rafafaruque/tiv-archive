import { NextResponse } from 'next/server'
import { getAllParses, clearCache } from '../../../src/lib/parseCache'

export async function GET() {
  try {
    const cache = getAllParses()
    return NextResponse.json({ cache })
  } catch (e) {
    return NextResponse.json({ error: 'Could not read cache' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    clearCache()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Could not clear cache' }, { status: 500 })
  }
}
