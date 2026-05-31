// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { ApolloService, ApolloApiError } from '@/lib/services/sales-leads/apollo.service'

async function handler(req: NextRequest, _auth: AuthResult) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'enrich' // 'health' | 'enrich' | 'match' | 'contacts'
  const domain = searchParams.get('domain')
  const name = searchParams.get('name')
  const orgName = searchParams.get('org')

  const svc = new ApolloService()
  const t0 = Date.now()
  try {
    if (mode === 'health') return NextResponse.json(await svc.health())
    if (mode === 'enrich' && domain) {
      const r = await svc.enrichOrganization(domain)
      return NextResponse.json({ duration_ms: Date.now() - t0, ...r })
    }
    if (mode === 'match' && name) {
      const r = await svc.matchPerson({ name, organization_name: orgName ?? undefined, domain: domain ?? undefined })
      return NextResponse.json({ duration_ms: Date.now() - t0, ...r })
    }
    if (mode === 'contacts' && domain) {
      const r = await svc.searchContactsByDomain(domain)
      return NextResponse.json({ duration_ms: Date.now() - t0, ...r })
    }
    return NextResponse.json(
      { error: 'Gebruik ?mode=health|enrich&domain=...|match&name=...&org=...|contacts&domain=...' },
      { status: 400 },
    )
  } catch (e) {
    if (e instanceof ApolloApiError) {
      return NextResponse.json(
        { error: e.message, reason: e.reason, http_status: e.httpStatus },
        { status: e.httpStatus || 500 },
      )
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = withAuth(handler)
