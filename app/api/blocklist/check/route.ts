import { NextRequest, NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { z } from "zod"

const checkBlocklistSchema = z.object({
  entries: z.array(z.string().trim().toLowerCase()).min(1).max(1000)
})

interface BlocklistCheckResult {
  value: string
  is_blocked: boolean
  type?: 'email' | 'domain'
  reason?: string
  blocked_by?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseService.serviceClient

    const body = await req.json()

    // Validate the request body
    const validationResult = checkBlocklistSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { entries } = validationResult.data

    // Get all active blocklist entries
    const { data: blocklistEntries, error } = await supabase
      .from('blocklist_entries')
      .select('type, value, reason')
      .eq('is_active', true)

    if (error) {
      console.error("Error fetching blocklist entries:", error)
      return NextResponse.json(
        { error: "Failed to check blocklist" },
        { status: 500 }
      )
    }

    // Create maps for quick lookup
    const blockedEmails = new Map<string, { reason: string }>()
    const blockedDomains = new Map<string, { reason: string }>()

    blocklistEntries?.forEach(entry => {
      if (entry.type === 'email') {
        blockedEmails.set(entry.value.toLowerCase(), { reason: entry.reason })
      } else if (entry.type === 'domain') {
        blockedDomains.set(entry.value.toLowerCase(), { reason: entry.reason })
      }
    })

    // Check each entry
    const results: BlocklistCheckResult[] = entries.map(entry => {
      const lowerEntry = entry.toLowerCase()

      // Check if it's a direct email match
      if (blockedEmails.has(lowerEntry)) {
        const blocked = blockedEmails.get(lowerEntry)!
        return {
          value: entry,
          is_blocked: true,
          type: 'email',
          reason: blocked.reason,
          blocked_by: lowerEntry
        }
      }

      // Check if the entry is an email and its domain is blocked
      const emailRegex = /^[^\s@]+@([^\s@]+)$/
      const emailMatch = lowerEntry.match(emailRegex)

      if (emailMatch) {
        const domain = emailMatch[1]

        // Check for exact domain match
        if (blockedDomains.has(domain)) {
          const blocked = blockedDomains.get(domain)!
          return {
            value: entry,
            is_blocked: true,
            type: 'domain',
            reason: blocked.reason,
            blocked_by: domain
          }
        }

        // Check for wildcard domain matches (e.g., *.example.com)
        for (const [blockedDomain, blockedInfo] of blockedDomains) {
          if (blockedDomain.startsWith('*.')) {
            const baseDomain = blockedDomain.substring(2)
            if (domain.endsWith(baseDomain)) {
              return {
                value: entry,
                is_blocked: true,
                type: 'domain',
                reason: blockedInfo.reason,
                blocked_by: blockedDomain
              }
            }
          }
        }
      } else {
        // If it's not an email, check if it's a blocked domain
        if (blockedDomains.has(lowerEntry)) {
          const blocked = blockedDomains.get(lowerEntry)!
          return {
            value: entry,
            is_blocked: true,
            type: 'domain',
            reason: blocked.reason,
            blocked_by: lowerEntry
          }
        }
      }

      // Not blocked
      return {
        value: entry,
        is_blocked: false
      }
    })

    // Calculate statistics
    const stats = {
      total: results.length,
      blocked: results.filter(r => r.is_blocked).length,
      allowed: results.filter(r => !r.is_blocked).length,
      blocked_by_email: results.filter(r => r.is_blocked && r.type === 'email').length,
      blocked_by_domain: results.filter(r => r.is_blocked && r.type === 'domain').length
    }

    return NextResponse.json({
      results,
      stats
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}