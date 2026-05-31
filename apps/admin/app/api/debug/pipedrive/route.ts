// @auth SESSION
/**
 * Debug API for Pipedrive connectivity
 * Tests Pipedrive API connection and methods
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { pipedriveClient } from '@/lib/pipedrive-client'

async function pipedriveDebugHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`🔍 Testing Pipedrive connectivity for user: ${authResult.user.email}`)

    const results: any = {
      api_key_present: !!process.env.PIPEDRIVE_API_TOKEN,
      base_url: process.env.PIPEDRIVE_BASE_URL || 'not set'
    }

    try {
      console.log('🔍 Testing search organization...')
      const searchResults = await pipedriveClient.searchOrganization('Guess')
      results.search_test = {
        success: true,
        results: searchResults.map(r => ({ id: r.item.id, name: r.item.name }))
      }
      console.log('✅ Search test passed')
    } catch (error) {
      console.log('❌ Search test failed:', error)
      results.search_test = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    try {
      console.log('🔍 Testing create organization...')
      const testOrg = await pipedriveClient.createOrganization({
        name: 'TEST_DEBUG_ORG_DELETE_ME',
        owner_id: 22971285
      })
      results.create_test = {
        success: true,
        created_id: testOrg.id
      }
      console.log('✅ Create test passed, ID:', testOrg.id)

      // Clean up test org
      try {
        // deleteOrganization is not available — skip cleanup
        results.create_test.cleanup = 'skipped'
      } catch (cleanupError) {
        results.create_test.cleanup = 'failed'
      }
    } catch (error) {
      console.log('❌ Create test failed:', error)
      results.create_test = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Pipedrive debug failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(pipedriveDebugHandler)