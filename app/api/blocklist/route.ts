import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"

const createBlocklistEntrySchema = z.object({
  type: z.enum(["email", "domain"]),
  value: z.string().trim().toLowerCase(),
  reason: z.string().trim().min(1, "Reason is required"),
  is_active: z.boolean().optional().default(true)
})

async function blocklistGetHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const supabase = supabaseService.serviceClient

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') as 'email' | 'domain' | null
    const isActive = searchParams.get('is_active')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    const offset = (page - 1) * limit

    // Build the query
    let query = supabase
      .from('blocklist_entries')
      .select('*', { count: 'exact' })

    // Apply filters
    if (search) {
      query = query.or(`value.ilike.%${search}%,reason.ilike.%${search}%`)
    }

    if (type) {
      query = query.eq('type', type)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching blocklist entries:", error)
      return NextResponse.json(
        { error: "Failed to fetch blocklist entries" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseService.serviceClient

    // Note: Authentication temporarily disabled to match other API routes
    // TODO: Implement proper server-side auth when needed

    const body = await req.json()

    // Validate the request body
    const validationResult = createBlocklistEntrySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { type, value, reason, is_active } = validationResult.data

    // Additional validation based on type
    if (type === 'email') {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        )
      }
    } else if (type === 'domain') {
      // Basic domain validation
      const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
      if (!domainRegex.test(value)) {
        return NextResponse.json(
          { error: "Invalid domain format" },
          { status: 400 }
        )
      }
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('blocklist_entries')
      .select('id')
      .eq('type', type)
      .eq('value', value)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `This ${type} is already in the blocklist` },
        { status: 409 }
      )
    }

    // Insert the new blocklist entry
    const { data, error } = await supabase
      .from('blocklist_entries')
      .insert({
        type,
        value,
        reason,
        is_active
        // created_by: temporarily disabled
      })
      .select('*')
      .single()

    if (error) {
      console.error("Error creating blocklist entry:", error)
      return NextResponse.json(
        { error: "Failed to create blocklist entry" },
        { status: 500 }
      )
    }

    // TODO: Trigger sync to external platforms (Instantly, Pipedrive)
    // This will be implemented when the sync services are ready

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
export const GET = withAuth(blocklistGetHandler)
