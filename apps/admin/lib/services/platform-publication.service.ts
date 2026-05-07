/**
 * Shared publication flow voor platforms — gebruikt door go-live, take-offline,
 * en de PATCH-toggle in /api/review/platforms/[id]. Eén plek voor:
 *   - readiness-checks (validatePublication)
 *   - publish-flow (immutable published_at, host-cache bust)
 *   - unpublish-flow (cache bust)
 *
 * Domain-routing wordt door Vercel zelf afgehandeld via project-domains —
 * géén handmatige alias-provisioning meer nodig.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  revalidatePublicSite,
  type RevalidateResult,
} from "./public-site-revalidate.service"

export const MIN_APPROVED_VACANCIES = 10

export type CheckKey =
  | "host"
  | "primary_color"
  | "logo_url"
  | "hero_title"
  | "seo_description"
  | "min_approved_vacancies"
  | "about_text"

export interface CheckItem {
  key: CheckKey
  label: string
  required: boolean
  passed: boolean
  value?: string | number | null
}

export interface ValidatePublicationResult {
  platform_id: string
  is_public: boolean
  published_at: string | null
  all_required_passed: boolean
  approved_vacancy_count: number
  checks: CheckItem[]
  /** Hosts uit dezelfde DB-snapshot als de checks — voorkomt TOCTOU. */
  domain: string | null
  preview_domain: string | null
}

const hasValue = (v: string | null | undefined): boolean =>
  typeof v === "string" && v.trim().length > 0

/**
 * Run alle go-live checks zonder side-effects. Ook de bron van waarheid voor
 * `failedRequiredKeys()` zodat publishPlatform exact dezelfde definitie van
 * "klaar voor publicatie" hanteert als de check-endpoint.
 */
