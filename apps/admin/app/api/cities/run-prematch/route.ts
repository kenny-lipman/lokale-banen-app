// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

/**
 * Triggert 1 chunk van bulk_prematch_geocoding_chunk.
 * UI kan opnieuw aanroepen tot rows_updated = 0 voor volledige run.
 * Max-runtime per chunk: 240s server-side (handled in functie).
 */
async function handler(req: NextRequest, _auth: AuthResult) {
  const url = new URL(req.url)
  const chunkSize = Math.min(
    Math.max(parseInt(url.searchParams.get('chunk') ?? '10000', 10), 100),
    20000,
  )

  const svc = createServiceRoleClient()
  const { data, error } = await svc.rpc('bulk_prematch_geocoding_chunk', {
    chunk_size: chunkSize,
  })
  if (error) {
    console.error('bulk_prematch_geocoding_chunk RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rows_updated: data ?? 0 })
}

export const maxDuration = 300
export const POST = withAdminAuth(handler)
