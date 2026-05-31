// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { KvkService, KvkApiError } from '@/lib/services/sales-leads/kvk.service'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const naam = searchParams.get('naam')
  const kvk = searchParams.get('kvk')
  const mode = searchParams.get('mode') ?? 'enrich' // 'health' | 'search' | 'profiel' | 'enrich'

  const svc = new KvkService()
  const t0 = Date.now()
  try {
    if (mode === 'health') {
      return NextResponse.json(await svc.health())
    }
    if (mode === 'search' && naam) {
      const results = await svc.searchByName(naam)
      return NextResponse.json({ duration_ms: Date.now() - t0, count: results.length, results })
    }
    if (mode === 'profiel' && kvk) {
      const profiel = await svc.getBasisprofiel(kvk)
      return NextResponse.json({ duration_ms: Date.now() - t0, profiel })
    }
    if (naam) {
      const normalized = await svc.enrichByName(naam)
      return NextResponse.json({ duration_ms: Date.now() - t0, normalized })
    }
    return NextResponse.json(
      { error: 'Gebruik ?naam=... of ?kvk=...&mode=profiel of ?mode=health' },
      { status: 400 },
    )
  } catch (e) {
    if (e instanceof KvkApiError) {
      return NextResponse.json(
        { error: e.message, reason: e.reason, http_status: e.httpStatus },
        { status: e.httpStatus || 500 },
      )
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAuth(handler)
