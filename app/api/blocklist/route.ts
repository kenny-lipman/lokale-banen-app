import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"
import { BlockType, detectBlockType, detectionToDbFormat } from "@/lib/blocklist-detection"
import {
  getCompanyDomain,
  getContactEmail,
  companyExists,
  contactExists,
  createCompanyBlock,
  createDomainBlock,
  createEmailBlock
} from "@/lib/blocklist-helpers"

// Simplified schema for the new UI
const createBlocklistEntrySchema = z.object({
  block_type: z.enum(["email", "company", "domain", "contact"]),
  value: z.string().optional(), // For email/domain
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  reason: z.string().trim().min(1, "Reason is required"),
  is_active: z.boolean().optional().default(true)
})

// Legacy schema for backward compatibility
const legacyBlocklistEntrySchema = z.object({
  type: z.enum(["email", "domain"]),
  blocklist_level: z.enum(["organization", "contact", "domain"]).optional().default("domain"),
  value: z.string().trim().toLowerCase(),
  reason: z.string().trim().min(1, "Reason is required"),
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
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

    const body = await req.json()

    // Check if it's the new format or legacy format
    const isNewFormat = 'block_type' in body

    if (isNewFormat) {
      // Handle new simplified format
      const validationResult = createBlocklistEntrySchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validationResult.error.flatten() },
          { status: 400 }
        )
      }

      const { block_type, value, company_id, contact_id, reason, is_active } = validationResult.data

      // Process based on block_type
      let type: 'email' | 'domain'
      let blocklist_level: 'organization' | 'contact' | 'domain'
      let final_value: string | null = null

      switch (block_type) {
        case 'email':
          if (!value) {
            return NextResponse.json(
              { error: "Email value is required" },
              { status: 400 }
            )
          }
          type = 'email'
          blocklist_level = 'contact'
          final_value = value.toLowerCase()
          break

        case 'company':
          if (!company_id) {
            return NextResponse.json(
              { error: "Company selection is required" },
              { status: 400 }
            )
          }
          // Verify company exists and get domain
          if (!(await companyExists(company_id))) {
            return NextResponse.json(
              { error: "Company not found" },
              { status: 404 }
            )
          }
          type = 'domain'
          blocklist_level = 'organization'
          final_value = await getCompanyDomain(company_id)
          break

        case 'domain':
          if (!value) {
            return NextResponse.json(
              { error: "Domain value is required" },
              { status: 400 }
            )
          }
          type = 'domain'
          blocklist_level = 'domain'
          // Clean domain - remove @ if present
          final_value = value.replace('@', '').toLowerCase()
          break

        case 'contact':
          if (!contact_id) {
            return NextResponse.json(
              { error: "Contact selection is required" },
              { status: 400 }
            )
          }
          // Verify contact exists and get email
          if (!(await contactExists(contact_id))) {
            return NextResponse.json(
              { error: "Contact not found" },
              { status: 404 }
            )
          }
          const email = await getContactEmail(contact_id)
          if (!email) {
            return NextResponse.json(
              { error: "Contact has no email address" },
              { status: 400 }
            )
          }
          type = 'email'
          blocklist_level = 'contact'
          final_value = email.toLowerCase()
          break

        default:
          return NextResponse.json(
            { error: "Invalid block type" },
            { status: 400 }
          )
      }

      // Check for duplicates
      const { data: existing } = await supabase
        .from('blocklist_entries')
        .select('id')
        .eq('type', type)
        .eq('value', final_value)
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
          blocklist_level,
          value: final_value,
          reason,
          company_id: company_id || null,
          contact_id: contact_id || null,
          is_active
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

      return NextResponse.json(data, { status: 201 })

    } else {
      // Handle legacy format for backward compatibility
      const validationResult = legacyBlocklistEntrySchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validationResult.error.flatten() },
          { status: 400 }
        )
      }

      const { type, blocklist_level, value, reason, company_id, contact_id, is_active } = validationResult.data

      // Validate based on type
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
          )
        }
      } else if (type === 'domain') {
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
          blocklist_level,
          value,
          reason,
          company_id,
          contact_id,
          is_active
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

      return NextResponse.json(data, { status: 201 })
    }

  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
export const GET = withAuth(blocklistGetHandler)
