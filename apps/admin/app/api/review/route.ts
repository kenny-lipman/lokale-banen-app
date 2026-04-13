import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

async function getHandler(request: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const status = searchParams.get("status") || "pending"
    const platformId = searchParams.get("platformId") || ""
    const search = searchParams.get("search") || ""

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from("job_postings")
      .select(
        `id, title, city, salary, employment, review_status, scraped_at, zipcode, platform_id, slug, published_at,
         companies:company_id (id, name, logo_url, city)`,
        { count: "exact" }
      )

    // Status filter
    if (status && status !== "all") {
      query = query.eq("review_status", status)
    }

    // Platform filter
    if (platformId) {
      query = query.eq("platform_id", platformId)
    }

    // Search filter
    if (search) {
      query = query.ilike("title", `%${search}%`)
    }

    // Order and paginate
    query = query
      .order("scraped_at", { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch job postings", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
