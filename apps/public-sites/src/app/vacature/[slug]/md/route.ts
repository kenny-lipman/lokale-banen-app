import { NextResponse } from 'next/server'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug } from '@/lib/queries'

/**
 * Markdown mirror route for LLM discovery.
 * Returns the job posting as clean text/markdown content.
 * No HTML chrome, just the content -- ideal for AI crawlers.
 *
 * Content-Type: text/markdown; charset=utf-8
 * @see GEO-ANALYSIS.md section 7 (Markdown mirror per vacature)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const tenant = await getTenant()

  if (!tenant) {
    return new NextResponse('Tenant not found', { status: 404 })
  }

  const job = await getJobBySlug(tenant.id, slug)

  if (!job) {
    return new NextResponse('Job not found', { status: 404 })
  }

  const companyName = job.company?.name || 'Onbekend bedrijf'
  const domain = tenant.domain || 'lokalebanen.nl'

  // Prefer content_md (Mistral-enriched) over raw description
  let body: string
  if (job.content_md) {
    body = job.content_md
  } else if (job.description) {
    // Strip HTML tags from description, convert to clean markdown
    body = job.description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<h[1-6][^>]*>/gi, '## ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  } else {
    body = 'Geen beschrijving beschikbaar.'
  }

  // Build metadata lines, filtering out empty values
  const metaLines: string[] = []
  metaLines.push(`**Bedrijf**: ${companyName}`)
  if (job.city) {
    metaLines.push(`**Locatie**: ${job.city}${job.state ? ` (${job.state})` : ''}`)
  }
  if (job.salary && job.salary.trim() !== '-') {
    metaLines.push(`**Salaris**: ${job.salary}`)
  }
  if (job.employment) {
    metaLines.push(`**Type**: ${job.employment}`)
  }
  if (job.working_hours_min || job.working_hours_max) {
    const hours = [job.working_hours_min, job.working_hours_max].filter(Boolean).join('-')
    metaLines.push(`**Uren**: ${hours} uur per week`)
  }
  if (job.published_at) {
    metaLines.push(
      `**Geplaatst**: ${new Date(job.published_at).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}`
    )
  }
  if (job.end_date) {
    metaLines.push(
      `**Geldig tot**: ${new Date(job.end_date).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}`
    )
  }

  const markdown = `# ${job.title}

${metaLines.join('\n')}

---

${body}

---
Bron: https://${domain}/vacature/${slug}
${job.url ? `Solliciteer: ${job.url}` : ''}
Onderdeel van Lokale Banen Netwerk (https://lokalebanen.nl)
`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
