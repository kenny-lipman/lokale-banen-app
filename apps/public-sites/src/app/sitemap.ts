import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase'
import { getCitiesWithJobCounts } from '@/lib/queries'

/**
 * Dynamic sitemap generation per tenant.
 * Fetches all approved + published jobs with slugs for the resolved tenant.
 * Google limits: max 50,000 URLs per sitemap, max 50 MB uncompressed.
 *
 * Master tenant (lokalebanen.nl): returns a sitemap-index pointing to all
 * regional sub-sitemaps + master static pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const supabase = createPublicClient()

  // Resolve tenant by domain or preview_domain
  const { data: tenant } = await supabase
    .from('platforms')
    .select('id, tier')
    .or(`domain.eq.${host},preview_domain.eq.${host}`)
    .eq('is_public', true)
    .maybeSingle()

  if (!tenant) {
    return [{ url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }]
  }

  // ── Master aggregator: sitemap-index pointing to 24 regional sub-sitemaps ──
  if (tenant.tier === 'master') {
    const { data: platforms } = await supabase
      .from('platforms')
      .select('domain, preview_domain')
      .eq('tier', 'free')
      .eq('is_public', true)

    const entries: MetadataRoute.Sitemap = [
      { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
      { url: `${baseUrl}/vacatures`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
      { url: `${baseUrl}/over-ons`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
      { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
      { url: `${baseUrl}/voorwaarden`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ]

    // Add sitemap URLs for all regional platforms (link to their sub-sitemaps)
    if (platforms) {
      for (const p of platforms) {
        const platHost = p.domain ?? p.preview_domain
        if (platHost) {
          entries.push({
            url: `https://${platHost}/sitemap.xml`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
          })
        }
      }
    }

    return entries
  }

  // Fetch all approved, published job slugs with dates for this tenant
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('slug, published_at')
    .eq('platform_id', tenant.id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50000)

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    { url: `${baseUrl}/over-ons`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/voorwaarden`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // City landing pages
  const cities = await getCitiesWithJobCounts(tenant.id)
  for (const { slug } of cities) {
    entries.push({
      url: `${baseUrl}/vacatures/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }

  // Company pages (companies with active jobs on this tenant)
  const { data: companySlugs } = await supabase
    .from('job_postings')
    .select('companies!company_id ( slug )')
    .eq('platform_id', tenant.id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('company_id', 'is', null)
    .limit(50000)

  if (companySlugs) {
    const uniqueSlugs = new Set<string>()
    for (const row of companySlugs as Record<string, unknown>[]) {
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies
      const slug = (company as { slug?: string } | null)?.slug
      if (slug && !uniqueSlugs.has(slug)) {
        uniqueSlugs.add(slug)
        entries.push({
          url: `${baseUrl}/bedrijf/${slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    }
  }

  if (jobs) {
    for (const job of jobs) {
      const publishedDate = new Date(job.published_at)
      const daysSincePublished = Math.floor(
        (Date.now() - publishedDate.getTime()) / 86400000
      )

      entries.push({
        url: `${baseUrl}/vacature/${job.slug}`,
        lastModified: publishedDate,
        changeFrequency: daysSincePublished < 7 ? 'daily' : 'weekly',
        priority: daysSincePublished < 3 ? 0.9 : daysSincePublished < 14 ? 0.7 : 0.5,
      })
    }
  }

  return entries
}
