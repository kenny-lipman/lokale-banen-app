import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase'

/**
 * Dynamic sitemap generation per tenant.
 * Groups jobs by month for sitemap index pattern.
 * Prioritizes recent jobs with higher changefreq.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const supabase = createPublicClient()

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('platforms')
    .select('id')
    .eq('domain', host)
    .eq('is_public', true)
    .single()

  if (!tenant) {
    return [{ url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }]
  }

  // Fetch all approved, published job slugs with dates
  const { data: jobs } = await supabase
    .from('job_postings')
    .select('slug, published_at, id')
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5000)

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/sign-in`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/sign-up`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  if (jobs) {
    for (const job of jobs) {
      const publishedDate = new Date(job.published_at)
      const daysSincePublished = Math.floor(
        (Date.now() - publishedDate.getTime()) / 86400000
      )

      entries.push({
        url: `${baseUrl}/vacature/${job.slug || job.id}`,
        lastModified: publishedDate,
        changeFrequency: daysSincePublished < 7 ? 'daily' : 'weekly',
        priority: daysSincePublished < 3 ? 0.9 : daysSincePublished < 14 ? 0.7 : 0.5,
      })
    }
  }

  return entries
}
