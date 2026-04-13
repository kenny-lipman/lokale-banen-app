import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase'

/**
 * Dynamic sitemap generation per tenant.
 * Fetches all approved + published jobs with slugs for the resolved tenant.
 * Google limits: max 50,000 URLs per sitemap, max 50 MB uncompressed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const supabase = createPublicClient()

  // Resolve tenant by domain
  const { data: tenant } = await supabase
    .from('platforms')
    .select('id')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  if (!tenant) {
    return [{ url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }]
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
