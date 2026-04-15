import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

const MIN_APPROVED_VACANCIES = 10

type CheckKey =
  | "domain"
  | "primary_color"
  | "logo_url"
  | "hero_title"
  | "seo_description"
  | "min_approved_vacancies"
  | "about_text"

interface CheckItem {
  key: CheckKey
  label: string
  required: boolean
  passed: boolean
  value?: string | number | null
}

async function getHandler(
  _request: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()

    // Cast to any — generated types do not yet reflect new platform columns.
    const { data: platformRow, error } = await (supabase as any)
      .from("platforms")
      .select(
        "id, is_public, published_at, domain, primary_color, logo_url, hero_title, seo_description, about_text",
      )
      .eq("id", id)
      .single()

    if (error || !platformRow) {
      return NextResponse.json(
        { error: "Platform niet gevonden" },
        { status: 404 },
      )
    }

    const platform = platformRow as {
      id: string
      is_public: boolean | null
      published_at: string | null
      domain: string | null
      primary_color: string | null
      logo_url: string | null
      hero_title: string | null
      seo_description: string | null
      about_text: string | null
    }

    // Approved vacancy count — mirrors the count used in the platforms list UI
    // so numbers match what Luc/Kay see on the overview page.
    const { count: approvedCount } = await supabase
      .from("job_postings")
      .select("id", { count: "exact", head: true })
      .eq("platform_id", id)
      .eq("review_status", "approved")

    const vacancyCount = approvedCount ?? 0

    const hasValue = (v: string | null | undefined) =>
      typeof v === "string" && v.trim().length > 0

    const checks: CheckItem[] = [
      {
        key: "domain",
        label: "Domain gezet",
        required: true,
        passed: hasValue(platform.domain),
        value: platform.domain,
      },
      {
        key: "primary_color",
        label: "Primary color",
        required: true,
        passed: hasValue(platform.primary_color),
        value: platform.primary_color,
      },
      {
        key: "logo_url",
        label: "Logo url aanwezig",
        required: false,
        passed: hasValue(platform.logo_url),
        value: platform.logo_url,
      },
      {
        key: "hero_title",
        label: "Hero title",
        required: true,
        passed: hasValue(platform.hero_title),
        value: platform.hero_title,
      },
      {
        key: "seo_description",
        label: "SEO description",
        required: true,
        passed: hasValue(platform.seo_description),
        value: platform.seo_description,
      },
      {
        key: "min_approved_vacancies",
        label: `Min. ${MIN_APPROVED_VACANCIES} approved vacatures`,
        required: true,
        passed: vacancyCount >= MIN_APPROVED_VACANCIES,
        value: vacancyCount,
      },
      {
        key: "about_text",
        label: "About text ingevuld",
        required: true,
        passed: hasValue(platform.about_text),
      },
    ]

    const allRequiredPassed = checks
      .filter((c) => c.required)
      .every((c) => c.passed)

    return NextResponse.json({
      data: {
        platform_id: platform.id,
        is_public: platform.is_public ?? false,
        published_at: platform.published_at,
        all_required_passed: allRequiredPassed,
        approved_vacancy_count: vacancyCount,
        checks,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
