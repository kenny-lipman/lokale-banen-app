import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"
import { removeEntryFromBlocklist, deactivateBlocklistEntry } from "@/lib/blocklist-sync"
import { instantlyClient } from "@/lib/instantly-client"

const updateBlocklistEntrySchema = z.object({
  type: z.enum(["email", "domain"]).optional(),
  value: z.string().trim().toLowerCase().optional(),
  reason: z.string().trim().min(1, "Reason is required").optional(),
  is_active: z.boolean().optional()
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = supabaseService.serviceClient
    const { id } = params

    const { data, error } = await supabase
      .from('blocklist_entries')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Blocklist entry not found" },
          { status: 404 }
        )
      }
      console.error("Error fetching blocklist entry:", error)
      return NextResponse.json(
        { error: "Failed to fetch blocklist entry" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = supabaseService.serviceClient
    const { id } = params

    // Note: Authentication temporarily disabled to match other API routes
    // TODO: Implement proper server-side auth when needed

    const body = await req.json()

    // Validate the request body
    const validationResult = updateBlocklistEntrySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Additional validation if type or value is being updated
    if (updateData.value && updateData.type) {
      if (updateData.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(updateData.value)) {
          return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
          )
        }
      } else if (updateData.type === 'domain') {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
        if (!domainRegex.test(updateData.value)) {
          return NextResponse.json(
            { error: "Invalid domain format" },
            { status: 400 }
          )
        }
      }

      // Check for duplicates if value is being changed
      const { data: existing } = await supabase
        .from('blocklist_entries')
        .select('id')
        .eq('type', updateData.type)
        .eq('value', updateData.value)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: `This ${updateData.type} is already in the blocklist` },
          { status: 409 }
        )
      }
    }

    // Check if we're deactivating an entry
    if (updateData.is_active === false) {
      // Use the deactivate function which handles Instantly sync
      try {
        await deactivateBlocklistEntry(id)

        // Get the updated entry
        const { data: updatedEntry } = await supabase
          .from('blocklist_entries')
          .select('*')
          .eq('id', id)
          .single()

        return NextResponse.json(updatedEntry)
      } catch (error) {
        console.error("Error deactivating entry:", error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to deactivate entry" },
          { status: 500 }
        )
      }
    }

    // For other updates, handle normally
    const { data, error } = await supabase
      .from('blocklist_entries')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Blocklist entry not found" },
          { status: 404 }
        )
      }
      console.error("Error updating blocklist entry:", error)
      return NextResponse.json(
        { error: "Failed to update blocklist entry" },
        { status: 500 }
      )
    }

    // If activating, sync to Instantly
    if (updateData.is_active === true && data.value) {
      try {
        const instantlyEntry = await instantlyClient.addToBlocklist(data.value)

        // Update sync status with Instantly ID
        await supabase
          .from('blocklist_entries')
          .update({
            instantly_synced: true,
            instantly_synced_at: new Date().toISOString(),
            instantly_id: instantlyEntry.id
          })
          .eq('id', id)
      } catch (error) {
        console.error("Failed to sync to Instantly:", error)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Note: Authentication temporarily disabled to match other API routes
    // TODO: Implement proper server-side auth when needed

    // Use the removeEntryFromBlocklist function which handles Instantly sync
    await removeEntryFromBlocklist(id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}