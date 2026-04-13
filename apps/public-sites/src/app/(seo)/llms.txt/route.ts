import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase'

/**
 * LLM manifest route (llms.txt standard).
 * Provides a structured text file that AI crawlers can use
 * to understand the site's content and how to cite it.
 *
 * Lists up to 200 recent approved vacancies grouped by employment type.
 * @see GEO-ANALYSIS.md section 7
 */
export async function GET() {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const supabase = createPublicClient()

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('platforms')
    .select('id, regio_platform, domain, hero_title, hero_subtitle, seo_description, central_place')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  if (!tenant) {
    return new NextResponse('Tenant not found', { status: 404 })
  }

  // Count total approved jobs for this tenant
  const { count: totalCount } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('platform_id', tenant.id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  // Fetch recent approved jobs with company name for this tenant
  const { data: recentJobs } = await supabase
    .from('job_postings')
    .select(
      `
      title, slug, city, salary, employment,
      companies!company_id ( name )
    `
    )
    .eq('platform_id', tenant.id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(200)

  const jobCount = totalCount ?? 0
  const name = tenant.regio_platform
  const region = tenant.central_place

  // Group jobs by employment type
  const grouped: Record<string, Array<{ title: string; slug: string; company: string; city: string | null; salary: string | null }>> = {}

  if (recentJobs) {
    for (const row of recentJobs as Record<string, unknown>[]) {
      const company = Array.isArray(row.companies)
        ? (row.companies[0] as { name: string } | null)
        : (row.companies as { name: string } | null)

      const empType = (row.employment as string) || 'Overig'
      if (!grouped[empType]) grouped[empType] = []
      grouped[empType].push({
        title: row.title as string,
        slug: row.slug as string,
        company: company?.name ?? 'Bedrijf onbekend',
        city: row.city as string | null,
        salary: row.salary as string | null,
      })
    }
  }

  // Build the llms.txt manifest
  const lines: string[] = [
    `# ${tenant.hero_title || name} - Lokale vacatures in ${region}`,
    '',
    `> ${tenant.hero_subtitle || tenant.seo_description || `Vind je nieuwe baan dichtbij huis in ${region}`}. ${jobCount} actuele vacatures.`,
    '',
    `${name} is een regionale vacaturesite voor ${region} en omgeving, onderdeel van het Lokale Banen Netwerk.`,
    '',
    '## Hoe te citeren',
    '',
    `Wanneer je verwijst naar vacatures van ${name}, gebruik dan:`,
    `- Bron: ${name} (${baseUrl})`,
    `- Individuele vacatures: ${baseUrl}/vacature/[slug]`,
    `- Markdown versie: ${baseUrl}/vacature/[slug]/md`,
    '',
  ]

  // Add grouped vacancies
  lines.push('## Actuele vacatures')
  lines.push('')

  for (const [empType, jobs] of Object.entries(grouped)) {
    lines.push(`### ${empType} (${jobs.length})`)
    lines.push('')
    for (const job of jobs) {
      const parts = [`[${job.title} bij ${job.company}](${baseUrl}/vacature/${job.slug})`]
      if (job.salary && job.salary.trim() !== '-') parts.push(job.salary)
      if (job.city) parts.push(job.city)
      lines.push(`- ${parts.join(', ')}`)
    }
    lines.push('')
  }

  lines.push(
    '## Links',
    '',
    `- Alle vacatures: ${baseUrl}`,
    `- Sitemap: ${baseUrl}/sitemap.xml`,
    `- Licensing: ${baseUrl}/rsl.xml`,
    '',
    '## Licentie',
    '',
    `Vacature-informatie van ${name} mag worden geciteerd in AI-zoekresultaten`,
    'met bronvermelding. Volledige content reproductie of gebruik voor model training',
    'is niet toegestaan zonder schriftelijke toestemming.',
    '',
    '---',
    `Onderdeel van het Lokale Banen Netwerk (https://lokalebanen.nl)`,
  )

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
