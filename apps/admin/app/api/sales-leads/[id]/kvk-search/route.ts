import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { KvkService, KvkApiError } from '@/lib/services/sales-leads/kvk.service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

type KvkSearchHit = {
  kvkNummer: string
  naam: string
  type: 'hoofdvestiging' | 'rechtspersoon' | 'nevenvestiging'
  plaats?: string
}

/**
 * Live KvK-zoekendpoint voor de recovery-UI in `LeadSourceDetailPanel`.
 * - Naam (≥3 chars) → KvK Zoeken v2, top 10 actieve resultaten.
 * - 8-cijferig KvK-nummer → directe basisprofiel-lookup, 1 result terug.
 * Leunt op KvkService caching (7d via `cachedFetch`).
 *
 * `[id]` in path is voor consistente auth-scoping + logging; we valideren
 * de run niet hier (de search is read-only en geeft geen run-data terug).
 */
async function handler(req: NextRequest, _auth: AuthResult, _ctx: RouteContext) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ error: 'q is verplicht' }, { status: 400 })

  const digits = q.replace(/\D/g, '')
  const isKvkNumber = digits.length === 8

  const svc = new KvkService()
  try {
    if (isKvkNumber) {
      const profiel = await svc.getBasisprofiel(digits)
      const naam =
        profiel.statutaireNaam ??
        profiel.handelsnamen?.[0]?.naam ??
        `KvK ${profiel.kvkNummer}`
      const hoofd = profiel._embedded?.hoofdvestiging
      const result: KvkSearchHit = {
        kvkNummer: profiel.kvkNummer,
        naam,
        type: 'hoofdvestiging',
        plaats: hoofd?.adressen?.[0]?.plaats,
      }
      return NextResponse.json({ mode: 'profile', results: [result] })
    }

    if (q.length < 3) {
      return NextResponse.json(
        { error: 'q moet minimaal 3 chars zijn (of een 8-cijferig KvK-nummer)' },
        { status: 400 },
      )
    }

    const raw = await svc.searchByName(q)
    const results: KvkSearchHit[] = raw.slice(0, 10).map((r) => ({
      kvkNummer: r.kvkNummer,
      naam: r.naam,
      type: r.type,
      plaats: r.adres?.plaats,
    }))
    return NextResponse.json({ mode: 'search', results })
  } catch (e) {
    if (e instanceof KvkApiError) {
      if (e.reason === 'not_found') return NextResponse.json({ mode: 'search', results: [] })
      if (e.reason === 'rate_limited') {
        return NextResponse.json(
          { error: 'KvK rate-limit, probeer opnieuw over een paar seconden' },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: `KvK-fout: ${e.reason}` },
        { status: e.httpStatus || 500 },
      )
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAuth(handler)
