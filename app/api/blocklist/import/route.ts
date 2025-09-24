import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"

const importBlocklistSchema = z.object({
  entries: z.array(z.object({
    type: z.enum(["email", "domain"]),
    value: z.string().trim().toLowerCase(),
    reason: z.string().trim().min(1, "Reason is required")
  })).min(1).max(1000)
})

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseService.serviceClient

    // Note: Authentication temporarily disabled to match other API routes
    // TODO: Implement proper server-side auth when needed

    const body = await req.json()

    // Validate the request body
    const validationResult = importBlocklistSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { entries } = validationResult.data

    // Validate each entry
    const validationErrors: string[] = []
    const validEntries: typeof entries = []

    entries.forEach((entry, index) => {
      if (entry.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(entry.value)) {
          validationErrors.push(`Entry ${index + 1}: Invalid email format - ${entry.value}`)
        } else {
          validEntries.push(entry)
        }
      } else if (entry.type === 'domain') {
        const domainRegex = /^(\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
        if (!domainRegex.test(entry.value)) {
          validationErrors.push(`Entry ${index + 1}: Invalid domain format - ${entry.value}`)
        } else {
          validEntries.push(entry)
        }
      }
    })

    if (validationErrors.length > 0 && validEntries.length === 0) {
      return NextResponse.json(
        { error: "All entries have validation errors", details: validationErrors },
        { status: 400 }
      )
    }

    // Get existing entries to check for duplicates
    const { data: existingEntries } = await supabase
      .from('blocklist_entries')
      .select('type, value')

    const existingSet = new Set(
      existingEntries?.map(e => `${e.type}:${e.value.toLowerCase()}`) || []
    )

    // Filter out duplicates and prepare for insert
    const newEntries = validEntries
      .filter(entry => !existingSet.has(`${entry.type}:${entry.value}`))
      .map(entry => ({
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
        is_active: true
        // created_by: temporarily disabled
      }))

    const duplicatesCount = validEntries.length - newEntries.length

    // Bulk insert new entries
    let insertedCount = 0
    let insertError = null

    if (newEntries.length > 0) {
      const { data, error } = await supabase
        .from('blocklist_entries')
        .insert(newEntries)
        .select()

      if (error) {
        console.error("Error inserting blocklist entries:", error)
        insertError = error
      } else {
        insertedCount = data?.length || 0
      }
    }

    // TODO: Trigger sync to external platforms
    // This will be implemented when the sync services are ready

    const result = {
      summary: {
        total_submitted: entries.length,
        validation_errors: validationErrors.length,
        duplicates_skipped: duplicatesCount,
        successfully_imported: insertedCount,
        failed: insertError ? newEntries.length - insertedCount : 0
      },
      validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      error: insertError ? "Some entries failed to import" : undefined
    }

    const status = insertError ? 207 : 200 // 207 Multi-Status for partial success

    return NextResponse.json(result, { status })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}