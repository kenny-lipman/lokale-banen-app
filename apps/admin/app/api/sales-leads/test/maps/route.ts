import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { MapsService, MapsApiError } from '@/lib/services/sales-leads/maps.service'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  const placeId = searchParams.get('place_id')
  const mode = searchParams.get('mode') ?? 'enrich' // 'health' | 'find' | 'details' | 'enrich'

  const svc = new MapsService()
  const t0 = Date.now()
  try {
    if (mode === 'health') return NextResponse.json(await svc.health())
    if (mode === 'find' && query) {
      const c = await svc.findPlace(query)
      return NextResponse.json({ duration_ms: Date.now() - t0, candidate: c })
    }
    if (mode === 'details' && placeId) {
      const d = await svc.getPlaceDetails(placeId)
      return NextResponse.json({ duration_ms: Date.now() - t0, details: d })
    }
    if (query) {
      const n = await svc.enrichByQuery(query)
      return NextResponse.json({ duration_ms: Date.now() - t0, normalized: n })
    }
    return NextResponse.json(
      { error: 'Gebruik ?q=... of ?place_id=...&mode=details of ?mode=health' },
      { status: 400 },
    )
  } catch (e) {
    if (e instanceof MapsApiError) {
      const status = e.reason === 'not_found' ? 404 : e.reason === 'no_key' ? 503 : 500
      return NextResponse.json({ error: e.message, reason: e.reason }, { status })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
