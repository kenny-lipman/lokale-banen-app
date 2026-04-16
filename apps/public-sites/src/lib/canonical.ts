import { createPublicClient } from './supabase'

export interface CanonicalInfo {
  /** Platform id of the primary host for the job posting. */
  primaryPlatformId: string
  /** Primary hostname (production .nl when set, else preview Vercel domain). */
  primaryDomain: string
  /** Absolute canonical URL (https://<domain>/vacature/<slug>). */
  canonicalUrl: string
}

interface PlatformLite {
  id: string
  domain: string | null
  preview_domain: string | null
}

/**
 * Resolve the canonical URL for a job posting across multi-regio platforms.
 *
 * Strategy:
 *   1. Look up `job_posting_platforms` where `is_primary = true` and return that platform.
 *   2. Fallback to `job_postings.platform_id` (single-regio assumption).
 */
export async function getCanonicalInfo(
  jobPostingId: string,
  slug: string,
): Promise<CanonicalInfo | null> {
  const supabase = createPublicClient()

  let platform: PlatformLite | null = null

  // 1. Prefer explicit primary in junction
  const { data: primaryJunction } = await supabase
    .from('job_posting_platforms')
    .select('platform_id, platforms:platform_id ( id, domain, preview_domain )')
    .eq('job_posting_id', jobPostingId)
    .eq('is_primary', true)
    .maybeSingle()

  if (primaryJunction) {
    const rel = (primaryJunction as Record<string, unknown>).platforms
    platform = Array.isArray(rel)
      ? ((rel[0] as PlatformLite | undefined) ?? null)
      : ((rel as PlatformLite | null) ?? null)
  }

  // 2. Fallback: use the job_postings.platform_id
  if (!platform) {
    const { data: job } = await supabase
      .from('job_postings')
      .select('platforms:platform_id ( id, domain, preview_domain )')
      .eq('id', jobPostingId)
      .maybeSingle()

    if (job) {
      const rel = (job as Record<string, unknown>).platforms
      platform = Array.isArray(rel)
        ? ((rel[0] as PlatformLite | undefined) ?? null)
        : ((rel as PlatformLite | null) ?? null)
    }
  }

  if (!platform) return null

  // Prefer production .nl, fallback to preview Vercel domain
  const domain = platform.domain ?? platform.preview_domain
  if (!domain) return null

  return {
    primaryPlatformId: platform.id,
    primaryDomain: domain,
    canonicalUrl: `https://${domain}/vacature/${slug}`,
  }
}
