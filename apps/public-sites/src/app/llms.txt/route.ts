import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createPublicClient } from '@/lib/supabase'

/**
 * /llms.txt — AI-readable index per tenant.
 *
 * Follows the llmstxt.org spec:
 *   # Platform Name
 *   > One-line description
 *
 *   Context paragraph.
 *
 *   ## Recente vacatures
 *   - [Title](url): Company, City
 *   ...
 *
 * Cached for 1 hour via Cache-Control. Returns plain text.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-tenant-host') || req.headers.get('host') || 'lokalebanen.nl'
  const hostname = host.split(':')[0]

  const supabase = createPublicClient()

  // Resolve tenant
  const { data: tenant } = await supabase
    .from('platforms')
    .select(
      'id, regio_platform, domain, preview_domain, tier, is_public, hero_title, hero_subtitle, seo_description, central_place'
    )
    .or(`domain.eq.${hostname},preview_domain.eq.${hostname}`)
    .eq('is_public', true)
    .maybeSingle()

  if (!tenant) {
    return new NextResponse('# Lokale Banen\n\n> Vacatureplatform\n', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const baseUrl = tenant.domain
    ? `https://${tenant.domain}`
    : tenant.preview_domain
      ? `https://${tenant.preview_domain}`
      : `https://${hostname}`

  // ── Master aggregator ──────────────────────────────────────────────────────
  if (tenant.tier === 'master') {
    const { data: platforms } = await supabase
      .from('platforms')
      .select('regio_platform, domain, preview_domain, central_place')
      .eq('tier', 'free')
      .eq('is_public', true)
      .order('regio_platform', { ascending: true })

    const platformLines =
      platforms
        ?.map((p) => {
          const url = p.domain ? `https://${p.domain}` : p.preview_domain ? `https://${p.preview_domain}` : null
          const city = p.central_place ? ` (${p.central_place})` : ''
          return url ? `- [${p.regio_platform}${city}](${url})` : null
        })
        .filter(Boolean)
        .join('\n') ?? ''

    const lines = [
      `# Lokale Banen`,
      ``,
      `> Vacatureplatform voor lokale banen door heel Nederland.`,
      ``,
      `Lokale Banen verzamelt vacatures van ${platforms?.length ?? 0} regionale jobboards.`,
      `Elke regio heeft een eigen platform gericht op lokale werkgevers en vacatures.`,
      ``,
      `## Regio-platforms`,
      ``,
      platformLines,
      ``,
      `## Over`,
      ``,
      `- [Alle vacatures](${baseUrl}/vacatures)`,
      `- [Over ons](${baseUrl}/over-ons)`,
    ].join('\n')

    return new NextResponse(lines, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
      },
    })
  }

  // ── Regional platform ──────────────────────────────────────────────────────
  const { data: jobs } = await supabase
    .from('job_postings')
    .select(
      `
      title, slug, city,
      companies!company_id ( name )
    `
    )
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  const jobLines =
    jobs
      ?.map((job) => {
        const company = Array.isArray(job.companies) ? job.companies[0] : job.companies
        const companyName = (company as { name?: string } | null)?.name
        const meta = [companyName, job.city].filter(Boolean).join(', ')
        return `- [${job.title}](${baseUrl}/vacature/${job.slug})${meta ? `: ${meta}` : ''}`
      })
      .join('\n') ?? ''

  const description =
    tenant.seo_description ??
    (tenant.central_place
      ? `Vacatures in ${tenant.central_place} en omgeving.`
      : `Lokale vacatures bij ${tenant.regio_platform}.`)

  const lines = [
    `# ${tenant.hero_title || tenant.regio_platform}`,
    ``,
    `> ${description}`,
    ``,
    tenant.hero_subtitle ? `${tenant.hero_subtitle}\n` : null,
    `## Recente vacatures`,
    ``,
    jobLines || '(Nog geen vacatures beschikbaar)',
    ``,
    `## Navigatie`,
    ``,
    `- [Homepage](${baseUrl}/)`,
    `- [Alle vacatures](${baseUrl}/vacatures)`,
    `- [Over ons](${baseUrl}/over-ons)`,
  ]
    .filter((l) => l !== null)
    .join('\n')

  return new NextResponse(lines, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=3600',
    },
  })
}
