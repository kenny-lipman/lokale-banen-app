import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { revalidatePublicSite } from "@/lib/services/public-site-revalidate.service"
import {
  submitToIndexNow,
  resolvePlatformHost,
  buildVacatureUrlList,
} from "@/lib/services/indexnow.service"

export const dynamic = "force-dynamic"

async function postHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: "No job posting IDs provided" },
        { status: 400 }
      )
    }

    // Capture platform_ids and slugs before the update so we can invalidate
    // cache for pages that were previously serving these jobs.
    const { data: previouslyApproved } = await supabase
      .from("job_postings")
      .select("platform_id, slug")
      .in("id", ids)
      .eq("review_status", "approved")

    const { data, error } = await supabase
      .from("job_postings")
      .update({
        review_status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: authResult.user?.id || null,
        published_at: null,
      })
      .in("id", ids)
      .select("id")

    if (error) {
      return NextResponse.json(
        { error: "Failed to reject job postings", details: error.message },
        { status: 500 }
      )
    }

    const rejected = data?.length || 0

    const affectedPlatformIds = new Set<string>()
    const affectedSlugs: string[] = []
    // Per-platform slug buckets for IndexNow batch submit.
    const slugsByPlatform = new Map<string, string[]>()
    for (const row of previouslyApproved ?? []) {
      if (row.platform_id) {
        affectedPlatformIds.add(row.platform_id)
        if (row.slug) {
          const bucket = slugsByPlatform.get(row.platform_id) ?? []
          bucket.push(row.slug)
          slugsByPlatform.set(row.platform_id, bucket)
        }
      }
      if (row.slug) affectedSlugs.push(row.slug)
    }

    const revalidateResult = await revalidatePublicSite({
      platformIds: Array.from(affectedPlatformIds),
      jobSlugs: affectedSlugs,
    })

    // IndexNow ping — tells search engines those URLs are no longer valid.
    // Best-effort, never throws; logged per platform.
    if (slugsByPlatform.size > 0) {
      const { data: platforms } = await supabase
        .from("platforms")
        .select("id, domain, preview_domain, indexnow_key")
        .in("id", Array.from(slugsByPlatform.keys()))

      for (const platform of platforms ?? []) {
        const slugs = slugsByPlatform.get(platform.id) ?? []
        const host = resolvePlatformHost(platform)
        if (!host || !platform.indexnow_key) {
          console.warn(
            `[IndexNow] bulk-reject skipped platform=${platform.id} — missing domain or key (slugs=${slugs.length})`
          )
          continue
        }
        const result = await submitToIndexNow({
          host,
          key: platform.indexnow_key,
          urlList: buildVacatureUrlList(host, slugs),
        })
        console.log(
          `[IndexNow] bulk-reject platform=${platform.id} host=${host} ok=${result.ok} status=${result.status ?? "n/a"} submitted=${result.submitted}`
        )
      }
    }

    return NextResponse.json({
      rejected,
      revalidated: revalidateResult.ok,
      message: `${rejected} vacature(s) afgekeurd`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
