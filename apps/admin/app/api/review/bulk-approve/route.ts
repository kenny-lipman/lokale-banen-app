import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

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

    // Step 1: Auto-assign platform_id via postcode_platform_lookup for jobs without platform
    const { error: platformAssignError } = await supabase.rpc("exec_sql", {
      sql: `
        UPDATE job_postings jp
        SET platform_id = (
          SELECT ppl.platform_id
          FROM postcode_platform_lookup ppl
          WHERE ppl.postcode = left(jp.zipcode, 4)
          ORDER BY ppl.distance ASC
          LIMIT 1
        )
        WHERE jp.id = ANY(ARRAY[${validIds.map((id) => `'${id}'::uuid`).join(",")}])
          AND jp.platform_id IS NULL
          AND jp.zipcode IS NOT NULL
      `,
    }).catch(() => ({ error: null }))

    // Fallback: direct update if rpc doesn't exist
    if (platformAssignError) {
      // Try direct approach: fetch jobs without platform and update them
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
            .select("platform_id")
            .eq("postcode", postcode)
            .order("distance", { ascending: true })
            .limit(1)

          if (lookup && lookup.length > 0) {
            await supabase
              .from("job_postings")
              .update({ platform_id: lookup[0].platform_id })
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

          // Step 3: Insert job_posting_platforms junction record
          const { data: currentJob } = await supabase
            .from("job_postings")
            .select("platform_id")
            .eq("id", job.id)
            .single()

          if (currentJob?.platform_id) {
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

    return NextResponse.json({
      approved,
      errors,
      message: `${approved} vacature(s) goedgekeurd${errors.length > 0 ? `, ${errors.length} fout(en)` : ""}`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
