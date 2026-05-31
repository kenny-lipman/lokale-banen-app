// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { MapsService, MapsApiError } from '@/lib/services/sales-leads/maps.service'

export const maxDuration = 120
export const runtime = 'nodejs'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const mode = searchParams.get('mode') ?? 'multi' // 'health' | 'enrich' | 'multi'

  const svc = new MapsService()
  const t0 = Date.now()
  try {
    if (mode === 'health') return NextResponse.json(await svc.health())
    if (!query) {
      return NextResponse.json(
        { error: 'Gebruik ?q=... met ?mode=health|enrich|multi (default multi)' },
        { status: 400 },
      )
    }
    if (mode === 'enrich') {
      const n = await svc.enrichByQuery(query)
      return NextResponse.json({ duration_ms: Date.now() - t0, normalized: n })
    }
    // multi (default)
    const candidates = await svc.enrichByQueryMulti(query)
    return NextResponse.json({
      duration_ms: Date.now() - t0,
      count: candidates.length,
      candidates,
    })
  } catch (e) {
    if (e instanceof MapsApiError) {
      const status = e.reason === 'not_found' ? 404 : e.reason === 'no_key' ? 503 : 500
      return NextResponse.json({ error: e.message, reason: e.reason }, { status })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAuth(handler)
