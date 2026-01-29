/**
 * API to fix Pipedrive organizations where hoofddomein is also in subdomeinen
 *
 * This removes the hoofddomein from the subdomeinen field to prevent duplicates.
 *
 * Actions:
 * - GET: Preview organizations that would be fixed
 * - POST: Actually fix the organizations in Pipedrive
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pipedriveClient, HOOFDDOMEIN_OPTIONS, SUBDOMEIN_OPTIONS } from '@/lib/pipedrive-client'

// Reverse mapping: from Pipedrive enum ID to platform name
const HOOFDDOMEIN_ID_TO_NAME = Object.fromEntries(
  Object.entries(HOOFDDOMEIN_OPTIONS).map(([name, id]) => [id, name])
)

const SUBDOMEIN_ID_TO_NAME = Object.fromEntries(
  Object.entries(SUBDOMEIN_OPTIONS).map(([name, id]) => [id, name])
)

// Field IDs
const HOOFDDOMEIN_FIELD_KEY = '7180a7123d1de658e8d1d642b8496802002ddc66'
const SUBDOMEIN_FIELD_KEY = '2a8e7ff62fa14d0c69b48fb025d0bdf80c04a28c'

interface OrgToFix {
  pipedrive_id: number
  name: string
  hoofddomein: string
  subdomeinen: string[]
  subdomeinen_to_keep: string[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId') // Optional: fix specific org

    // If specific org ID provided, just check that one
    if (orgId) {
      const org = await pipedriveClient.getOrganization(parseInt(orgId))

      if (!org) {
        return NextResponse.json({
          success: false,
          error: `Organization ${orgId} not found in Pipedrive`
        }, { status: 404 })
      }

      const hoofddomeinId = org[HOOFDDOMEIN_FIELD_KEY]
      const subdomeinIds = org[SUBDOMEIN_FIELD_KEY] || []

      const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null
      const subdomeinNames = Array.isArray(subdomeinIds)
        ? subdomeinIds.map(id => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean)
        : []

      const hasDuplicate = hoofddomeinName && subdomeinNames.includes(hoofddomeinName)

      return NextResponse.json({
        success: true,
        organization: {
          id: org.id,
          name: org.name,
          hoofddomein: hoofddomeinName,
          subdomeinen: subdomeinNames,
          has_duplicate: hasDuplicate,
          subdomeinen_to_keep: hasDuplicate
            ? subdomeinNames.filter(s => s !== hoofddomeinName)
            : subdomeinNames
        }
      })
    }

    // Find all companies in our DB that are synced to Pipedrive
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, pipedrive_id, hoofddomein, subdomeinen')
      .not('pipedrive_id', 'is', null)
      .not('hoofddomein', 'is', null)
      .limit(500)

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`)
    }

    const toFix: OrgToFix[] = []
    const alreadyCorrect: number[] = []
    const checkFailed: Array<{ pipedrive_id: string; error: string }> = []

    // Check each company's Pipedrive organization
    for (const company of companies || []) {
      try {
        const pipedriveId = parseInt(company.pipedrive_id!)
        const org = await pipedriveClient.getOrganization(pipedriveId)

        if (!org) {
          checkFailed.push({ pipedrive_id: company.pipedrive_id!, error: 'Not found in Pipedrive' })
          continue
        }

        const hoofddomeinId = org[HOOFDDOMEIN_FIELD_KEY]
        const subdomeinIds = org[SUBDOMEIN_FIELD_KEY] || []

        const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null
        const subdomeinNames = Array.isArray(subdomeinIds)
          ? subdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean)
          : []

        // Check if hoofddomein is in subdomeinen
        if (hoofddomeinName && subdomeinNames.includes(hoofddomeinName)) {
          toFix.push({
            pipedrive_id: pipedriveId,
            name: org.name || company.name,
            hoofddomein: hoofddomeinName,
            subdomeinen: subdomeinNames,
            subdomeinen_to_keep: subdomeinNames.filter((s: string) => s !== hoofddomeinName)
          })
        } else {
          alreadyCorrect.push(pipedriveId)
        }

        // Rate limit - Pipedrive has limits
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (err) {
        checkFailed.push({
          pipedrive_id: company.pipedrive_id!,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Preview of organizations to fix. Use POST to apply changes.',
      summary: {
        total_checked: companies?.length || 0,
        to_fix: toFix.length,
        already_correct: alreadyCorrect.length,
        check_failed: checkFailed.length
      },
      organizations_to_fix: toFix,
      check_failed: checkFailed.slice(0, 10) // Limit for readability
    })
  } catch (error) {
    console.error('Error analyzing Pipedrive organizations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { confirm, orgId, all } = body

    if (!confirm) {
      return NextResponse.json(
        {
          success: false,
          error: 'Confirmation required. Send { "confirm": true, "orgId": 12345 } or { "confirm": true, "all": true }'
        },
        { status: 400 }
      )
    }

    const results = {
      fixed: [] as Array<{ pipedrive_id: number; name: string; removed: string }>,
      failed: [] as Array<{ pipedrive_id: number; error: string }>,
      skipped: [] as number[]
    }

    // Fix a specific organization
    if (orgId) {
      const pipedriveId = parseInt(orgId)
      const org = await pipedriveClient.getOrganization(pipedriveId)

      if (!org) {
        return NextResponse.json({
          success: false,
          error: `Organization ${pipedriveId} not found in Pipedrive`
        }, { status: 404 })
      }

      const hoofddomeinId = org[HOOFDDOMEIN_FIELD_KEY]
      const subdomeinIds = org[SUBDOMEIN_FIELD_KEY] || []

      const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null

      if (!hoofddomeinName) {
        return NextResponse.json({
          success: false,
          error: `Organization ${pipedriveId} has no hoofddomein set`
        }, { status: 400 })
      }

      // Find the subdomein ID that matches hoofddomein
      const hoofddomeinAsSubdomeinId = SUBDOMEIN_OPTIONS[hoofddomeinName]

      if (!Array.isArray(subdomeinIds) || !subdomeinIds.includes(hoofddomeinAsSubdomeinId)) {
        return NextResponse.json({
          success: true,
          message: `Organization ${pipedriveId} already correct - hoofddomein not in subdomeinen`,
          organization: {
            id: pipedriveId,
            name: org.name,
            hoofddomein: hoofddomeinName
          }
        })
      }

      // Remove hoofddomein from subdomeinen
      const newSubdomeinIds = subdomeinIds.filter((id: number) => id !== hoofddomeinAsSubdomeinId)

      await pipedriveClient.updateOrganization(pipedriveId, {
        custom_fields: {
          [SUBDOMEIN_FIELD_KEY]: newSubdomeinIds.length > 0 ? newSubdomeinIds : null
        }
      })

      return NextResponse.json({
        success: true,
        message: `Fixed organization ${pipedriveId}`,
        organization: {
          id: pipedriveId,
          name: org.name,
          hoofddomein: hoofddomeinName,
          removed_from_subdomeinen: hoofddomeinName,
          remaining_subdomeinen: newSubdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean)
        }
      })
    }

    // Fix all organizations (requires all: true)
    if (all) {
      const supabase = createServiceRoleClient()

      // Get all companies synced to Pipedrive
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, pipedrive_id, hoofddomein')
        .not('pipedrive_id', 'is', null)
        .not('hoofddomein', 'is', null)
        .limit(500)

      if (error) {
        throw new Error(`Failed to fetch companies: ${error.message}`)
      }

      for (const company of companies || []) {
        try {
          const pipedriveId = parseInt(company.pipedrive_id!)
          const org = await pipedriveClient.getOrganization(pipedriveId)

          if (!org) {
            results.failed.push({ pipedrive_id: pipedriveId, error: 'Not found' })
            continue
          }

          const hoofddomeinId = org[HOOFDDOMEIN_FIELD_KEY]
          const subdomeinIds = org[SUBDOMEIN_FIELD_KEY] || []

          const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null

          if (!hoofddomeinName) {
            results.skipped.push(pipedriveId)
            continue
          }

          const hoofddomeinAsSubdomeinId = SUBDOMEIN_OPTIONS[hoofddomeinName]

          if (!Array.isArray(subdomeinIds) || !subdomeinIds.includes(hoofddomeinAsSubdomeinId)) {
            results.skipped.push(pipedriveId)
            continue
          }

          // Remove hoofddomein from subdomeinen
          const newSubdomeinIds = subdomeinIds.filter((id: number) => id !== hoofddomeinAsSubdomeinId)

          await pipedriveClient.updateOrganization(pipedriveId, {
            custom_fields: {
              [SUBDOMEIN_FIELD_KEY]: newSubdomeinIds.length > 0 ? newSubdomeinIds : null
            }
          })

          results.fixed.push({
            pipedrive_id: pipedriveId,
            name: org.name || company.name,
            removed: hoofddomeinName
          })

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 300))

        } catch (err) {
          results.failed.push({
            pipedrive_id: parseInt(company.pipedrive_id!),
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${companies?.length || 0} organizations`,
        results: {
          fixed: results.fixed.length,
          skipped: results.skipped.length,
          failed: results.failed.length
        },
        details: {
          fixed: results.fixed,
          failed: results.failed.slice(0, 20) // Limit for readability
        }
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Please specify either "orgId" to fix a specific organization, or "all: true" to fix all'
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fixing Pipedrive organizations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
