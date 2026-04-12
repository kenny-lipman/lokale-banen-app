import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"
import { detectBlockType, BlockType } from '@/lib/blocklist-detection'
import {
  findCompanyByName,
  createCompanyBlock,
  createDomainBlock,
  createEmailBlock,
  getCompanyDomain
} from '@/lib/blocklist-helpers'

// New simplified import schema - just value and reason
const smartImportSchema = z.object({
  entries: z.array(z.object({
    value: z.string().trim(),
    reason: z.string().trim().min(1, "Reason is required")
  })).min(1).max(1000)
})

// Legacy import schema for backward compatibility
const legacyImportSchema = z.object({
  entries: z.array(z.object({
    type: z.enum(["email", "domain"]),
    value: z.string().trim().toLowerCase(),
    reason: z.string().trim().min(1, "Reason is required")
  })).min(1).max(1000)
})

async function importHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`User ${authResult.user.email} importing blocklist entries`)
    const supabase = supabaseService.serviceClient

    const body = await req.json()

    // Check if it's smart import or legacy format
    const isSmartImport = body.entries?.[0] && !('type' in body.entries[0])

    let entries: Array<{ value: string; reason: string; type?: 'email' | 'domain' }>

    if (isSmartImport) {
      // Smart import - detect types automatically
      const validationResult = smartImportSchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validationResult.error.flatten() },
          { status: 400 }
        )
      }

      entries = validationResult.data.entries
    } else {
      // Legacy import with explicit types
      const validationResult = legacyImportSchema.safeParse(body)

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "Invalid request data", details: validationResult.error.flatten() },
          { status: 400 }
        )
      }

      entries = validationResult.data.entries
    }

    // Process entries and collect results
    const results = {
      success: [] as string[],
      failed: [] as { value: string; error: string }[],
      warnings: [] as { value: string; message: string }[],
      duplicates: [] as string[]
    }

    // Get existing entries to check for duplicates
    const { data: existingEntries } = await supabase
      .from('blocklist_entries')
      .select('type, value')

    const existingSet = new Set(
      existingEntries?.map(e => `${e.type}:${e.value.toLowerCase()}`) || []
    )

    // Process each entry with smart detection
    for (const entry of entries) {
      try {
        let processedSuccessfully = false

        if (isSmartImport) {
          // Use smart detection
          const detection = detectBlockType(entry.value)

          if (detection.type === BlockType.COMPANY) {
            // Try to find company
            const company = await findCompanyByName(detection.normalized_value)

            if (company) {
              // Check if already blocked
              const domain = await getCompanyDomain(company.id)
              if (existingSet.has(`domain:${domain.toLowerCase()}`)) {
                results.duplicates.push(entry.value)
              } else {
                const result = await createCompanyBlock(company.id, entry.reason)
                if (result.success) {
                  results.success.push(entry.value)
                  processedSuccessfully = true
                } else {
                  results.failed.push({ value: entry.value, error: result.error || 'Failed to block company' })
                }
              }
            } else {
              // Company not found - create as domain block
              results.warnings.push({
                value: entry.value,
                message: 'Company not found, created as domain block instead'
              })

              const result = await createDomainBlock(detection.normalized_value, entry.reason)
              if (result.success) {
                results.success.push(entry.value)
                processedSuccessfully = true
              } else {
                results.failed.push({ value: entry.value, error: result.error || 'Failed to create domain block' })
              }
            }
          } else if (detection.type === BlockType.EMAIL) {
            // Check if already blocked
            if (existingSet.has(`email:${detection.normalized_value}`)) {
              results.duplicates.push(entry.value)
            } else {
              const result = await createEmailBlock(detection.normalized_value, entry.reason)
              if (result.success) {
                results.success.push(entry.value)
                processedSuccessfully = true
              } else {
                results.failed.push({ value: entry.value, error: result.error || 'Failed to create email block' })
              }
            }
          } else if (detection.type === BlockType.DOMAIN) {
            // Check if already blocked
            if (existingSet.has(`domain:${detection.normalized_value}`)) {
              results.duplicates.push(entry.value)
            } else {
              const result = await createDomainBlock(detection.normalized_value, entry.reason)
              if (result.success) {
                results.success.push(entry.value)
                processedSuccessfully = true
              } else {
                results.failed.push({ value: entry.value, error: result.error || 'Failed to create domain block' })
              }
            }
          }
        } else {
          // Legacy format - use provided type
          const type = entry.type!
          const value = entry.value.toLowerCase()

          if (existingSet.has(`${type}:${value}`)) {
            results.duplicates.push(entry.value)
          } else {
            const { error } = await supabase
              .from('blocklist_entries')
              .insert({
                type,
                blocklist_level: type === 'email' ? 'contact' : 'domain',
                value,
                reason: entry.reason,
                is_active: true
              })

            if (error) {
              results.failed.push({ value: entry.value, error: error.message })
            } else {
              results.success.push(entry.value)
              processedSuccessfully = true
            }
          }
        }

        // Update existing set if successful
        if (processedSuccessfully) {
          const detection = detectBlockType(entry.value)
          const dbType = detection.type === BlockType.EMAIL ? 'email' : 'domain'
          existingSet.add(`${dbType}:${detection.normalized_value}`)
        }

      } catch (error) {
        console.error(`Error processing entry ${entry.value}:`, error)
        results.failed.push({
          value: entry.value,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      message: "Import completed",
      summary: {
        total: entries.length,
        successful: results.success.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length,
        warnings: results.warnings.length
      },
      results: {
        success: results.success,
        failed: results.failed.length > 0 ? results.failed : undefined,
        duplicates: results.duplicates.length > 0 ? results.duplicates : undefined,
        warnings: results.warnings.length > 0 ? results.warnings : undefined
      }
    }, {
      status: results.failed.length > 0 ? 207 : 200 // 207 Multi-Status for partial success
    })
  } catch (error) {
    console.error("Import API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export const POST = withAuth(importHandler)