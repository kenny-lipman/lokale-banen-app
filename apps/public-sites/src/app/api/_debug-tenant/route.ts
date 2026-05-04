/**
 * TIJDELIJKE debug-route — verwijderen zodra Bollenstreek/Rotterdam-bug is opgelost.
 * Geeft de tenant-lookup-result voor de huidige host als JSON.
 */
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { getTenantByHost } from "@/lib/tenant"
import { createPublicClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const h = await headers()
  const tenantHost = h.get("x-tenant-host") ?? null
  const rawHost = h.get("host") ?? null
  const target = tenantHost || rawHost || "unknown"

  // 1. Cached lookup (zoals page.tsx doet)
  let cachedResult: unknown
  try {
    cachedResult = await getTenantByHost(target)
  } catch (e) {
    cachedResult = { __error: String(e) }
  }

  // 2. Direct uncached query (als sanity check)
  const supabase = createPublicClient()
  const { data: directDomain, error: directDomainErr } = await supabase
    .from("platforms")
    .select("id, regio_platform, is_public")
    .eq("domain", target)
    .eq("is_public", true)
    .maybeSingle()
  const { data: directPreview, error: directPreviewErr } = await supabase
    .from("platforms")
    .select("id, regio_platform, is_public")
    .eq("preview_domain", target)
    .eq("is_public", true)
    .maybeSingle()

  return NextResponse.json({
    tenantHost,
    rawHost,
    target,
    cachedResult: cachedResult
      ? typeof cachedResult === "object" && cachedResult !== null && "name" in cachedResult
        ? { name: (cachedResult as { name: string }).name }
        : cachedResult
      : null,
    directDomain,
    directDomainErr: directDomainErr?.message ?? null,
    directPreview,
    directPreviewErr: directPreviewErr?.message ?? null,
  })
}
