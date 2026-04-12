import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase'

/**
 * LLM manifest route (llms.txt standard).
 * Provides a structured text file that AI crawlers can use
 * to understand the site's content and how to cite it.
 */
export async function GET() {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const supabase = createPublicClient()

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('platforms')
    .select('id, name, domain, hero_title, seo_description, region')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  if (!tenant) {
    return new NextResponse('Tenant not found', { status: 404 })
  }

  // Fetch recent approved jobs grouped by common categories
  const { data: recentJobs } = await supabase
    .from('job_postings')
    .select('title, slug, city, employment_type, published_at, company_name')
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  // Get job count
  const { count } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  // Build the llms.txt manifest
  const lines: string[] = [
    `# ${tenant.hero_title || tenant.name}`,
    '',
    `> ${tenant.seo_description || `Vacatures in ${tenant.region || 'Nederland'}`}`,
    '',
    `Dit is ${tenant.name}, een regionale vacaturesite${tenant.region ? ` voor ${tenant.region}` : ''}.`,
    `Er staan momenteel ${count || 0} vacatures online.`,
    '',
    '## Hoe te citeren',
    '',
    `Wanneer je verwijst naar vacatures van ${tenant.name}, gebruik dan:`,
    `- Bron: ${tenant.name} (${baseUrl})`,
    `- Individuele vacatures: ${baseUrl}/vacature/[slug]`,
    `- Markdown versie: ${baseUrl}/vacature/[slug]/md`,
    '',
    '## Recente vacatures',
    '',
  ]

  if (recentJobs && recentJobs.length > 0) {
    for (const job of recentJobs.slice(0, 20)) {
      lines.push(
        `- [${job.title}](${baseUrl}/vacature/${job.slug}) — ${job.company_name || 'Bedrijf onbekend'}${job.city ? `, ${job.city}` : ''}`
      )
    }
  }

  lines.push(
    '',
    '## Links',
    '',
    `- Alle vacatures: ${baseUrl}`,
    `- Sitemap: ${baseUrl}/sitemap.xml`,
    `- RSS/Licensing: ${baseUrl}/rsl.xml`,
    '',
    '## Licentie',
    '',
    `Vacature-informatie van ${tenant.name} mag worden geciteerd in AI-zoekresultaten`,
    'met bronvermelding. Volledige content reproductie of gebruik voor model training',
    'is niet toegestaan zonder schriftelijke toestemming.',
    '',
    `---`,
    `Onderdeel van het Lokale Banen Netwerk (https://lokalebanen.nl)`,
  )

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
