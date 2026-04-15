export interface RevalidateRequest {
  platformIds?: string[]
  jobSlugs?: string[]
  companySlugs?: { platformId: string; slug: string }[]
  paths?: string[]
}

export interface RevalidateResult {
  ok: boolean
  skipped?: boolean
  status?: number
  tags?: string[]
  error?: string
}

const PUBLIC_SITES_URL =
  process.env.PUBLIC_SITES_URL ?? 'https://lokale-banen-public.vercel.app'

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

export async function revalidatePublicSite({
  platformIds = [],
  jobSlugs = [],
  companySlugs = [],
  paths = [],
}: RevalidateRequest): Promise<RevalidateResult> {
  const tags = new Set<string>()

  for (const id of platformIds) {
    tags.add(`platform:${id}`)
    tags.add(`jobs:${id}`)
    tags.add(`sitemap:${id}`)
  }
  for (const slug of jobSlugs) {
    tags.add(`job:${slug}`)
  }
  for (const { platformId, slug } of companySlugs) {
    tags.add(`company:${platformId}:${slug}`)
  }

  if (!REVALIDATE_SECRET) {
    console.warn(
      '[revalidatePublicSite] REVALIDATE_SECRET not set — skipping cache invalidation'
    )
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(`${PUBLIC_SITES_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': REVALIDATE_SECRET,
      },
      body: JSON.stringify({
        tags: Array.from(tags),
        paths,
      }),
    })

    if (!res.ok) {
      console.error(
        `[revalidatePublicSite] public-sites responded ${res.status}`,
        await res.text().catch(() => '')
      )
      return { ok: false, status: res.status }
    }

    const data = await res.json()
    return { ok: true, tags: data.tags }
  } catch (err) {
    console.error('[revalidatePublicSite] fetch error', err)
    return { ok: false, error: String(err) }
  }
}
