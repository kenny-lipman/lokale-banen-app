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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function postHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const body = await request.json()
    const { ids, platformId } = body as { ids: string[]; platformId?: string }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: "No job posting IDs provided" },
        { status: 400 }
      )
    }

    // Validate UUIDs to prevent SQL injection
    const validIds = ids.filter((id: string) => UUID_REGEX.test(id))
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "Geen geldige IDs" },
        { status: 400 }
      )
    }

    const errors: string[] = []
    let approved = 0

    // Step 1: Auto-assign platform_id via postcode_platform_lookup for jobs without platform.
    // postcode_platform_lookup stores regio_platform (text), so we need to join
    // with the platforms table to get the UUID.
    const { data: jobsNoPlatform } = await supabase
      .from("job_postings")
      .select("id, zipcode")
      .in("id", validIds)
      .is("platform_id", null)
      .not("zipcode", "is", null)

    if (jobsNoPlatform && jobsNoPlatform.length > 0) {
      for (const job of jobsNoPlatform) {
        const postcode = job.zipcode?.substring(0, 4)
        if (!postcode) continue

        const { data: lookup } = await supabase
          .from("postcode_platform_lookup")
          .select("regio_platform")
          .eq("postcode", postcode)
          .order("distance", { ascending: true })
          .limit(1)

        if (lookup && lookup.length > 0) {
          const { data: platformRow } = await supabase
            .from("platforms")
            .select("id")
            .eq("regio_platform", lookup[0].regio_platform)
            .limit(1)
            .maybeSingle()

          if (platformRow) {
            await supabase
              .from("job_postings")
              .update({ platform_id: platformRow.id })
              .eq("id", job.id)
          }
        }
      }
    }

    // Step 2: Update review_status, published_at, reviewed_at, and generate slug
    const { data: jobsToApprove, error: fetchError } = await supabase
      .from("job_postings")
      .select("id, title, city")
      .in("id", validIds)

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch job postings", details: fetchError.message },
        { status: 500 }
      )
    }

    const approvedSlugs: string[] = []
    const affectedPlatformIds = new Set<string>()
    // Per-platform slug buckets for IndexNow batch submit.
    const slugsByPlatform = new Map<string, string[]>()

    for (const job of jobsToApprove || []) {
      try {
        // Generate slug: title + city + short id
        const titlePart = (job.title || "vacature").substring(0, 60).toLowerCase()
        const cityPart = (job.city || "onbekend").toLowerCase()
        const idPart = job.id.replace(/-/g, "").substring(0, 8)
        const rawSlug = `${titlePart}-${cityPart}-${idPart}`
        const slug = rawSlug
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")

        const { error: updateError } = await supabase
          .from("job_postings")
          .update({
            review_status: "approved",
            published_at: new Date().toISOString(),
            reviewed_at: new Date().toISOString(),
            reviewed_by: authResult.user?.id || null,
            slug,
          })
          .eq("id", job.id)

        if (updateError) {
          errors.push(`${job.id}: ${updateError.message}`)
        } else {
          approved++
          approvedSlugs.push(slug)

          // Step 3: Insert job_posting_platforms junction record
          const { data: currentJob } = await supabase
            .from("job_postings")
            .select("platform_id")
            .eq("id", job.id)
            .single()

          if (currentJob?.platform_id) {
            affectedPlatformIds.add(currentJob.platform_id)
            const bucket = slugsByPlatform.get(currentJob.platform_id) ?? []
            bucket.push(slug)
            slugsByPlatform.set(currentJob.platform_id, bucket)
            await supabase
              .from("job_posting_platforms")
              .upsert(
                {
                  job_posting_id: job.id,
                  platform_id: currentJob.platform_id,
                  is_primary: true,
                },
                { onConflict: "job_posting_id,platform_id" }
              )
              .catch(() => {
                // Ignore if upsert fails (e.g., no unique constraint)
              })
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        errors.push(`${job.id}: ${msg}`)
      }
    }

    // Invalidate public-site cache for affected platforms and new job slugs
    const revalidateResult = await revalidatePublicSite({
      platformIds: Array.from(affectedPlatformIds),
      jobSlugs: approvedSlugs,
    })

    // IndexNow ping — one submit per platform with all that platform's new slugs.
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
            `[IndexNow] bulk-approve skipped platform=${platform.id} — missing domain or key (slugs=${slugs.length})`
          )
          continue
        }
        const result = await submitToIndexNow({
          host,
          key: platform.indexnow_key,
          urlList: buildVacatureUrlList(host, slugs),
        })
        console.log(
          `[IndexNow] bulk-approve platform=${platform.id} host=${host} ok=${result.ok} status=${result.status ?? "n/a"} submitted=${result.submitted}`
        )
      }
    }

    return NextResponse.json({
      approved,
      errors,
      revalidated: revalidateResult.ok,
      message: `${approved} vacature(s) goedgekeurd${errors.length > 0 ? `, ${errors.length} fout(en)` : ""}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
