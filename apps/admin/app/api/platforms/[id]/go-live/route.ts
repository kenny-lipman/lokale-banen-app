import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { revalidatePublicSite } from "@/lib/services/public-site-revalidate.service"

export const dynamic = "force-dynamic"

const MIN_APPROVED_VACANCIES = 10

async function postHandler(
  _request: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()

    // 1. Load current state to validate required checks server-side.
    // Cast to any — generated types do not yet reflect new platform columns.
    const { data: platformRow, error: loadErr } = await (supabase as any)
      .from("platforms")
      .select(
        "id, is_public, domain, primary_color, hero_title, seo_description, about_text",
      )
      .eq("id", id)
      .single()

    if (loadErr || !platformRow) {
      return NextResponse.json(
        { error: "Platform niet gevonden" },
        { status: 404 },
      )
    }

    const platform = platformRow as {
      id: string
      is_public: boolean | null
      domain: string | null
      primary_color: string | null
      hero_title: string | null
      seo_description: string | null
      about_text: string | null
    }

    const hasValue = (v: string | null | undefined) =>
      typeof v === "string" && v.trim().length > 0

    const { count: approvedCount } = await supabase
      .from("job_postings")
      .select("id", { count: "exact", head: true })
      .eq("platform_id", id)
      .eq("review_status", "approved")

    const missing: string[] = []
    if (!hasValue(platform.domain)) missing.push("domain")
    if (!hasValue(platform.primary_color)) missing.push("primary_color")
    if (!hasValue(platform.hero_title)) missing.push("hero_title")
    if (!hasValue(platform.seo_description)) missing.push("seo_description")
    if (!hasValue(platform.about_text)) missing.push("about_text")
    if ((approvedCount ?? 0) < MIN_APPROVED_VACANCIES) {
      missing.push(`min_approved_vacancies (${approvedCount ?? 0} < ${MIN_APPROVED_VACANCIES})`)
    }

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Platform is nog niet klaar voor publicatie",
          details: { missing_checks: missing },
          code: "GO_LIVE_REQUIREMENTS_NOT_MET",
        },
        { status: 409 },
      )
    }

    // 2. Flip is_public + published_at atomically.
    const nowIso = new Date().toISOString()
    const { data: updated, error: updateErr } = await (supabase as any)
      .from("platforms")
      .update({
        is_public: true,
        published_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json(
        { error: "Fout bij publiceren", details: updateErr.message },
        { status: 500 },
      )
    }

    // 3. Best-effort cache revalidation on the public-sites app.
    const revalidate = await revalidatePublicSite({ platformIds: [id] })
    if (!revalidate.ok && !revalidate.skipped) {
      console.warn(`[go-live] revalidate failed for platform ${id}:`, revalidate.error)
    }

    const { count: freshCount } = await supabase
      .from("job_postings")
      .select("id", { count: "exact", head: true })
      .eq("platform_id", id)
      .eq("review_status", "approved")

    return NextResponse.json({
      data: { ...updated, approved_count: freshCount ?? 0 },
      message: "Platform is live",
      revalidate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
