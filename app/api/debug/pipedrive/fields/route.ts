/**
 * Debug API to list Pipedrive organization fields
 * Use this to find field IDs for custom fields like Subdomein
 */

import { NextRequest, NextResponse } from 'next/server'
import { pipedriveClient } from '@/lib/pipedrive-client'

export async function GET(req: NextRequest) {
  try {
    // Optional: filter by field name query param
    const searchParams = req.nextUrl.searchParams
    const searchName = searchParams.get('name')

    const fields = await pipedriveClient.listOrganizationFields()

    // Filter if name provided
    let filteredFields = fields
    if (searchName) {
      filteredFields = fields.filter((f: any) =>
        f.name.toLowerCase().includes(searchName.toLowerCase())
      )
    }

    // Simplify the response
    const simplifiedFields = filteredFields.map((f: any) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      field_type: f.field_type,
      options: f.options?.slice(0, 10), // Limit options shown
      options_count: f.options?.length
    }))

    return NextResponse.json({
      success: true,
      count: simplifiedFields.length,
      total: fields.length,
      fields: simplifiedFields
    })
  } catch (error) {
    console.error('Error listing Pipedrive fields:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
