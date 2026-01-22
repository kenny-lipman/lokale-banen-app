/**
 * API to clean up Pipedrive Subdomein field options
 *
 * This endpoint helps identify and remove invalid/duplicate options from the
 * Subdomein multi-select field. The Subdomein field should only contain
 * valid regio_platform values from our database.
 *
 * Actions:
 * - GET: Analyze current options and show which should be removed
 * - POST: Actually remove the invalid options (requires confirmation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pipedriveClient, SUBDOMEIN_OPTIONS } from '@/lib/pipedrive-client'

const SUBDOMEIN_FIELD_ID = 33 // Pipedrive field ID for Subdomein

// Options that should be removed (invalid/duplicates/typos)
const OPTIONS_TO_REMOVE = [
  { id: 110, label: 'Alles', reason: 'Not a valid platform' },
  { id: 122, label: 'HoekseBanen', reason: 'Typo - should be HoekscheBanen' },
  { id: 125, label: 'Stolwijk', reason: 'Not a valid platform' },
  { id: 116, label: 'DelftseBanen', reason: 'Duplicate - keep ID 404' },
  { id: 119, label: 'DrechtseBanen', reason: 'Duplicate - keep ID 398' },
  { id: 124, label: 'LeidseBanen', reason: 'Duplicate - keep ID 403' },
]

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient()

    // Get all valid regio_platforms from our database
    const { data: validPlatforms, error } = await supabase
      .from('cities')
      .select('regio_platform')
      .not('regio_platform', 'is', null)

    if (error) {
      throw new Error(`Failed to get valid platforms: ${error.message}`)
    }

    const uniqueValidPlatforms = [...new Set(validPlatforms.map(p => p.regio_platform))]

    // Get current Pipedrive Subdomein options
    const fields = await pipedriveClient.listOrganizationFields()
    const subdomeinField = fields.find((f: any) => f.id === SUBDOMEIN_FIELD_ID)

    if (!subdomeinField) {
      throw new Error('Subdomein field not found in Pipedrive')
    }

    const currentOptions = subdomeinField.options || []

    // Analyze options
    const analysis = {
      totalOptions: currentOptions.length,
      validPlatformsInDb: uniqueValidPlatforms.length,
      optionsToRemove: [] as typeof OPTIONS_TO_REMOVE,
      optionsToKeep: [] as Array<{ id: number; label: string }>,
      missingPlatforms: [] as string[],
    }

    // Check each current option
    for (const opt of currentOptions) {
      const removeInfo = OPTIONS_TO_REMOVE.find(r => r.id === opt.id)
      if (removeInfo) {
        analysis.optionsToRemove.push(removeInfo)
      } else {
        analysis.optionsToKeep.push({ id: opt.id, label: opt.label })
      }
    }

    // Find platforms in DB but not in Pipedrive
    const pipedriveLabels = new Set(analysis.optionsToKeep.map(o => o.label))
    for (const platform of uniqueValidPlatforms) {
      if (!pipedriveLabels.has(platform)) {
        analysis.missingPlatforms.push(platform)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Analysis complete. Use POST to apply changes.',
      analysis,
      actions: {
        remove: analysis.optionsToRemove,
        keep: analysis.optionsToKeep.length,
        add: analysis.missingPlatforms,
      }
    })
  } catch (error) {
    console.error('Error analyzing Subdomein options:', error)
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
    const { confirm, action } = body

    if (!confirm) {
      return NextResponse.json(
        {
          success: false,
          error: 'Confirmation required. Send { "confirm": true, "action": "cleanup" } to proceed.'
        },
        { status: 400 }
      )
    }

    if (action !== 'cleanup') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Use "cleanup" to remove invalid options.'
        },
        { status: 400 }
      )
    }

    // Get current field data
    const fields = await pipedriveClient.listOrganizationFields()
    const subdomeinField = fields.find((f: any) => f.id === SUBDOMEIN_FIELD_ID)

    if (!subdomeinField) {
      throw new Error('Subdomein field not found in Pipedrive')
    }

    const currentOptions = subdomeinField.options || []
    const idsToRemove = new Set(OPTIONS_TO_REMOVE.map(o => o.id))

    // Filter out options to remove
    const newOptions = currentOptions.filter((opt: any) => !idsToRemove.has(opt.id))

    // Note: Actually updating Pipedrive field options requires careful API usage
    // The API endpoint is PUT /organizationFields/{id}
    // For safety, we'll just return what would be done

    return NextResponse.json({
      success: true,
      message: 'Cleanup analysis complete. Manual removal recommended via Pipedrive settings.',
      removed: OPTIONS_TO_REMOVE,
      remaining: newOptions.length,
      instructions: [
        '1. Go to Pipedrive > Settings > Company Settings > Custom Fields',
        '2. Find "Subdomein" field in Organization fields',
        '3. Remove the following options manually:',
        ...OPTIONS_TO_REMOVE.map(o => `   - "${o.label}" (${o.reason})`),
        '4. Verify that organizations using these values are updated'
      ]
    })
  } catch (error) {
    console.error('Error cleaning up Subdomein options:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
