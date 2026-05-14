import { NextResponse } from 'next/server'
import { getTenant } from '@/lib/tenant'
import { getJobTitleSuggestions } from '@/lib/queries'

export const dynamic = 'force-dynamic'

/**
 * GET /api/search/suggest?q=...
 *
 * Autosuggest-endpoint voor het zoekveld. Returns top-8 matchende
 * job-titles van de huidige tenant. Master-aggregator returnt leeg
 * (suggesties zijn alleen op regio-tenants relevant — de master toont
 * het hele netwerk en zoekt op city).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q') ?? ''
  if (query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const tenant = await getTenant()
  if (!tenant || tenant.tier === 'master') {
    return NextResponse.json({ suggestions: [] })
  }

  const suggestions = await getJobTitleSuggestions(tenant.id, query, 8)
  return NextResponse.json(
    { suggestions },
    {
      headers: {
        // Korte cache — suggesties veranderen niet vaak, en query-set is
        // beperkt (typische queries: "verpleegkundige", "monteur", etc).
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
