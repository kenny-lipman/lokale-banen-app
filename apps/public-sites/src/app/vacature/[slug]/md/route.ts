import { NextResponse } from 'next/server'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug } from '@/lib/queries'

/**
 * Markdown mirror route for LLM discovery.
 * Returns the job posting as clean text/markdown content.
 * No HTML chrome, just the content -- ideal for AI crawlers.
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

  const companyName = job.company?.name || job.company_name || 'Onbekend bedrijf'

  // Strip HTML tags from description
  const cleanDescription = job.description
    ? job.description
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
    : ''

  const markdown = `# ${job.title}

**Bedrijf:** ${companyName}
${job.city ? `**Locatie:** ${job.city}${job.state ? `, ${job.state}` : ''}` : ''}
${job.employment_type ? `**Dienstverband:** ${job.employment_type}` : ''}
${job.salary ? `**Salaris:** ${job.salary}` : ''}
${job.published_at ? `**Geplaatst:** ${new Date(job.published_at).toLocaleDateString('nl-NL')}` : ''}
${job.end_date ? `**Geldig tot:** ${new Date(job.end_date).toLocaleDateString('nl-NL')}` : ''}

---

${cleanDescription}

---

*Bron: ${tenant.name} (${tenant.domain})*
${job.url ? `*Solliciteer: ${job.url}*` : ''}
`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