export async function validatePublication(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  platformId: string,
): Promise<ValidatePublicationResult | null> {
  const { data: platform } = await supabase
    .from("platforms")
    .select(
      "id, is_public, published_at, domain, preview_domain, primary_color, logo_url, hero_title, seo_description, about_text",
    )
    .eq("id", platformId)
    .single()

  if (!platform) return null

  const { count: approvedCount } = await supabase
    .from("job_postings")
    .select("id", { count: "exact", head: true })
    .eq("platform_id", platformId)
    .eq("review_status", "approved")

  const vacancyCount = approvedCount ?? 0

  const hostValue = platform.domain || platform.preview_domain
  const checks: CheckItem[] = [
    {
      key: "host",
      label: "Domein of preview-domein gezet",
      required: true,
      passed: hasValue(platform.domain) || hasValue(platform.preview_domain),
      value: hostValue,
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

  return {
    platform_id: platform.id,
    is_public: platform.is_public ?? false,
    published_at: platform.published_at,
    all_required_passed: allRequiredPassed,
    approved_vacancy_count: vacancyCount,
    checks,
    domain: platform.domain ?? null,
    preview_domain: platform.preview_domain ?? null,
  }
}

/** Lijst van required-keys die nog open staan. Lege array = klaar. */
export function failedRequiredKeys(result: ValidatePublicationResult): CheckKey[] {
  return result.checks
    .filter((c) => c.required && !c.passed)
    .map((c) => c.key)
}

export interface PublishPlatformResult {
  ok: boolean
  /** HTTP status hint — 200 ok, 409 niet-klaar, 500 db. */
  status: number
  error?: string
  code?: string
  missing?: CheckKey[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  revalidate?: RevalidateResult
  approvedCount?: number
}

/**
 * Volledige publish-flow:
 *   1. validatePublication — alle required checks groen?
 *   2. is_public=true; published_at alleen op first publish
 *   3. revalidatePublicSite met host-tags
 *
 * `approvedCount` wordt apart geteld zodat de caller hem in de response
 * kan opnemen (UI toont 'em na publish).
 */
export async function publishPlatform(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  platformId: string,
): Promise<PublishPlatformResult> {
  const validation = await validatePublication(supabase, platformId)
  if (!validation) {
    return { ok: false, status: 404, error: "Platform niet gevonden" }
  }

  const missing = failedRequiredKeys(validation)
  if (missing.length > 0) {
    return {
      ok: false,
      status: 409,
      code: "GO_LIVE_REQUIREMENTS_NOT_MET",
      error: "Platform is nog niet klaar voor publicatie",
      missing,
    }
  }

  // Atomic publish via RPC — één UPDATE met COALESCE op published_at zodat
  // parallelle publishes niet allebei een nieuwe timestamp kunnen schrijven.
  const { data: updated, error: updateErr } = await supabase.rpc(
    "publish_platform_atomic",
    { p_id: platformId },
  )

  if (updateErr || !updated) {
    return {
      ok: false,
      status: 500,
      error: updateErr?.message ?? "Update mislukt",
    }
  }

  // Tag-based revalidation; geen `paths` — andere tenants moeten hun cache
  // behouden.
  const hosts = [updated.preview_domain, updated.domain].filter(
    (h: unknown): h is string => typeof h === "string" && h.length > 0,
  )
  const revalidate = await revalidatePublicSite({
    platformIds: [platformId],
    hosts,
  })
  if (!revalidate.ok && !revalidate.skipped) {
    console.warn(
      `[publishPlatform] revalidate failed for ${platformId}:`,
      revalidate.error,
    )
  }

  const { count: freshCount } = await supabase
    .from("job_postings")
    .select("id", { count: "exact", head: true })
    .eq("platform_id", platformId)
    .eq("review_status", "approved")

  return {
    ok: true,
    status: 200,
    data: updated,
    revalidate,
    approvedCount: freshCount ?? 0,
  }
}

export interface UnpublishPlatformResult {
  ok: boolean
  status: number
  error?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  revalidate?: RevalidateResult
  approvedCount?: number
}

/**
 * Offline-flow:
 *   1. is_public=false (geen content-checks — offline halen moet altijd kunnen)
 *   2. Cache-bust voor host-tags zodat de site direct "Domein niet gevonden"
 *      toont i.p.v. tot 1u stale tenant te serveren.
 *
 * `published_at` blijft staan (immutable na first publish). Domain-routing
 * blijft actief via project-domain — hoeft niets aan veranderd te worden.
 */
export async function unpublishPlatform(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  platformId: string,
): Promise<UnpublishPlatformResult> {
  // No-op filter: als het platform al offline is, slaan we de UPDATE +
  // revalidate over. Spaart een onnodige cache-bust en voorkomt dat
  // dubbel-klikken een DB-write triggert.
  const { data: pre } = await supabase
    .from("platforms")
    .select("is_public")
    .eq("id", platformId)
    .single()

  if (!pre) {
    return { ok: false, status: 404, error: "Platform niet gevonden" }
  }

  if (pre.is_public === false) {
    const [{ data: current }, { count: noopCount }] = await Promise.all([
      supabase.from("platforms").select("*").eq("id", platformId).single(),
      supabase
        .from("job_postings")
        .select("id", { count: "exact", head: true })
        .eq("platform_id", platformId)
        .eq("review_status", "approved"),
    ])
    return {
      ok: true,
      status: 200,
      data: current,
      approvedCount: noopCount ?? 0,
    }
  }

  const nowIso = new Date().toISOString()
  const { data: updated, error: updateErr } = await supabase
    .from("platforms")
    .update({ is_public: false, updated_at: nowIso })
    .eq("id", platformId)
    .select()
    .single()

  if (updateErr || !updated) {
    return {
      ok: false,
      status: updateErr ? 500 : 404,
      error: updateErr?.message ?? "Platform niet gevonden",
    }
  }

  const hosts = [updated.preview_domain, updated.domain].filter(
    (h: unknown): h is string => typeof h === "string" && h.length > 0,
  )
  const revalidate = await revalidatePublicSite({
    platformIds: [platformId],
    hosts,
  })
  if (!revalidate.ok && !revalidate.skipped) {
    console.warn(
      `[unpublishPlatform] revalidate failed for ${platformId}:`,
      revalidate.error,
    )
  }

  const { count: freshCount } = await supabase
    .from("job_postings")
    .select("id", { count: "exact", head: true })
    .eq("platform_id", platformId)
    .eq("review_status", "approved")

  return {
    ok: true,
    status: 200,
    data: updated,
    revalidate,
    approvedCount: freshCount ?? 0,
  }
}
